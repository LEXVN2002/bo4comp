import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionMode } from '@bo4/shared';
import { getSupabase } from '../../lib/supabase';
import { camoProgressKey } from '../camos/queries';
import type { RecordSessionPayload } from './sessionSchema';

export const sessionsKey = ['sessions'] as const;

const SESSION_COLUMNS =
  'id, map_id, played_at, round_reached, mode, players, source, notes, session_weapon_stats(weapon_id, kills, headshots)';

export interface SessionWithStats {
  id: string;
  map_id: string;
  played_at: string;
  round_reached: number;
  mode: string;
  players: number;
  source: string;
  notes: string | null;
  session_weapon_stats: { weapon_id: string; kills: number; headshots: number }[];
}

/**
 * Sessões terminadas têm sempre ronda (constraint round_required_when_done).
 * As consultas filtram status = 'done'; isto só estreita o tipo.
 */
export function isFinished<S extends { round_reached: number | null }>(
  session: S,
): session is S & { round_reached: number } {
  return session.round_reached !== null;
}

/** Última sessão registada: serve para pré-selecionar mapa, modo e jogadores. */
export function useLastSession() {
  return useQuery({
    queryKey: [...sessionsKey, 'last'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('sessions')
        .select('map_id, mode, players')
        .order('played_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export interface SessionFilters {
  mapId: string | null;
  mode: SessionMode | null;
}

export const SESSIONS_PAGE_SIZE = 25;

/** Histórico paginado (mais recentes primeiro), com filtros por mapa e modo. */
export function useSessions(filters: SessionFilters) {
  return useInfiniteQuery({
    queryKey: [...sessionsKey, 'list', filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<SessionWithStats[]> => {
      let query = getSupabase()
        .from('sessions')
        .select(SESSION_COLUMNS)
        .eq('status', 'done')
        .order('played_at', { ascending: false })
        .order('id', { ascending: false })
        .range(pageParam * SESSIONS_PAGE_SIZE, (pageParam + 1) * SESSIONS_PAGE_SIZE - 1);
      if (filters.mapId) query = query.eq('map_id', filters.mapId);
      if (filters.mode) query = query.eq('mode', filters.mode);
      const { data, error } = await query;
      if (error) throw error;
      return data.filter(isFinished);
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SESSIONS_PAGE_SIZE ? pages.length : undefined,
  });
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: [...sessionsKey, 'detail', sessionId],
    queryFn: async (): Promise<SessionWithStats | null> => {
      const { data, error } = await getSupabase()
        .from('sessions')
        .select(SESSION_COLUMNS)
        .eq('id', sessionId)
        .eq('status', 'done')
        .maybeSingle();
      if (error) throw error;
      return data && isFinished(data) ? data : null;
    },
  });
}

function useInvalidateAfterSessionChange() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: sessionsKey }),
      queryClient.invalidateQueries({ queryKey: camoProgressKey }),
    ]);
}

/** Grava a sessão via record_session (que também atualiza os contadores de camos). */
export function useRecordSession() {
  const invalidate = useInvalidateAfterSessionChange();
  return useMutation({
    mutationFn: async (payload: RecordSessionPayload) => {
      const { data, error } = await getSupabase().rpc('record_session', payload);
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Edita via update_session: desconta as stats antigas dos camos bloqueados e soma as novas. */
export function useUpdateSession() {
  const invalidate = useInvalidateAfterSessionChange();
  return useMutation({
    mutationFn: async ({ sessionId, payload }: { sessionId: string; payload: RecordSessionPayload }) => {
      const { error } = await getSupabase().rpc('update_session', {
        p_session_id: sessionId,
        ...payload,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Apaga via delete_session: desconta as stats da sessão dos camos ainda bloqueados. */
export function useDeleteSession() {
  const invalidate = useInvalidateAfterSessionChange();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await getSupabase().rpc('delete_session', { p_session_id: sessionId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
