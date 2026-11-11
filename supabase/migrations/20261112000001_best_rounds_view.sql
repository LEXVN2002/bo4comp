-- Melhor ronda e número de sessões por mapa, para o Painel.
-- security_invoker = true: a view corre com as permissões de quem consulta,
-- por isso o RLS de public.sessions continua a filtrar por auth.uid().
create view public.best_rounds
with (security_invoker = true)
as
select
  s.user_id,
  s.map_id,
  max(s.round_reached) as best_round,
  count(*)::int as session_count,
  max(s.played_at) as last_played_at
from public.sessions s
group by s.user_id, s.map_id;

revoke all on public.best_rounds from anon;
grant select on public.best_rounds to authenticated;
