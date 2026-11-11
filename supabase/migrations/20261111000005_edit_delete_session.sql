-- Editar e apagar sessões (opção A):
--   apagar ou editar uma sessão desconta as kills/headshots dela dos camos
--   AINDA BLOQUEADOS; camos já desbloqueados não são alterados.
-- A lógica de contadores passa para apply_session_camo_progress, partilhada
-- por record_session, update_session e delete_session.

-- p_direction = 1  soma as stats da sessão (e desbloqueia o que atingir o requisito);
-- p_direction = -1 desconta-as dos camos bloqueados (nunca abaixo de 0).
create function public.apply_session_camo_progress(p_session_id uuid, p_direction int)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_weapon_ids text[];
begin
  if v_user is null then
    raise exception 'apply_session_camo_progress: utilizador não autenticado' using errcode = '42501';
  end if;
  if p_direction not in (1, -1) then
    raise exception 'apply_session_camo_progress: p_direction tem de ser 1 ou -1' using errcode = '22023';
  end if;
  -- O RLS só deixa ver sessões do próprio utilizador.
  if not exists (select 1 from public.sessions where id = p_session_id) then
    raise exception 'sessão não encontrada' using errcode = 'P0002';
  end if;

  if p_direction = -1 then
    update public.weapon_camo_progress p
    set current_count = greatest(
      p.current_count - case c.requirement_type when 'kills' then s.kills else s.headshots end,
      0)
    from public.session_weapon_stats s
    cross join public.camos c
    where s.session_id = p_session_id
      and c.requirement_type in ('kills', 'headshots')
      and p.user_id = v_user
      and p.weapon_id = s.weapon_id
      and p.camo_id = c.id
      and p.unlocked_at is null;
    return;
  end if;

  select coalesce(array_agg(s.weapon_id), '{}') into v_weapon_ids
  from public.session_weapon_stats s
  where s.session_id = p_session_id;

  -- Somar aos camos de contagem ainda bloqueados (cria a linha se não existir).
  insert into public.weapon_camo_progress as p (user_id, weapon_id, camo_id, current_count)
  select v_user, s.weapon_id, c.id,
         case c.requirement_type when 'kills' then s.kills else s.headshots end
  from public.session_weapon_stats s
  cross join public.camos c
  where s.session_id = p_session_id
    and c.requirement_type in ('kills', 'headshots')
    and (case c.requirement_type when 'kills' then s.kills else s.headshots end) > 0
  on conflict (user_id, weapon_id, camo_id) do update
    set current_count = p.current_count + excluded.current_count
    where p.unlocked_at is null;

  -- Desbloquear os que atingiram o requisito (só com requirement_value conhecido).
  update public.weapon_camo_progress p
  set unlocked_at = now()
  from public.camos c
  where p.camo_id = c.id
    and p.user_id = v_user
    and p.weapon_id = any(v_weapon_ids)
    and p.unlocked_at is null
    and c.requirement_type in ('kills', 'headshots')
    and c.requirement_value is not null
    and p.current_count >= c.requirement_value;

  perform public.unlock_mastery_camos(v_weapon_ids);
end;
$$;

-- Insere as stats por arma de uma sessão, somando armas repetidas no array.
create function public.insert_session_weapon_stats(p_session_id uuid, p_weapon_stats jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(coalesce(p_weapon_stats, '[]'::jsonb)) <> 'array' then
    raise exception 'p_weapon_stats tem de ser um array JSON' using errcode = '22023';
  end if;
  insert into public.session_weapon_stats (session_id, weapon_id, kills, headshots)
  select p_session_id, x.weapon_id, sum(coalesce(x.kills, 0)), sum(coalesce(x.headshots, 0))
  from jsonb_to_recordset(coalesce(p_weapon_stats, '[]'::jsonb))
    as x(weapon_id text, kills int, headshots int)
  group by x.weapon_id;
end;
$$;

-- record_session passa a usar as funções partilhadas (comportamento igual).
create or replace function public.record_session(
  p_map_id text,
  p_round_reached int,
  p_mode text default 'normal',
  p_players int default 1,
  p_played_at timestamptz default now(),
  p_notes text default null,
  p_weapon_stats jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user is null then
    raise exception 'record_session: utilizador não autenticado' using errcode = '42501';
  end if;

  insert into public.sessions (user_id, map_id, played_at, round_reached, mode, players, source, notes)
  values (v_user, p_map_id, coalesce(p_played_at, now()), p_round_reached,
          coalesce(p_mode, 'normal'), coalesce(p_players, 1), 'manual', p_notes)
  returning id into v_session_id;

  perform public.insert_session_weapon_stats(v_session_id, p_weapon_stats);
  perform public.apply_session_camo_progress(v_session_id, 1);
  return v_session_id;
end;
$$;

-- Edita uma sessão: desconta as stats antigas, substitui dados e stats, soma as novas.
-- p_played_at null mantém a data original.
create function public.update_session(
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

-- Apaga uma sessão, descontando antes as stats dela dos camos bloqueados.
create function public.delete_session(p_session_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'delete_session: utilizador não autenticado' using errcode = '42501';
  end if;
  perform public.apply_session_camo_progress(p_session_id, -1);
  delete from public.sessions where id = p_session_id;
end;
$$;

revoke execute on function public.apply_session_camo_progress(uuid, int) from public, anon;
revoke execute on function public.insert_session_weapon_stats(uuid, jsonb) from public, anon;
revoke execute on function public.update_session(uuid, text, int, text, int, timestamptz, text, jsonb) from public, anon;
revoke execute on function public.delete_session(uuid) from public, anon;
grant execute on function public.apply_session_camo_progress(uuid, int) to authenticated;
grant execute on function public.insert_session_weapon_stats(uuid, jsonb) to authenticated;
grant execute on function public.update_session(uuid, text, int, text, int, timestamptz, text, jsonb) to authenticated;
grant execute on function public.delete_session(uuid) to authenticated;
