-- Exportar / importar todo o progresso do utilizador em JSON (backup).
-- Formato: { format: 'bo4-zombies-companion', version: 1, exported_at, ...coleções }.
-- Sem user_id nem ids gerados (sessões e conclusões recebem ids novos ao importar),
-- para o ficheiro poder ser importado noutra conta ou noutra base de dados.

create function public.export_progress()
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
    'version', 1,
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
        'weapon_stats', coalesce((
          select jsonb_agg(jsonb_build_object(
            'weapon_id', w.weapon_id, 'kills', w.kills, 'headshots', w.headshots)
            order by w.weapon_id)
          from public.session_weapon_stats w where w.session_id = s.id), '[]'::jsonb))
        order by s.played_at, s.id)
      from public.sessions s where s.user_id = v_user), '[]'::jsonb)
  );
end;
$$;

-- Substitui TODO o progresso do utilizador pelo conteúdo de p_data, atomicamente.
-- Não reaplica as sessões aos camos: os contadores vêm de weapon_camo_progress.
-- Devolve o número de linhas importadas por coleção.
create function public.import_progress(p_data jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session jsonb;
  v_session_id uuid;
  v_counts jsonb;
begin
  if v_user is null then
    raise exception 'import_progress: utilizador não autenticado' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or p_data->>'format' is distinct from 'bo4-zombies-companion' then
    raise exception 'ficheiro de backup inválido' using errcode = '22023';
  end if;
  if p_data->>'version' is distinct from '1' then
    raise exception 'versão de backup não suportada: %', p_data->>'version' using errcode = '22023';
  end if;

  -- Apagar o progresso atual (session_weapon_stats vai em cascata).
  delete from public.sessions where user_id = v_user;
  delete from public.weapon_camo_progress where user_id = v_user;
  delete from public.easter_egg_step_progress where user_id = v_user;
  delete from public.easter_egg_completions where user_id = v_user;
  delete from public.challenge_progress where user_id = v_user;

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
    insert into public.sessions (user_id, map_id, played_at, round_reached, mode, players, source, notes)
    values (
      v_user,
      v_session->>'map_id',
      coalesce((v_session->>'played_at')::timestamptz, now()),
      (v_session->>'round_reached')::int,
      coalesce(v_session->>'mode', 'normal'),
      coalesce((v_session->>'players')::int, 1),
      coalesce(v_session->>'source', 'manual'),
      v_session->>'notes'
    )
    returning id into v_session_id;
    perform public.insert_session_weapon_stats(v_session_id, coalesce(v_session->'weapon_stats', '[]'::jsonb));
  end loop;

  select jsonb_build_object(
    'weapon_camo_progress', (select count(*) from public.weapon_camo_progress where user_id = v_user),
    'easter_egg_step_progress', (select count(*) from public.easter_egg_step_progress where user_id = v_user),
    'easter_egg_completions', (select count(*) from public.easter_egg_completions where user_id = v_user),
    'challenge_progress', (select count(*) from public.challenge_progress where user_id = v_user),
    'sessions', (select count(*) from public.sessions where user_id = v_user)
  ) into v_counts;
  return v_counts;
end;
$$;

revoke execute on function public.export_progress() from public, anon;
revoke execute on function public.import_progress(jsonb) from public, anon;
grant execute on function public.export_progress() to authenticated;
grant execute on function public.import_progress(jsonb) to authenticated;
