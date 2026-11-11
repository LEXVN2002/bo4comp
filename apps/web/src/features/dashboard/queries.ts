import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '../../lib/supabase';
import { sessionsKey, type SessionWithStats } from '../sessions/queries';

export interface BestRound {
  map_id: string;
  best_round: number;
  session_count: number;
  last_played_at: string | null;
}

/** Melhor ronda e nº de sessões por mapa (view best_rounds, filtrada pelo RLS). */
export function useBestRounds() {
  return useQuery({
    // Debaixo de sessionsKey: gravar/editar/apagar sessões invalida também isto.
    queryKey: [...sessionsKey, 'best-rounds'],
    queryFn: async (): Promise<BestRound[]> => {
      const { data, error } = await getSupabase()
        .from('best_rounds')
        .select('map_id, best_round, session_count, last_played_at');
      if (error) throw error;
      return data.map((r) => ({
        map_id: r.map_id ?? '',
        best_round: r.best_round ?? 0,
        session_count: r.session_count ?? 0,
        last_played_at: r.last_played_at,
      }));
    },
  });
}

export function useRecentSessions(limit: number) {
  return useQuery({
    queryKey: [...sessionsKey, 'recent', limit],
    queryFn: async (): Promise<SessionWithStats[]> => {
      const { data, error } = await getSupabase()
        .from('sessions')
        .select(
          'id, map_id, played_at, round_reached, mode, players, source, notes, session_weapon_stats(weapon_id, kills, headshots)',
        )
        .order('played_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}
