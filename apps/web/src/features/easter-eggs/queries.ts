import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../../lib/supabase';

export interface EasterEggWithSteps {
  id: string;
  map_id: string;
  name: string;
  type: string;
  min_players: number | null;
  max_players: number | null;
  verified: boolean;
  sources: string[];
  easter_egg_steps: {
    id: string;
    step_order: number;
    section: string | null;
    title: string;
    details: string | null;
  }[];
}

export interface StepProgressRow {
  step_id: string;
  done_at: string;
}

export interface CompletionRow {
  id: string;
  easter_egg_id: string;
  completed_at: string;
  players: number | null;
  notes: string | null;
}

export const easterEggsKey = ['easter-eggs'] as const;
export const stepProgressKey = ['easter-egg-step-progress'] as const;
export const completionsKey = ['easter-egg-completions'] as const;
const toggleStepKey = ['toggle-step'] as const;

/** Easter eggs do catálogo com os passos. Mudam só quando o seed é reaplicado. */
export function useEasterEggs() {
  return useQuery({
    queryKey: easterEggsKey,
    staleTime: Infinity,
    queryFn: async (): Promise<EasterEggWithSteps[]> => {
      const { data, error } = await getSupabase()
        .from('easter_eggs')
        // Uma só string literal: o supabase-js infere o tipo a partir dela.
        .select(
          'id, map_id, name, type, min_players, max_players, verified, sources, easter_egg_steps(id, step_order, section, title, details)',
        )
        .order('id');
      if (error) throw error;
      return data;
    },
  });
}

export function useStepProgress() {
  return useQuery({
    queryKey: stepProgressKey,
    queryFn: async (): Promise<StepProgressRow[]> => {
      const { data, error } = await getSupabase().from('easter_egg_step_progress').select('step_id, done_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useCompletions() {
  return useQuery({
    queryKey: completionsKey,
    queryFn: async (): Promise<CompletionRow[]> => {
      const { data, error } = await getSupabase()
        .from('easter_egg_completions')
        .select('id, easter_egg_id, completed_at, players, notes')
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Marca/desmarca um passo com update otimista (não espera pelo servidor). */
export function useToggleStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: toggleStepKey,
    mutationFn: async ({ stepId, done }: { stepId: string; done: boolean }) => {
      const supabase = getSupabase();
      const { error } = done
        ? await supabase
            .from('easter_egg_step_progress')
            .upsert({ step_id: stepId }, { onConflict: 'user_id,step_id', ignoreDuplicates: true })
        : await supabase.from('easter_egg_step_progress').delete().eq('step_id', stepId);
      if (error) throw error;
    },
    onMutate: async ({ stepId, done }) => {
      await queryClient.cancelQueries({ queryKey: stepProgressKey });
      const previous = queryClient.getQueryData<StepProgressRow[]>(stepProgressKey);
      queryClient.setQueryData<StepProgressRow[]>(stepProgressKey, (rows = []) => {
        const others = rows.filter((r) => r.step_id !== stepId);
        return done ? [...others, { step_id: stepId, done_at: new Date().toISOString() }] : others;
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(stepProgressKey, context.previous);
    },
    onSettled: () => {
      // Com vários cliques seguidos, só refazer o pedido no fim do último.
      if (queryClient.isMutating({ mutationKey: toggleStepKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: stepProgressKey });
      }
    },
  });
}

export function useAddCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { easterEggId: string; players: number | null; notes: string | null }) => {
      const { error } = await getSupabase().from('easter_egg_completions').insert({
        easter_egg_id: input.easterEggId,
        players: input.players,
        notes: input.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: completionsKey }),
  });
}

export function useDeleteCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (completionId: string) => {
      const { error } = await getSupabase().from('easter_egg_completions').delete().eq('id', completionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: completionsKey }),
  });
}
