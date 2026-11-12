-- Lógica de progresso de camos.
-- As funções são SECURITY INVOKER: correm com as permissões e o RLS de quem chama.

-- Desbloqueia camos 'prereq_all' (mastery) das armas indicadas quando todos os
-- camos de tier inferior dessa arma estão desbloqueados. Por ordem de tier,
-- para que um desbloqueio possa encadear o seguinte (ex.: Gold -> Diamond).
-- A UI também a chama depois de um desbloqueio manual.
create function public.unlock_mastery_camos(p_weapon_ids text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_camo record;
begin
  if v_user is null then
    raise exception 'unlock_mastery_camos: utilizador não autenticado' using errcode = '42501';
  end if;

  for v_camo in
    select c.id, c.tier from public.camos c
    where c.requirement_type = 'prereq_all'
    order by c.tier
  loop
    insert into public.weapon_camo_progress as p (user_id, weapon_id, camo_id, current_count, unlocked_at)
    select v_user, w.id, v_camo.id, 0, now()
    from public.weapons w
    where w.id = any(p_weapon_ids)
      -- tem de haver pelo menos um camo anterior...
      and exists (select 1 from public.camos prev where prev.tier < v_camo.tier)
      -- ...e nenhum camo anterior pode estar por desbloquear nesta arma.
      and not exists (
        select 1 from public.camos prev
        where prev.tier < v_camo.tier
          and not exists (
            select 1 from public.weapon_camo_progress done
            where done.user_id = v_user
              and done.weapon_id = w.id
              and done.camo_id = prev.id
              and done.unlocked_at is not null
          )
      )
    on conflict (user_id, weapon_id, camo_id) do update
      set unlocked_at = excluded.unlocked_at
      where p.unlocked_at is null;
  end loop;
end;
$$;

-- Grava uma sessão manual com as stats por arma e atualiza o progresso de camos:
--   * soma kills/headshots ao current_count dos camos ainda bloqueados;
--   * marca unlocked_at quando current_count >= requirement_value;
--   * camos com requirement_value null (ou tipo 'unknown') nunca desbloqueiam sozinhos;
--   * no fim, tenta desbloquear os camos 'prereq_all' das armas usadas.
-- p_weapon_stats: [{"weapon_id": "saug-9mm", "kills": 120, "headshots": 30}, ...]
-- Armas repetidas no array são somadas.
create function public.record_session(
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
  v_weapon_ids text[];
begin
  if v_user is null then
    raise exception 'record_session: utilizador não autenticado' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_weapon_stats, '[]'::jsonb)) <> 'array' then
    raise exception 'record_session: p_weapon_stats tem de ser um array JSON' using errcode = '22023';
  end if;

  insert into public.sessions (user_id, map_id, played_at, round_reached, mode, players, source, notes)
  values (v_user, p_map_id, coalesce(p_played_at, now()), p_round_reached,
          coalesce(p_mode, 'normal'), coalesce(p_players, 1), 'manual', p_notes)
  returning id into v_session_id;

  insert into public.session_weapon_stats (session_id, weapon_id, kills, headshots)
  select v_session_id, x.weapon_id, sum(coalesce(x.kills, 0)), sum(coalesce(x.headshots, 0))
  from jsonb_to_recordset(coalesce(p_weapon_stats, '[]'::jsonb))
    as x(weapon_id text, kills int, headshots int)
  group by x.weapon_id;

  select coalesce(array_agg(s.weapon_id), '{}') into v_weapon_ids
  from public.session_weapon_stats s
  where s.session_id = v_session_id;

  -- Somar aos camos de contagem ainda bloqueados (cria a linha se não existir).
  insert into public.weapon_camo_progress as p (user_id, weapon_id, camo_id, current_count)
  select v_user, s.weapon_id, c.id,
         case c.requirement_type when 'kills' then s.kills else s.headshots end
  from public.session_weapon_stats s
  cross join public.camos c
  where s.session_id = v_session_id
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

  return v_session_id;
end;
$$;

revoke execute on function public.unlock_mastery_camos(text[]) from public, anon;
revoke execute on function public.record_session(text, int, text, int, timestamptz, text, jsonb) from public, anon;
grant execute on function public.unlock_mastery_camos(text[]) to authenticated;
grant execute on function public.record_session(text, int, text, int, timestamptz, text, jsonb) to authenticated;
