-- Editar e apagar sessões: desconta dos camos bloqueados, não mexe nos desbloqueados.
-- Correr com: pnpm db:test   (precisa de `pnpm db:start`)
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------- Fixtures (como postgres) ----------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

insert into public.maps (id, name, storyline, release_order, is_dlc) values
  ('test-map', 'Test Map', 'chaos', 999, false),
  ('test-map-2', 'Test Map 2', 'aether', 998, false);
insert into public.weapons (id, name, weapon_class, source) values
  ('w1', 'W1', 'smg', 'base'),
  ('w2', 'W2', 'ar', 'base');

-- Independente do estado da base de dados (tudo é revertido no fim).
-- Tudo o que referencia camos tem de sair antes (dados de desenvolvimento locais incluídos).
delete from public.weapon_camo_progress;
delete from public.user_camo_overrides;
delete from public.camo_notes;
delete from public.goals;
delete from public.camos;
insert into public.camos (id, name, tier, kind, requirement_type, requirement_value, requirement_text, verified) values
  ('c-kills', 'Kills 10',    1, 'zombies', 'kills',     10,   'teste', true),
  ('c-heads', 'Headshots ?', 2, 'zombies', 'headshots', null, 'teste', false);

create function pg_temp.count_of(p_weapon text, p_camo text) returns int
language sql as $$
  select current_count from public.weapon_camo_progress where weapon_id = p_weapon and camo_id = p_camo
$$;
create function pg_temp.is_unlocked(p_weapon text, p_camo text) returns boolean
language sql as $$
  select unlocked_at is not null from public.weapon_camo_progress where weapon_id = p_weapon and camo_id = p_camo
$$;
grant execute on function pg_temp.count_of(text, text) to authenticated;
grant execute on function pg_temp.is_unlocked(text, text) to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Duas sessões: s1 (w1: 4 kills, 2 hs) e s2 (w1: 3 kills, 1 hs).
create temp table ids (name text primary key, id uuid) on commit drop;
insert into ids values
  ('s1', public.record_session('test-map', 10, 'normal', 1, now(), null,
         '[{"weapon_id":"w1","kills":4,"headshots":2}]')),
  ('s2', public.record_session('test-map', 20, 'normal', 1, now(), null,
         '[{"weapon_id":"w1","kills":3,"headshots":1}]'));

select is(pg_temp.count_of('w1', 'c-kills'), 7, 'record_session continua a somar (refatorado)');
select is(pg_temp.count_of('w1', 'c-heads'), 3, 'headshots somados');

-- ---------- Apagar ----------
select lives_ok(format('select public.delete_session(%L)', (select id from ids where name = 's2')),
  'delete_session corre');
select is((select count(*)::int from public.sessions), 1, 'sessão apagada');
select is((select count(*)::int from public.session_weapon_stats), 1, 'stats da sessão apagadas em cascata');
select is(pg_temp.count_of('w1', 'c-kills'), 4, 'kills da sessão apagada são descontados');
select is(pg_temp.count_of('w1', 'c-heads'), 2, 'headshots da sessão apagada são descontados');

-- ---------- Editar ----------
-- s1 passa de (w1: 4/2) para (w1: 1/0, w2: 5/5), noutro mapa e modo.
select lives_ok(format(
  $f$select public.update_session(%L, 'test-map-2', 33, 'hardcore', 2, null, 'editada',
     '[{"weapon_id":"w1","kills":1,"headshots":0},{"weapon_id":"w2","kills":5,"headshots":5}]')$f$,
  (select id from ids where name = 's1')), 'update_session corre');

select results_eq(
  $$ select map_id, round_reached, mode, players, notes from public.sessions $$,
  $$ values ('test-map-2', 33, 'hardcore', 2, 'editada') $$,
  'dados da sessão atualizados');
select results_eq(
  $$ select weapon_id, kills, headshots from public.session_weapon_stats order by weapon_id $$,
  $$ values ('w1', 1, 0), ('w2', 5, 5) $$,
  'stats substituídas');
select is(pg_temp.count_of('w1', 'c-kills'), 1, 'w1: stats antigas descontadas e novas somadas');
select is(pg_temp.count_of('w1', 'c-heads'), 0, 'w1: headshots recalculados');
select is(pg_temp.count_of('w2', 'c-kills'), 5, 'w2: nova arma soma');

-- ---------- Camos desbloqueados não são alterados ----------
select lives_ok(format(
  $f$select public.update_session(%L, 'test-map-2', 33, 'hardcore', 2, null, null,
     '[{"weapon_id":"w2","kills":20,"headshots":0}]')$f$,
  (select id from ids where name = 's1')), 'edição que desbloqueia c-kills na w2');
select is(pg_temp.is_unlocked('w2', 'c-kills'), true, 'w2 c-kills desbloqueado (20 >= 10)');
select is(pg_temp.count_of('w1', 'c-kills'), 0, 'w1 removida da sessão: kills descontados até 0');

select lives_ok(format('select public.delete_session(%L)', (select id from ids where name = 's1')),
  'apagar a sessão que desbloqueou o camo');
select is(pg_temp.is_unlocked('w2', 'c-kills'), true, 'camo desbloqueado continua desbloqueado');
select is(pg_temp.count_of('w2', 'c-kills'), 20, 'contador de camo desbloqueado não é descontado');
select is(pg_temp.count_of('w2', 'c-heads'), 0, 'camo bloqueado sem stats fica a 0');

-- ---------- Nunca abaixo de zero ----------
insert into ids values ('s3', public.record_session('test-map', 5, 'normal', 1, now(), null,
  '[{"weapon_id":"w1","kills":6,"headshots":0}]'));
update public.weapon_camo_progress set current_count = 2 where weapon_id = 'w1' and camo_id = 'c-kills';
select lives_ok(format('select public.delete_session(%L)', (select id from ids where name = 's3')),
  'apagar depois de o contador ter sido corrigido à mão');
select is(pg_temp.count_of('w1', 'c-kills'), 0, 'o contador não fica negativo');

-- ---------- Isolamento entre utilizadores ----------
insert into ids values ('s4', public.record_session('test-map', 7, 'normal', 1, now(), null,
  '[{"weapon_id":"w1","kills":3,"headshots":0}]'));
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok(format('select public.delete_session(%L)', (select id from ids where name = 's4')),
  'P0002', null, 'B não apaga sessões de A');
select throws_ok(format($f$select public.update_session(%L, 'test-map', 1, 'normal', 1)$f$,
  (select id from ids where name = 's4')), 'P0002', null, 'B não edita sessões de A');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(pg_temp.count_of('w1', 'c-kills'), 3, 'o progresso de A ficou intacto');
select is((select count(*)::int from public.sessions), 1, 'a sessão de A ficou intacta');

select * from finish();
rollback;
