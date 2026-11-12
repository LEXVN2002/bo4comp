import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '../../lib/database.types';
import { getSupabase } from '../../lib/supabase';
import type { GoalContext, GoalPeriod, GoalType } from './goalProgress';

export type GoalRow = Tables<'goals'>;
const goalsKey = ['goals'] as const;

export function useGoals() {
  return useQuery({
    queryKey: goalsKey,
    queryFn: async (): Promise<GoalRow[]> => {
      const { data, error } = await getSupabase().from('goals').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export interface NewGoal {
  title: string;
  type: GoalType;
  target: number;
  weaponId: string | null;
  weaponClass: string | null;
  camoId: string | null;
  period: GoalPeriod;
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (g: NewGoal) => {
      const { error } = await getSupabase().from('goals').insert({
        title: g.title,
        type: g.type,
        target: g.target,
        weapon_id: g.weaponId,
        weapon_class: g.weaponClass,
        camo_id: g.camoId,
        period: g.period,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey }),
  });
}

/** Arquivar (sai dos ativos) ou repor. */
export function useArchiveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await getSupabase()
        .from('goals')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey }),
  });
}

/** Sessões terminadas desde `since`, com as stats por arma (para objetivos de kills/headshots). */
export function useSessionsSince(since: Date | null) {
  const iso = since?.toISOString() ?? null;
  return useQuery({
    // Debaixo de 'sessions': gravar, editar ou apagar sessões invalida isto também.
    queryKey: ['sessions', 'since', iso],
    enabled: iso !== null,
    queryFn: async (): Promise<GoalContext['sessions']> => {
      const { data, error } = await getSupabase()
        .from('sessions')
        .select('played_at, session_weapon_stats(weapon_id, kills, headshots)')
        .eq('status', 'done')
        .gte('played_at', iso!)
        .order('played_at', { ascending: false });
      if (error) throw error;
      return data.map((s) => ({ played_at: s.played_at, stats: s.session_weapon_stats }));
    },
  });
}
