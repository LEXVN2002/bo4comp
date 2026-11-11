-- RLS em todas as tabelas.
-- Catálogo: só select para authenticated (escrita apenas pelo seed, como postgres).
-- Progresso: select/insert/update/delete só nas linhas com user_id = auth.uid().

-- ---------- Catálogo ----------
alter table public.maps enable row level security;
alter table public.weapons enable row level security;
alter table public.camos enable row level security;
alter table public.easter_eggs enable row level security;
alter table public.easter_egg_steps enable row level security;
alter table public.challenges enable row level security;

create policy "catalog: authenticated read" on public.maps
  for select to authenticated using (true);
create policy "catalog: authenticated read" on public.weapons
  for select to authenticated using (true);
create policy "catalog: authenticated read" on public.camos
  for select to authenticated using (true);
create policy "catalog: authenticated read" on public.easter_eggs
  for select to authenticated using (true);
create policy "catalog: authenticated read" on public.easter_egg_steps
  for select to authenticated using (true);
create policy "catalog: authenticated read" on public.challenges
  for select to authenticated using (true);

-- Defesa em profundidade: mesmo sem políticas de escrita, retirar os privilégios.
revoke insert, update, delete, truncate on
  public.maps, public.weapons, public.camos,
  public.easter_eggs, public.easter_egg_steps, public.challenges
from anon, authenticated;

-- ---------- Progresso ----------
alter table public.weapon_camo_progress enable row level security;
alter table public.easter_egg_step_progress enable row level security;
alter table public.easter_egg_completions enable row level security;
alter table public.challenge_progress enable row level security;
alter table public.sessions enable row level security;
alter table public.session_weapon_stats enable row level security;

-- (select auth.uid()) é avaliado uma vez por query em vez de uma vez por linha.
create policy "progress: own rows" on public.weapon_camo_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own rows" on public.easter_egg_step_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own rows" on public.easter_egg_completions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own rows" on public.challenge_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own rows" on public.sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- session_weapon_stats não tem user_id: o dono é o da sessão.
create policy "progress: own session rows" on public.session_weapon_stats
  for all to authenticated
  using (exists (
    select 1 from public.sessions s
    where s.id = session_weapon_stats.session_id
      and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_weapon_stats.session_id
      and s.user_id = (select auth.uid())
  ));

-- ---------- anon ----------
-- Visitantes sem sessão não leem nem escrevem nada.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
