-- Aba de camos e grind: overrides no progresso, sessões ao vivo e RLS das tabelas novas.
-- Correr com: pnpm db:test   (precisa de `pnpm db:start`)
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------- Fixtures (como postgres) ----------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

insert into public.maps (id, name, storyline, release_order, is_dlc)
  values ('test-map', 'Test Map', 'chaos', 999, false);
insert into public.weapons (id, name, weapon_class, source) values
  ('test-weapon', 'Test Weapon', 'smg', 'base');

-- Tudo o que referencia camos tem de sair antes (dados de desenvolvimento locais incluídos).
delete from public.weapon_camo_progress;
delete from public.user_camo_overrides;
delete from public.camo_notes;
delete from public.goals;
delete from public.camos;
insert into public.camos (id, name, tier, kind, requirement_type, requirement_value, requirement_text, verified) values
  ('c-kills',   'Kills 10',     1, 'zombies', 'kills',      10,   'teste', true),
  ('c-unknown', 'Desconhecido', 2, 'zombies', 'unknown',    null, 'teste', false),
  ('m-gold',    'Gold',         3, 'mastery', 'prereq_all', null, 'teste', false);

create function pg_temp.progress(p_camo text)
returns table (current_count int, unlocked boolean)
language sql as $$
  select p.current_count, p.unlocked_at is not null
  from public.weapon_camo_progress p
  where p.weapon_id = 'test-weapon' and p.camo_id = p_camo
$$;
grant execute on function pg_temp.progress(text) to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- ---------- Overrides ----------
-- Sem override, o camo 'unknown' não acumula.
select public.record_session('test-map', 5, 'normal', 1, now(), null,
  '[{"weapon_id":"test-weapon","kills":4,"headshots":2}]');
select is_empty($$ select * from pg_temp.progress('c-unknown') $$, 'sem override: camo unknown não acumula');

-- Com override (headshots, 5), passa a contar headshots.
insert into public.user_camo_overrides (camo_id, requirement_type, requirement_value)
  values ('c-unknown', 'headshots', 5);
select public.record_session('test-map', 5, 'normal', 1, now(), null,
  '[{"weapon_id":"test-weapon","kills":4,"headshots":3}]');
select results_eq($$ select * from pg_temp.progress('c-unknown') $$, $$ values (3, false) $$,
  'override dá tipo e valor ao camo unknown');

-- Override de valor também se aplica a camos do catálogo (10 -> 9: 4+4 = 8, ainda não).
insert into public.user_camo_overrides (camo_id, requirement_value) values ('c-kills', 9);
select results_eq($$ select * from pg_temp.progress('c-kills') $$, $$ values (8, false) $$,
  'override de valor: ainda abaixo');

select throws_ok($$ insert into public.user_camo_overrides (camo_id, requirement_type) values ('m-gold', 'unknown') $$,
  '23514', null, 'override só aceita kills ou headshots');
select throws_ok($$ insert into public.user_camo_overrides (camo_id, requirement_value) values ('m-gold', 0) $$,
  '23514', null, 'override recusa valor 0');

-- ---------- Sessões ao vivo ----------
insert into public.sessions (map_id, status) values ('test-map', 'live');
select throws_ok($$ insert into public.sessions (map_id, status) values ('test-map', 'live') $$,
  '23505', null, 'só uma sessão ao vivo por utilizador');
select throws_ok($$ insert into public.sessions (map_id, status) values ('test-map', 'done') $$,
  '23514', null, 'sessão terminada exige ronda');

insert into public.session_weapon_stats (session_id, weapon_id, kills, headshots)
  select id, 'test-weapon', 5, 2 from public.sessions where status = 'live';

select results_eq($$ select * from pg_temp.progress('c-kills') $$, $$ values (8, false) $$,
  'sessão ao vivo não conta para o progresso');
select is((select count(*)::int from public.best_rounds), 1, 'best_rounds tem o mapa');
select is((select session_count from public.best_rounds), 2, 'best_rounds ignora a sessão ao vivo');

select throws_ok(
  $$ select public.update_session((select id from public.sessions where status = 'live'), 'test-map', 3, 'normal', 1) $$,
  '22023', null, 'não se edita uma sessão ao vivo');
select throws_ok(
  $$ select public.apply_session_camo_progress((select id from public.sessions where status = 'live'), 1) $$,
  '22023', null, 'não se soma uma sessão ao vivo');

-- Terminar: 8 + 5 = 13 kills >= 9 (override) desbloqueia c-kills; headshots 3 + 2 = 5 desbloqueia c-unknown;
-- com todos os camos anteriores feitos, Gold desbloqueia também.
select results_eq(
  $$ select * from public.record_session((select id from public.sessions where status = 'live'), 12) $$,
  $$ values ('test-weapon', 'c-kills'), ('test-weapon', 'c-unknown'), ('test-weapon', 'm-gold') $$,
  'terminar devolve os camos desbloqueados, por tier');
select is((select count(*)::int from public.sessions where status = 'live'), 0, 'a sessão ficou terminada');
select is((select round_reached from public.sessions where round_reached = 12), 12, 'ronda gravada');
select throws_ok(
  $$ select * from public.record_session((select id from public.sessions where round_reached = 12), 13) $$,
  '22023', null, 'não se termina duas vezes');

-- Descartar uma sessão ao vivo não mexe no progresso.
insert into public.sessions (map_id, status) values ('test-map', 'live');
insert into public.session_weapon_stats (session_id, weapon_id, kills, headshots)
  select id, 'test-weapon', 50, 50 from public.sessions where status = 'live';
update public.weapon_camo_progress set unlocked_at = null, current_count = 1 where camo_id = 'c-kills';
select lives_ok($$ select public.delete_session((select id from public.sessions where status = 'live')) $$,
  'apagar uma sessão ao vivo funciona');
select results_eq($$ select * from pg_temp.progress('c-kills') $$, $$ values (1, false) $$,
  'apagar uma sessão ao vivo não desconta nada');

-- ---------- Tabelas novas: valores por defeito e restrições ----------
insert into public.pinned_weapons (weapon_id) values ('test-weapon');
insert into public.weapon_notes (weapon_id, body) values ('test-weapon', 'nota');
insert into public.camo_notes (weapon_id, camo_id, body) values ('test-weapon', 'c-kills', 'nota');
insert into public.user_settings (player_name) values ('A');
insert into public.goals (title, type, target) values ('100 kills', 'kills', 100);

select is((select user_id from public.user_settings), '11111111-1111-1111-1111-111111111111'::uuid,
  'user_id fica auth.uid() por defeito');
select throws_ok($$ insert into public.goals (title, type, target) values ('x', 'weapon_camo', 1) $$,
  '23514', null, 'weapon_camo exige arma e camo');
select throws_ok($$ insert into public.goals (title, type, target, camo_id) values ('x', 'kills', 1, 'c-kills') $$,
  '23514', null, 'camo só em objetivos weapon_camo');
select throws_ok($$ insert into public.goals (title, type, target, weapon_class) values ('x', 'camo_count', 1, 'rpg') $$,
  '23514', null, 'classe de arma desconhecida é recusada');
select throws_ok($$ insert into public.user_settings (player_name, sound_volume) values ('B', 0.5) $$,
  '23505', null, 'uma linha de definições por utilizador');

-- updated_at muda sozinho (o trigger ignora o valor enviado).
update public.weapon_notes set updated_at = '2000-01-01', body = 'nova';
select ok((select updated_at > '2001-01-01' from public.weapon_notes), 'updated_at atualizado pelo trigger');

-- ---------- RLS: B não vê nem escreve nas linhas de A ----------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is_empty($$ select 1 from public.user_camo_overrides $$, 'B não vê overrides de A');
select is_empty($$ select 1 from public.pinned_weapons $$, 'B não vê armas afixadas de A');
select is_empty($$ select 1 from public.camo_notes $$, 'B não vê notas de camo de A');
select is_empty($$ select 1 from public.weapon_notes $$, 'B não vê notas de arma de A');
select is_empty($$ select 1 from public.goals $$, 'B não vê objetivos de A');
select is_empty($$ select 1 from public.user_settings $$, 'B não vê definições de A');
select throws_ok(
  $$ insert into public.goals (user_id, title, type, target) values ('11111111-1111-1111-1111-111111111111', 'x', 'kills', 1) $$,
  '42501', null, 'B não cria objetivos em nome de A');

-- O override de A não afeta B: para B, c-unknown continua sem contar.
select public.record_session('test-map', 5, 'normal', 1, now(), null,
  '[{"weapon_id":"test-weapon","kills":1,"headshots":9}]');
select is_empty($$ select * from pg_temp.progress('c-unknown') $$, 'override de A não se aplica a B');

reset role;
set local role anon;
select throws_ok($$ select 1 from public.goals $$, '42501', null, 'anon não acede às tabelas novas');

select * from finish();
rollback;
