-- Exportar e importar progresso sem perda de dados.
-- Correr com: pnpm db:test   (precisa de `pnpm db:start`)
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');
insert into public.maps (id, name, storyline, release_order, is_dlc)
  values ('test-map', 'Test Map', 'chaos', 999, false);
insert into public.weapons (id, name, weapon_class, source) values
  ('w1', 'W1', 'smg', 'base'), ('w2', 'W2', 'ar', 'base');
insert into public.camos (id, name, tier, kind, requirement_type, requirement_value, requirement_text, verified)
  values ('test-camo', 'Test Camo', 999, 'zombies', 'kills', null, 'teste', false);
insert into public.easter_eggs (id, map_id, name, type) values ('test-ee', 'test-map', 'Test EE', 'main');
insert into public.easter_egg_steps (id, easter_egg_id, step_order, title) values
  ('test-ee-1', 'test-ee', 1, 'Passo 1'), ('test-ee-2', 'test-ee', 2, 'Passo 2');
insert into public.challenges (id, map_id, name, description, target)
  values ('test-ch', 'test-map', 'Desafio', 'Descrição', 5);

create temp table snap (name text primary key, data jsonb) on commit drop;
grant all on snap to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- ---------- Dados de A ----------
select public.record_session('test-map', 15, 'hardcore', 2, '2026-11-01T20:00:00Z', 'nota com ''plicas''',
  '[{"weapon_id":"w1","kills":40,"headshots":10},{"weapon_id":"w2","kills":3,"headshots":0}]');
select public.record_session('test-map', 31, 'normal', 1, '2026-11-02T21:30:00Z', null, '[]');
update public.weapon_camo_progress set current_count = 123, unlocked_at = '2026-11-03T10:00:00Z'
  where weapon_id = 'w2' and camo_id = 'test-camo';
insert into public.easter_egg_step_progress (step_id, done_at) values ('test-ee-1', '2026-11-04T10:00:00Z');
insert into public.easter_egg_completions (easter_egg_id, completed_at, players, notes)
  values ('test-ee', '2026-11-05T10:00:00Z', 3, 'à primeira');
insert into public.challenge_progress (challenge_id, current_count) values ('test-ch', 2);

insert into snap values ('a1', public.export_progress());

select is((select data->>'format' from snap where name = 'a1'), 'bo4-zombies-companion', 'formato no export');
select is((select data->>'version' from snap where name = 'a1'), '1', 'versão no export');
select is((select jsonb_array_length(data->'sessions') from snap where name = 'a1'), 2, 'export tem as 2 sessões');
select is((select jsonb_array_length(data->'sessions'->0->'weapon_stats') from snap where name = 'a1'), 2,
  'export tem as stats por arma');
select ok((select not (data::text like '%11111111-1111%') from snap where name = 'a1'), 'export não contém o user_id');

-- ---------- Round trip na mesma conta ----------
-- Estragar o estado atual; o import tem de o substituir por completo.
select public.record_session('test-map', 2, 'normal', 1, now(), null, '[{"weapon_id":"w1","kills":1,"headshots":0}]');
delete from public.easter_egg_completions;
insert into public.easter_egg_step_progress (step_id) values ('test-ee-2');

-- As contagens devolvidas têm de bater certo com o tamanho de cada coleção do ficheiro
-- (o catálogo real do seed também tem camos de kills, por isso não se fixam números).
select is(
  public.import_progress((select data from snap where name = 'a1')),
  (select jsonb_object_agg(k, jsonb_array_length(data->k))
   from snap, unnest(array['sessions', 'challenge_progress', 'weapon_camo_progress',
                           'easter_egg_completions', 'easter_egg_step_progress']) as k
   where name = 'a1'),
  'import devolve as contagens de cada coleção');
insert into snap values ('a2', public.export_progress());
select is((select data - 'exported_at' from snap where name = 'a2'),
          (select data - 'exported_at' from snap where name = 'a1'),
          'export → import → export é idêntico (sem perda de dados)');
select is((select current_count from public.weapon_camo_progress where weapon_id = 'w1' and camo_id = 'test-camo'), 40,
  'as sessões importadas não voltam a somar aos camos');

-- ---------- Importar noutra conta ----------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ select public.import_progress((select data from snap where name = 'a1')) $$,
  'B importa o backup de A (ids novos, sem colisões)');
insert into snap values ('b1', public.export_progress());
select is((select data - 'exported_at' from snap where name = 'b1'),
          (select data - 'exported_at' from snap where name = 'a1'),
          'B fica com o mesmo progresso que A tinha');

-- ---------- Erros: nada muda ----------
select throws_ok($$ select public.import_progress('{"format":"outro","version":1}') $$, '22023', null,
  'formato desconhecido é recusado');
select throws_ok($$ select public.import_progress('{"format":"bo4-zombies-companion","version":2}') $$, '22023', null,
  'versão desconhecida é recusada');
select throws_ok(
  $$ select public.import_progress('{"format":"bo4-zombies-companion","version":1,"weapon_camo_progress":[{"weapon_id":"nao-existe","camo_id":"test-camo","current_count":1,"unlocked_at":null}]}') $$,
  '23503', null, 'referência a arma inexistente é recusada');
insert into snap values ('b2', public.export_progress());
select is((select data - 'exported_at' from snap where name = 'b2'),
          (select data - 'exported_at' from snap where name = 'b1'),
          'import falhado não altera nada (atómico)');

-- ---------- A não foi afetado pelos imports de B ----------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into snap values ('a3', public.export_progress());
select is((select data - 'exported_at' from snap where name = 'a3'),
          (select data - 'exported_at' from snap where name = 'a1'),
          'o progresso de A ficou intacto');

reset role;
set local role anon;
select throws_ok($$ select public.export_progress() $$, '42501', null, 'anon não pode exportar');

select * from finish();
rollback;
