-- RLS com dois utilizadores diferentes (A e B) e com anon.
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
insert into public.weapons (id, name, weapon_class, source)
  values ('test-weapon', 'Test Weapon', 'smg', 'base');
insert into public.camos (id, name, tier, kind, requirement_type, requirement_value, requirement_text, verified)
  values ('test-camo', 'Test Camo', 999, 'zombies', 'unknown', null, 'teste', false);
insert into public.easter_eggs (id, map_id, name, type)
  values ('test-ee', 'test-map', 'Test EE', 'main');
insert into public.easter_egg_steps (id, easter_egg_id, step_order, title)
  values ('test-ee-1', 'test-ee', 1, 'Passo de teste');
insert into public.challenges (id, map_id, name, description, target)
  values ('test-ch', 'test-map', 'Desafio', 'Descrição', 1);

-- ---------- Utilizador A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select ok((select count(*) from public.maps) > 0, 'authenticated lê o catálogo');
select throws_ok(
  $$ insert into public.maps (id, name, storyline, release_order) values ('x', 'X', 'chaos', 1000) $$,
  '42501', null, 'authenticated não escreve no catálogo');
select throws_ok(
  $$ update public.camos set requirement_value = 1 where id = 'test-camo' $$,
  '42501', null, 'authenticated não altera camos');

select lives_ok($$ insert into public.sessions (id, map_id, round_reached)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'test-map', 10) $$, 'A cria uma sessão');
select lives_ok($$ insert into public.session_weapon_stats (session_id, weapon_id, kills, headshots)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'test-weapon', 50, 10) $$, 'A cria stats na sua sessão');
select lives_ok($$ insert into public.weapon_camo_progress (weapon_id, camo_id, current_count)
  values ('test-weapon', 'test-camo', 5) $$, 'A cria progresso de camo');
select lives_ok($$ insert into public.easter_egg_step_progress (step_id) values ('test-ee-1') $$,
  'A marca um passo');
select lives_ok($$ insert into public.easter_egg_completions (easter_egg_id) values ('test-ee') $$,
  'A regista uma completion');
select lives_ok($$ insert into public.challenge_progress (challenge_id) values ('test-ch') $$,
  'A cria progresso de desafio');

select is((select user_id from public.sessions where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'user_id é preenchido com auth.uid() por defeito');

-- ---------- Utilizador B ----------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*)::int from public.sessions), 0, 'B não vê sessões de A');
select is((select count(*)::int from public.session_weapon_stats), 0, 'B não vê stats de A');
select is((select count(*)::int from public.weapon_camo_progress), 0, 'B não vê camos de A');
select is((select count(*)::int from public.easter_egg_step_progress), 0, 'B não vê passos de A');
select is((select count(*)::int from public.easter_egg_completions), 0, 'B não vê completions de A');
select is((select count(*)::int from public.challenge_progress), 0, 'B não vê desafios de A');

select is_empty($$ update public.sessions set round_reached = 99 returning id $$,
  'B não consegue alterar sessões de A');
select is_empty($$ delete from public.weapon_camo_progress returning camo_id $$,
  'B não consegue apagar progresso de A');
select is_empty($$ update public.session_weapon_stats set kills = 0 returning weapon_id $$,
  'B não consegue alterar stats de A');

select throws_ok($$ insert into public.sessions (user_id, map_id, round_reached)
  values ('11111111-1111-1111-1111-111111111111', 'test-map', 1) $$,
  '42501', null, 'B não cria sessões em nome de A');
select throws_ok($$ insert into public.session_weapon_stats (session_id, weapon_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'test-weapon') $$,
  '42501', null, 'B não acrescenta stats à sessão de A');
select throws_ok($$ insert into public.weapon_camo_progress (user_id, weapon_id, camo_id)
  values ('11111111-1111-1111-1111-111111111111', 'test-weapon', 'test-camo') $$,
  '42501', null, 'B não cria progresso em nome de A');

select lives_ok($$ insert into public.sessions (map_id, round_reached) values ('test-map', 3) $$,
  'B cria a sua própria sessão');
select is((select count(*)::int from public.sessions), 1, 'B vê só a sua sessão');

-- ---------- De volta a A ----------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select round_reached from public.sessions where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  10, 'a sessão de A ficou intacta');
select is((select count(*)::int from public.sessions), 1, 'A não vê a sessão de B');
select is((select count(*)::int from public.weapon_camo_progress), 1, 'o progresso de A ficou intacto');

-- ---------- anon ----------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select * from public.maps $$, '42501', null, 'anon não lê o catálogo');
select throws_ok($$ select * from public.sessions $$, '42501', null, 'anon não lê sessões');
select throws_ok($$ select public.record_session('test-map', 1) $$, '42501', null,
  'anon não pode chamar record_session');

select * from finish();
rollback;
