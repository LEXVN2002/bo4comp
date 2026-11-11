import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../../lib/supabase';
import { camoProgressKey } from '../camos/queries';
import type { RecordSessionPayload } from './sessionForm';

export const sessionsKey = ['sessions'] as const;

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

/** Grava a sessão via record_session (que também atualiza os contadores de camos). */
export function useRecordSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RecordSessionPayload) => {
      const { data, error } = await getSupabase().rpc('record_session', payload);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sessionsKey }),
        queryClient.invalidateQueries({ queryKey: camoProgressKey }),
      ]);
    },
  });
}
