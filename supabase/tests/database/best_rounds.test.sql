-- View best_rounds: agrega por mapa e respeita o RLS de sessions.
-- Correr com: pnpm db:test   (precisa de `pnpm db:start`)
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');
insert into public.maps (id, name, storyline, release_order, is_dlc) values
  ('test-map', 'Test Map', 'chaos', 999, false),
  ('test-map-2', 'Test Map 2', 'aether', 998, false);

insert into public.sessions (user_id, map_id, round_reached) values
  ('11111111-1111-1111-1111-111111111111', 'test-map', 12),
  ('11111111-1111-1111-1111-111111111111', 'test-map', 30),
  ('11111111-1111-1111-1111-111111111111', 'test-map-2', 5),
  ('22222222-2222-2222-2222-222222222222', 'test-map', 99);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.sessions'::regclass),
  'RLS ativo na tabela base');
select ok(
  (select coalesce('security_invoker=true' = any(reloptions), false) from pg_class where oid = 'public.best_rounds'::regclass),
  'best_rounds é security_invoker');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select results_eq(
  $$ select map_id, best_round, session_count from public.best_rounds order by map_id $$,
  $$ values ('test-map', 30, 2), ('test-map-2', 5, 1) $$,
  'A vê a sua melhor ronda e número de sessões por mapa');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select results_eq(
  $$ select map_id, best_round, session_count from public.best_rounds $$,
  $$ values ('test-map', 99, 1) $$,
  'B vê só os seus dados (RLS aplicado através da view)');

reset role;
set local role anon;
select throws_ok($$ select * from public.best_rounds $$, '42501', null, 'anon não lê a view');

select * from finish();
rollback;
