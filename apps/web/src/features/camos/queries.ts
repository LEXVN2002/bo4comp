import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '../../lib/database.types';
import { getSupabase } from '../../lib/supabase';

export type CamoProgressRow = Tables<'weapon_camo_progress'>;

export const camoProgressKey = ['camo-progress'] as const;

async function fetchCamoProgress(): Promise<CamoProgressRow[]> {
  // O RLS devolve só as linhas do utilizador autenticado.
  const { data, error } = await getSupabase().from('weapon_camo_progress').select('*');
  if (error) throw error;
  return data;
}

export function useCamoProgress() {
  return useQuery({ queryKey: camoProgressKey, queryFn: fetchCamoProgress });
}

export interface SaveCamoProgressInput {
  weaponId: string;
  camoId: string;
  currentCount: number;
  unlocked: boolean;
  /** unlocked_at já guardado; mantém-se se o camo continuar desbloqueado. */
  previousUnlockedAt: string | null;
}

/**
 * Edição manual de uma célula arma × camo, com update otimista.
 * Depois de desbloquear, pede ao Postgres para verificar os camos de mastery da arma.
 */
export function useSaveCamoProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveCamoProgressInput) => {
      const supabase = getSupabase();
      const unlockedAt = input.unlocked ? (input.previousUnlockedAt ?? new Date().toISOString()) : null;
      const { error } = await supabase.from('weapon_camo_progress').upsert(
        {
          weapon_id: input.weaponId,
          camo_id: input.camoId,
          current_count: input.currentCount,
          unlocked_at: unlockedAt,
        },
        { onConflict: 'user_id,weapon_id,camo_id' },
      );
      if (error) throw error;
      if (input.unlocked) {
        const { error: rpcError } = await supabase.rpc('unlock_mastery_camos', {
          p_weapon_ids: [input.weaponId],
        });
        if (rpcError) throw rpcError;
      }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: camoProgressKey });
      const previous = queryClient.getQueryData<CamoProgressRow[]>(camoProgressKey);
      queryClient.setQueryData<CamoProgressRow[]>(camoProgressKey, (rows = []) => {
        const next: CamoProgressRow = {
          user_id: rows[0]?.user_id ?? '',
          weapon_id: input.weaponId,
          camo_id: input.camoId,
          current_count: input.currentCount,
          unlocked_at: input.unlocked ? (input.previousUnlockedAt ?? new Date().toISOString()) : null,
        };
        const others = rows.filter(
          (r) => !(r.weapon_id === input.weaponId && r.camo_id === input.camoId),
        );
        return [...others, next];
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(camoProgressKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: camoProgressKey }),
  });
}
