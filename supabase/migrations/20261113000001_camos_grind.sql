-- Aba de camos e grind (docs/CAMOS.md, secção 10).
--   * tabelas de utilizador: overrides de requisitos, armas afixadas, notas, objetivos, definições;
--   * sessões 'live' (modo grind): só contam para o progresso quando terminadas;
--   * o progresso de camos passa a usar o requisito efetivo (override do utilizador > catálogo);
--   * backup passa à versão 2 (aceita a 1).

-- ---------- Tabelas ----------

-- requirement_type no override (extensão à spec): quase todos os camos do catálogo têm tipo
-- 'unknown', e sem saber se contam kills ou headshots o contador não pode avançar.
create table public.user_camo_overrides (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  camo_id text not null references public.camos (id),
  requirement_type text check (requirement_type in ('kills', 'headshots')),
  requirement_text text,
  requirement_value int check (requirement_value > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, camo_id)
);

create table public.pinned_weapons (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weapon_id text not null references public.weapons (id),
  sort_order int not null default 0,
  pinned_at timestamptz not null default now(),
  primary key (user_id, weapon_id)
);

create table public.camo_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weapon_id text not null references public.weapons (id),
  camo_id text not null references public.camos (id),
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, weapon_id, camo_id)
);

create table public.weapon_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weapon_id text not null references public.weapons (id),
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, weapon_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  type text not null check (type in ('camo_count', 'weapon_camo', 'kills', 'headshots')),
  target int not null check (target > 0),
  weapon_id text references public.weapons (id),
  -- Manter em sincronia com WEAPON_CLASSES em packages/game-data/schemas.ts.
  weapon_class text check (weapon_class in (
    'smg', 'ar', 'tactical', 'lmg', 'sniper', 'pistol', 'shotgun', 'launcher', 'melee', 'special'
  )),
  camo_id text references public.camos (id),
  period text not null default 'none' check (period in ('daily', 'weekly', 'none')),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint goals_weapon_camo_fields
    check (type <> 'weapon_camo' or (weapon_id is not null and camo_id is not null)),
  constraint goals_camo_only_for_weapon_camo
    check (type = 'weapon_camo' or camo_id is null)
);

create index goals_user_active_idx on public.goals (user_id) where archived_at is null;

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  player_name text,
  sound_enabled boolean not null default true,
  sound_volume numeric not null default 0.6 check (sound_volume between 0 and 1),
  updated_at timestamptz not null default now()
);

-- ---------- Sessões ao vivo ----------
alter table public.sessions
  add column status text not null default 'done' check (status in ('live', 'done')),
  alter column round_reached drop not null;

alter table public.sessions
  add constraint round_required_when_done check (status = 'live' or round_reached is not null);

-- No máximo uma sessão ao vivo por utilizador (o /grind oferece retomar ou descartar).
create unique index sessions_one_live_per_user on public.sessions (user_id) where status = 'live';

-- Para as estimativas por arma. (sessions (user_id, played_at desc) já existe.)
create index session_weapon_stats_weapon_idx on public.session_weapon_stats (weapon_id);

-- ---------- updated_at automático ----------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_updated_at before update on public.user_camo_overrides
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.camo_notes
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.weapon_notes
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
alter table public.user_camo_overrides enable row level security;
alter table public.pinned_weapons enable row level security;
alter table public.camo_notes enable row level security;
alter table public.weapon_notes enable row level security;
alter table public.goals enable row level security;
alter table public.user_settings enable row level security;

create policy "progress: own rows" on public.user_camo_overrides
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own rows" on public.pinned_weapons
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own rows" on public.camo_notes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own rows" on public.weapon_notes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own rows" on public.goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own rows" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on
  public.user_camo_overrides, public.pinned_weapons, public.camo_notes,
  public.weapon_notes, public.goals, public.user_settings
from anon;

-- ---------- Painel: só sessões terminadas ----------
create or replace view public.best_rounds
with (security_invoker = true)
as
select
  s.user_id,
  s.map_id,
  max(s.round_reached) as best_round,
  count(*)::int as session_count,
  max(s.played_at) as last_played_at
from public.sessions s
where s.status = 'done'
group by s.user_id, s.map_id;

-- ---------- Progresso de camos com requisito efetivo ----------
-- Requisito efetivo de cada camo para o utilizador atual: o override ganha ao catálogo.
-- Nota: mudar o tipo de um override depois de haver sessões contadas não recalcula o passado.
create function public.effective_camo_requirements()
returns table (camo_id text, requirement_type text, requirement_value int)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id,
         coalesce(o.requirement_type, c.requirement_type),
         coalesce(o.requirement_value, c.requirement_value)
  from public.camos c
  left join public.user_camo_overrides o
    on o.camo_id = c.id and o.user_id = (select auth.uid())
$$;

-- p_direction = 1  soma as stats de uma sessão 'done' (e desbloqueia o que atingir o requisito);
-- p_direction = -1 desconta-as dos camos bloqueados. Sessões 'live' nunca foram somadas,
-- por isso descontar não faz nada e somar é recusado.
create or replace function public.apply_session_camo_progress(p_session_id uuid, p_direction int)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_weapon_ids text[];
begin
  if v_user is null then
    raise exception 'apply_session_camo_progress: utilizador não autenticado' using errcode = '42501';
  end if;
  if p_direction not in (1, -1) then
    raise exception 'apply_session_camo_progress: p_direction tem de ser 1 ou -1' using errcode = '22023';
  end if;
  -- O RLS só deixa ver sessões do próprio utilizador.
  select status into v_status from public.sessions where id = p_session_id;
  if not found then
    raise exception 'sessão não encontrada' using errcode = 'P0002';
  end if;
  if v_status = 'live' then
    if p_direction = -1 then
      return;
    end if;
    raise exception 'uma sessão ao vivo só conta depois de terminada' using errcode = '22023';
  end if;

  if p_direction = -1 then
    update public.weapon_camo_progress p
    set current_count = greatest(
      p.current_count - case r.requirement_type when 'kills' then s.kills else s.headshots end,
      0)
    from public.session_weapon_stats s
    cross join public.effective_camo_requirements() r
    where s.session_id = p_session_id
      and r.requirement_type in ('kills', 'headshots')
      and p.user_id = v_user
      and p.weapon_id = s.weapon_id
      and p.camo_id = r.camo_id
      and p.unlocked_at is null;
    return;
  end if;

  select coalesce(array_agg(s.weapon_id), '{}') into v_weapon_ids
  from public.session_weapon_stats s
  where s.session_id = p_session_id;

  -- Somar aos camos de contagem ainda bloqueados (cria a linha se não existir).
  insert into public.weapon_camo_progress as p (user_id, weapon_id, camo_id, current_count)
  select v_user, s.weapon_id, r.camo_id,
         case r.requirement_type when 'kills' then s.kills else s.headshots end
  from public.session_weapon_stats s
  cross join public.effective_camo_requirements() r
  where s.session_id = p_session_id
    and r.requirement_type in ('kills', 'headshots')
    and (case r.requirement_type when 'kills' then s.kills else s.headshots end) > 0
  on conflict (user_id, weapon_id, camo_id) do update
    set current_count = p.current_count + excluded.current_count
    where p.unlocked_at is null;

  -- Desbloquear os que atingiram o requisito (só com requirement_value conhecido).
  update public.weapon_camo_progress p
  set unlocked_at = now()
  from public.effective_camo_requirements() r
  where p.camo_id = r.camo_id
    and p.user_id = v_user
    and p.weapon_id = any(v_weapon_ids)
    and p.unlocked_at is null
    and r.requirement_type in ('kills', 'headshots')
    and r.requirement_value is not null
    and p.current_count >= r.requirement_value;

  perform public.unlock_mastery_camos(v_weapon_ids);
end;
$$;

-- Termina uma sessão ao vivo: grava a ronda, marca-a 'done', soma as contagens ao progresso
-- e devolve os camos desbloqueados nesta chamada (para a fila de animações).
-- Overload da record_session manual: a manual continua a criar sessões já terminadas.
create function public.record_session(p_session_id uuid, p_round_reached int)
returns table (weapon_id text, camo_id text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
begin
  if v_user is null then
    raise exception 'record_session: utilizador não autenticado' using errcode = '42501';
  end if;
  if p_round_reached is null or p_round_reached < 0 then
    raise exception 'record_session: ronda inválida' using errcode = '22023';
  end if;

  select s.status into v_status from public.sessions s where s.id = p_session_id for update;
  if not found then
    raise exception 'sessão não encontrada' using errcode = 'P0002';
  end if;
  if v_status <> 'live' then
    raise exception 'a sessão já está terminada' using errcode = '22023';
  end if;

  update public.sessions s
  set status = 'done', round_reached = p_round_reached
  where s.id = p_session_id;

  perform public.apply_session_camo_progress(p_session_id, 1);

  -- now() é fixo na transação: tudo o que esta chamada desbloqueou tem unlocked_at = now().
  return query
    select p.weapon_id, p.camo_id
    from public.weapon_camo_progress p
    join public.camos c on c.id = p.camo_id
    where p.user_id = v_user
      and p.unlocked_at = now()
      and p.weapon_id in (select w.weapon_id from public.session_weapon_stats w where w.session_id = p_session_id)
    order by p.weapon_id, c.tier;
end;
$$;

-- Editar só sessões terminadas (as ao vivo editam-se no /grind).
create or replace function public.update_session(
  p_session_id uuid,
  p_map_id text,
  p_round_reached int,
  p_mode text,
  p_players int,
  p_played_at timestamptz default null,
  p_notes text default null,
  p_weapon_stats jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'update_session: utilizador não autenticado' using errcode = '42501';
  end if;
  if exists (select 1 from public.sessions where id = p_session_id and status = 'live') then
    raise exception 'não é possível editar uma sessão ao vivo' using errcode = '22023';
  end if;

  perform public.apply_session_camo_progress(p_session_id, -1);

  update public.sessions
  set map_id = p_map_id,
      round_reached = p_round_reached,
      mode = p_mode,
      players = p_players,
      played_at = coalesce(p_played_at, played_at),
      notes = p_notes
  where id = p_session_id;

  delete from public.session_weapon_stats where session_id = p_session_id;
  perform public.insert_session_weapon_stats(p_session_id, p_weapon_stats);
  perform public.apply_session_camo_progress(p_session_id, 1);
end;
$$;
-- delete_session não muda: apply_session_camo_progress(-1) já ignora sessões ao vivo,
-- por isso apagar uma sessão 'live' é descartá-la sem mexer no progresso.

revoke execute on function public.effective_camo_requirements() from public, anon;
revoke execute on function public.record_session(uuid, int) from public, anon;
grant execute on function public.effective_camo_requirements() to authenticated;
grant execute on function public.record_session(uuid, int) to authenticated;

-- ---------- Backup versão 2 ----------
create or replace function public.export_progress()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'export_progress: utilizador não autenticado' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'format', 'bo4-zombies-companion',
    'version', 2,
    'exported_at', now(),
    'weapon_camo_progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weapon_id', p.weapon_id, 'camo_id', p.camo_id,
        'current_count', p.current_count, 'unlocked_at', p.unlocked_at)
        order by p.weapon_id, p.camo_id)
      from public.weapon_camo_progress p where p.user_id = v_user), '[]'::jsonb),
    'easter_egg_step_progress', coalesce((
      select jsonb_agg(jsonb_build_object('step_id', p.step_id, 'done_at', p.done_at)
        order by p.step_id)
      from public.easter_egg_step_progress p where p.user_id = v_user), '[]'::jsonb),
    'easter_egg_completions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'easter_egg_id', c.easter_egg_id, 'completed_at', c.completed_at,
        'players', c.players, 'notes', c.notes)
        order by c.completed_at, c.easter_egg_id, c.id)
      from public.easter_egg_completions c where c.user_id = v_user), '[]'::jsonb),
    'challenge_progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'challenge_id', p.challenge_id, 'current_count', p.current_count,
        'completed_at', p.completed_at)
        order by p.challenge_id)
      from public.challenge_progress p where p.user_id = v_user), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'map_id', s.map_id, 'played_at', s.played_at, 'round_reached', s.round_reached,
        'mode', s.mode, 'players', s.players, 'source', s.source, 'notes', s.notes,
        'status', s.status,
        'weapon_stats', coalesce((
          select jsonb_agg(jsonb_build_object(
            'weapon_id', w.weapon_id, 'kills', w.kills, 'headshots', w.headshots)
            order by w.weapon_id)
          from public.session_weapon_stats w where w.session_id = s.id), '[]'::jsonb))
        order by s.played_at, s.id)
      from public.sessions s where s.user_id = v_user), '[]'::jsonb),
    'user_camo_overrides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'camo_id', o.camo_id, 'requirement_type', o.requirement_type,
        'requirement_text', o.requirement_text, 'requirement_value', o.requirement_value,
        'updated_at', o.updated_at)
        order by o.camo_id)
      from public.user_camo_overrides o where o.user_id = v_user), '[]'::jsonb),
    'pinned_weapons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weapon_id', p.weapon_id, 'sort_order', p.sort_order, 'pinned_at', p.pinned_at)
        order by p.sort_order, p.weapon_id)
      from public.pinned_weapons p where p.user_id = v_user), '[]'::jsonb),
    'camo_notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weapon_id', n.weapon_id, 'camo_id', n.camo_id, 'body', n.body, 'updated_at', n.updated_at)
        order by n.weapon_id, n.camo_id)
      from public.camo_notes n where n.user_id = v_user), '[]'::jsonb),
    'weapon_notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weapon_id', n.weapon_id, 'body', n.body, 'updated_at', n.updated_at)
        order by n.weapon_id)
      from public.weapon_notes n where n.user_id = v_user), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', g.title, 'type', g.type, 'target', g.target, 'weapon_id', g.weapon_id,
        'weapon_class', g.weapon_class, 'camo_id', g.camo_id, 'period', g.period,
        'created_at', g.created_at, 'archived_at', g.archived_at)
        order by g.created_at, g.id)
      from public.goals g where g.user_id = v_user), '[]'::jsonb),
    'user_settings', (
      select jsonb_build_object(
        'player_name', u.player_name, 'sound_enabled', u.sound_enabled,
        'sound_volume', u.sound_volume)
      from public.user_settings u where u.user_id = v_user)
  );
end;
$$;

-- Substitui TODO o progresso do utilizador pelo conteúdo de p_data, atomicamente.
-- Aceita backups da versão 1 (sem as coleções novas) e 2.
create or replace function public.import_progress(p_data jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session jsonb;
  v_session_id uuid;
  v_settings jsonb;
  v_counts jsonb;
begin
  if v_user is null then
    raise exception 'import_progress: utilizador não autenticado' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or p_data->>'format' is distinct from 'bo4-zombies-companion' then
    raise exception 'ficheiro de backup inválido' using errcode = '22023';
  end if;
  if coalesce(p_data->>'version', '') not in ('1', '2') then
    raise exception 'versão de backup não suportada: %', p_data->>'version' using errcode = '22023';
  end if;

  -- Apagar o progresso atual (session_weapon_stats vai em cascata).
  delete from public.sessions where user_id = v_user;
  delete from public.weapon_camo_progress where user_id = v_user;
  delete from public.easter_egg_step_progress where user_id = v_user;
  delete from public.easter_egg_completions where user_id = v_user;
  delete from public.challenge_progress where user_id = v_user;
  delete from public.user_camo_overrides where user_id = v_user;
  delete from public.pinned_weapons where user_id = v_user;
  delete from public.camo_notes where user_id = v_user;
  delete from public.weapon_notes where user_id = v_user;
  delete from public.goals where user_id = v_user;
  delete from public.user_settings where user_id = v_user;

  insert into public.weapon_camo_progress (user_id, weapon_id, camo_id, current_count, unlocked_at)
  select v_user, x.weapon_id, x.camo_id, coalesce(x.current_count, 0), x.unlocked_at
  from jsonb_to_recordset(coalesce(p_data->'weapon_camo_progress', '[]'::jsonb))
    as x(weapon_id text, camo_id text, current_count int, unlocked_at timestamptz);

  insert into public.easter_egg_step_progress (user_id, step_id, done_at)
  select v_user, x.step_id, coalesce(x.done_at, now())
  from jsonb_to_recordset(coalesce(p_data->'easter_egg_step_progress', '[]'::jsonb))
    as x(step_id text, done_at timestamptz);

  insert into public.easter_egg_completions (user_id, easter_egg_id, completed_at, players, notes)
  select v_user, x.easter_egg_id, coalesce(x.completed_at, now()), x.players, x.notes
  from jsonb_to_recordset(coalesce(p_data->'easter_egg_completions', '[]'::jsonb))
    as x(easter_egg_id text, completed_at timestamptz, players int, notes text);

  insert into public.challenge_progress (user_id, challenge_id, current_count, completed_at)
  select v_user, x.challenge_id, coalesce(x.current_count, 0), x.completed_at
  from jsonb_to_recordset(coalesce(p_data->'challenge_progress', '[]'::jsonb))
    as x(challenge_id text, current_count int, completed_at timestamptz);

  for v_session in select * from jsonb_array_elements(coalesce(p_data->'sessions', '[]'::jsonb))
  loop
    insert into public.sessions (user_id, map_id, played_at, round_reached, mode, players, source, notes, status)
    values (
      v_user,
      v_session->>'map_id',
      coalesce((v_session->>'played_at')::timestamptz, now()),
      (v_session->>'round_reached')::int,
      coalesce(v_session->>'mode', 'normal'),
      coalesce((v_session->>'players')::int, 1),
      coalesce(v_session->>'source', 'manual'),
      v_session->>'notes',
      coalesce(v_session->>'status', 'done')
    )
    returning id into v_session_id;
    perform public.insert_session_weapon_stats(v_session_id, coalesce(v_session->'weapon_stats', '[]'::jsonb));
  end loop;

  insert into public.user_camo_overrides (user_id, camo_id, requirement_type, requirement_text, requirement_value, updated_at)
  select v_user, x.camo_id, x.requirement_type, x.requirement_text, x.requirement_value, coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_data->'user_camo_overrides', '[]'::jsonb))
    as x(camo_id text, requirement_type text, requirement_text text, requirement_value int, updated_at timestamptz);

  insert into public.pinned_weapons (user_id, weapon_id, sort_order, pinned_at)
  select v_user, x.weapon_id, coalesce(x.sort_order, 0), coalesce(x.pinned_at, now())
  from jsonb_to_recordset(coalesce(p_data->'pinned_weapons', '[]'::jsonb))
    as x(weapon_id text, sort_order int, pinned_at timestamptz);

  insert into public.camo_notes (user_id, weapon_id, camo_id, body, updated_at)
  select v_user, x.weapon_id, x.camo_id, coalesce(x.body, ''), coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_data->'camo_notes', '[]'::jsonb))
    as x(weapon_id text, camo_id text, body text, updated_at timestamptz);

  insert into public.weapon_notes (user_id, weapon_id, body, updated_at)
  select v_user, x.weapon_id, coalesce(x.body, ''), coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_data->'weapon_notes', '[]'::jsonb))
    as x(weapon_id text, body text, updated_at timestamptz);

  insert into public.goals (user_id, title, type, target, weapon_id, weapon_class, camo_id, period, created_at, archived_at)
  select v_user, x.title, x.type, x.target, x.weapon_id, x.weapon_class, x.camo_id,
         coalesce(x.period, 'none'), coalesce(x.created_at, now()), x.archived_at
  from jsonb_to_recordset(coalesce(p_data->'goals', '[]'::jsonb))
    as x(title text, type text, target int, weapon_id text, weapon_class text, camo_id text,
         period text, created_at timestamptz, archived_at timestamptz);

  v_settings := p_data->'user_settings';
  if v_settings is not null and jsonb_typeof(v_settings) = 'object' then
    insert into public.user_settings (user_id, player_name, sound_enabled, sound_volume)
    values (
      v_user,
      v_settings->>'player_name',
      coalesce((v_settings->>'sound_enabled')::boolean, true),
      coalesce((v_settings->>'sound_volume')::numeric, 0.6)
    );
  end if;

  select jsonb_build_object(
    'weapon_camo_progress', (select count(*) from public.weapon_camo_progress where user_id = v_user),
    'easter_egg_step_progress', (select count(*) from public.easter_egg_step_progress where user_id = v_user),
    'easter_egg_completions', (select count(*) from public.easter_egg_completions where user_id = v_user),
    'challenge_progress', (select count(*) from public.challenge_progress where user_id = v_user),
    'sessions', (select count(*) from public.sessions where user_id = v_user),
    'user_camo_overrides', (select count(*) from public.user_camo_overrides where user_id = v_user),
    'pinned_weapons', (select count(*) from public.pinned_weapons where user_id = v_user),
    'camo_notes', (select count(*) from public.camo_notes where user_id = v_user),
    'weapon_notes', (select count(*) from public.weapon_notes where user_id = v_user),
    'goals', (select count(*) from public.goals where user_id = v_user),
    'user_settings', (select count(*) from public.user_settings where user_id = v_user)
  ) into v_counts;
  return v_counts;
end;
$$;
