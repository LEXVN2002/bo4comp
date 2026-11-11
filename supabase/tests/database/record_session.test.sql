-- Lógica de progresso de camos em record_session / unlock_mastery_camos.
-- Usa camos de teste com requisitos conhecidos (os reais estão todos por confirmar).
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
  ('test-weapon', 'Test Weapon', 'smg', 'base'),
  ('test-weapon-2', 'Test Weapon 2', 'ar', 'base');

-- Substituir o catálogo de camos (a transação é revertida no fim).
delete from public.camos;
insert into public.camos (id, name, tier, kind, requirement_type, requirement_value, requirement_text, verified) values
  ('c-kills',   'Kills 10',     1, 'zombies', 'kills',      10,   'teste', true),
  ('c-heads',   'Headshots 5',  2, 'zombies', 'headshots',  5,    'teste', true),
  ('c-null',    'Kills ?',      3, 'zombies', 'kills',      null, 'teste', false),
  ('c-unknown', 'Desconhecido', 4, 'zombies', 'unknown',    null, 'teste', false),
  ('m-gold',    'Gold',         5, 'mastery', 'prereq_all', null, 'teste', false),
  ('m-diamond', 'Diamond',      6, 'mastery', 'prereq_all', null, 'teste', false);

create function pg_temp.progress(p_camo text, p_weapon text default 'test-weapon')
returns table (current_count int, unlocked boolean)
language sql as $$
  select p.current_count, p.unlocked_at is not null
  from public.weapon_camo_progress p
  where p.weapon_id = p_weapon and p.camo_id = p_camo
$$;
grant execute on function pg_temp.progress(text, text) to authenticated;

set local role authenticated;

-- ---------- Sem sessão ----------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$ select public.record_session('test-map', 1) $$, '42501', null,
  'record_session exige utilizador autenticado');

-- ---------- Utilizador A ----------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Sessão 1: 6 kills, 3 headshots.
select isnt(public.record_session('test-map', 15, 'normal', 1, now(), null,
  '[{"weapon_id":"test-weapon","kills":6,"headshots":3}]'), null, 'sessão 1 gravada');

select results_eq($$ select * from pg_temp.progress('c-kills') $$, $$ values (6, false) $$,
  'kills somados ao camo de kills');
select results_eq($$ select * from pg_temp.progress('c-heads') $$, $$ values (3, false) $$,
  'headshots somados ao camo de headshots');
select results_eq($$ select * from pg_temp.progress('c-null') $$, $$ values (6, false) $$,
  'camo com requisito null também acumula');
select is_empty($$ select * from pg_temp.progress('c-unknown') $$,
  'camo unknown não acumula');

select results_eq(
  $$ select user_id, map_id, round_reached, mode, players, source from public.sessions $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 'test-map', 15, 'normal', 1, 'manual') $$,
  'sessão gravada com os dados certos e source manual');

-- Sessão 2: arma repetida no array (3+2 kills, 1+1 headshots) => soma 5 / 2.
select lives_ok($$ select public.record_session('test-map', 20, 'normal', 1, now(), null,
  '[{"weapon_id":"test-weapon","kills":3,"headshots":1},{"weapon_id":"test-weapon","kills":2,"headshots":1}]') $$,
  'sessão 2 gravada');

select results_eq(
  $$ select s.kills, s.headshots from public.session_weapon_stats s
     join public.sessions x on x.id = s.session_id where x.round_reached = 20 $$,
  $$ values (5, 2) $$, 'armas repetidas são somadas numa linha');
select results_eq($$ select * from pg_temp.progress('c-kills') $$, $$ values (11, true) $$,
  'camo de kills desbloqueia ao atingir o requisito');
select results_eq($$ select * from pg_temp.progress('c-heads') $$, $$ values (5, true) $$,
  'camo de headshots desbloqueia exatamente no requisito');
select results_eq($$ select * from pg_temp.progress('c-null') $$, $$ values (11, false) $$,
  'camo com requisito null nunca desbloqueia sozinho');

-- Sessão 3: camos já desbloqueados deixam de contar.
select lives_ok($$ select public.record_session('test-map', 5, 'normal', 1, now(), null,
  '[{"weapon_id":"test-weapon","kills":4,"headshots":0}]') $$, 'sessão 3 gravada');
select results_eq($$ select * from pg_temp.progress('c-kills') $$, $$ values (11, true) $$,
  'camo desbloqueado não continua a contar');
select results_eq($$ select * from pg_temp.progress('c-null') $$, $$ values (15, false) $$,
  'camo bloqueado continua a contar');

-- Mastery: bloqueado enquanto houver camos anteriores por desbloquear.
select is_empty($$ select * from pg_temp.progress('m-gold') where unlocked $$,
  'Gold não desbloqueia com camos anteriores bloqueados');

-- Desbloqueios manuais (como a UI fará) e depois a verificação de mastery.
update public.weapon_camo_progress set unlocked_at = now()
  where weapon_id = 'test-weapon' and camo_id = 'c-null';
insert into public.weapon_camo_progress (weapon_id, camo_id, unlocked_at)
  values ('test-weapon', 'c-unknown', now());
select lives_ok($$ select public.unlock_mastery_camos(array['test-weapon', 'test-weapon-2']) $$,
  'unlock_mastery_camos corre');

select results_eq($$ select unlocked from pg_temp.progress('m-gold') $$, $$ values (true) $$,
  'Gold desbloqueia quando todos os anteriores estão desbloqueados');
select results_eq($$ select unlocked from pg_temp.progress('m-diamond') $$, $$ values (true) $$,
  'Diamond desbloqueia em cadeia a seguir ao Gold');
select is((select count(*)::int from public.weapon_camo_progress where weapon_id = 'test-weapon-2'), 0,
  'outra arma sem progresso não ganha mastery');

select throws_ok($$ select public.record_session('test-map', 1, 'normal', 1, now(), null,
  '{"weapon_id":"test-weapon"}') $$, '22023', null, 'p_weapon_stats tem de ser um array');
select throws_ok($$ select public.record_session('test-map', 1, 'normal', 1, now(), null,
  '[{"weapon_id":"nao-existe","kills":1,"headshots":0}]') $$, '23503', null,
  'arma inexistente é recusada');
select throws_ok($$ select public.record_session('test-map', 1, 'modo-invalido') $$, '23514', null,
  'modo inválido é recusado');

-- ---------- Utilizador B: progresso independente ----------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*)::int from public.weapon_camo_progress), 0, 'B começa sem progresso');
select lives_ok($$ select public.record_session('test-map', 30, 'normal', 1, now(), null,
  '[{"weapon_id":"test-weapon","kills":10,"headshots":0}]') $$, 'B grava uma sessão');
select results_eq($$ select * from pg_temp.progress('c-kills') $$, $$ values (10, true) $$,
  'B desbloqueia o seu próprio camo');
select results_eq($$ select * from pg_temp.progress('c-null') $$, $$ values (10, false) $$,
  'o progresso de B não soma ao de A');

select * from finish();
rollback;
