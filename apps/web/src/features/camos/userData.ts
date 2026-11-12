// Dados do utilizador ligados à aba de camos: overrides de requisitos, armas afixadas e notas.
// Tudo protegido por RLS (user_id = auth.uid()); o user_id é preenchido pelo default da coluna.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '../../lib/database.types';
import { getSupabase } from '../../lib/supabase';

export type CamoOverrideRow = Tables<'user_camo_overrides'>;
export type PinnedWeaponRow = Tables<'pinned_weapons'>;
export type CamoNoteRow = Tables<'camo_notes'>;

export const overridesKey = ['camo-overrides'] as const;
export const pinnedKey = ['pinned-weapons'] as const;
const camoNotesKey = (weaponId: string) => ['camo-notes', weaponId] as const;
const weaponNoteKey = (weaponId: string) => ['weapon-note', weaponId] as const;

// ---------- Overrides ----------

export function useCamoOverrides() {
  return useQuery({
    queryKey: overridesKey,
    queryFn: async (): Promise<CamoOverrideRow[]> => {
      const { data, error } = await getSupabase().from('user_camo_overrides').select('*');
      if (error) throw error;
      return data;
    },
  });
}

export interface OverrideInput {
  camoId: string;
  requirementType: 'kills' | 'headshots' | null;
  requirementValue: number | null;
  requirementText: string | null;
}

/** Grava (ou apaga, se ficar tudo vazio) o override de um camo. */
export function useSaveOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: OverrideInput) => {
      const supabase = getSupabase();
      const empty = input.requirementType === null && input.requirementValue === null && !input.requirementText;
      const { error } = empty
        ? await supabase.from('user_camo_overrides').delete().eq('camo_id', input.camoId)
        : await supabase.from('user_camo_overrides').upsert(
            {
              camo_id: input.camoId,
              requirement_type: input.requirementType,
              requirement_value: input.requirementValue,
              requirement_text: input.requirementText,
            },
            { onConflict: 'user_id,camo_id' },
          );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: overridesKey }),
  });
}

// ---------- Armas afixadas ----------

export function usePinnedWeapons() {
  return useQuery({
    queryKey: pinnedKey,
    queryFn: async (): Promise<PinnedWeaponRow[]> => {
      const { data, error } = await getSupabase()
        .from('pinned_weapons')
        .select('*')
        .order('sort_order')
        .order('pinned_at');
      if (error) throw error;
      return data;
    },
  });
}

/** Afixa (no fim da lista) ou desafixa uma arma, com update otimista. */
export function useTogglePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ weaponId, pinned }: { weaponId: string; pinned: boolean }) => {
      const supabase = getSupabase();
      if (!pinned) {
        const { error } = await supabase.from('pinned_weapons').delete().eq('weapon_id', weaponId);
        if (error) throw error;
        return;
      }
      const rows = queryClient.getQueryData<PinnedWeaponRow[]>(pinnedKey) ?? [];
      const sortOrder = rows.reduce((max, r) => Math.max(max, r.sort_order + 1), 0);
      const { error } = await supabase
        .from('pinned_weapons')
        .upsert({ weapon_id: weaponId, sort_order: sortOrder }, { onConflict: 'user_id,weapon_id' });
      if (error) throw error;
    },
    onMutate: async ({ weaponId, pinned }) => {
      await queryClient.cancelQueries({ queryKey: pinnedKey });
      const previous = queryClient.getQueryData<PinnedWeaponRow[]>(pinnedKey);
      queryClient.setQueryData<PinnedWeaponRow[]>(pinnedKey, (rows = []) => {
        const others = rows.filter((r) => r.weapon_id !== weaponId);
        if (!pinned) return others;
        const sortOrder = rows.reduce((max, r) => Math.max(max, r.sort_order + 1), 0);
        return [
          ...others,
          { user_id: '', weapon_id: weaponId, sort_order: sortOrder, pinned_at: new Date().toISOString() },
        ];
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(pinnedKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: pinnedKey }),
  });
}

// ---------- Notas ----------

export function useCamoNotes(weaponId: string) {
  return useQuery({
    queryKey: camoNotesKey(weaponId),
    queryFn: async (): Promise<CamoNoteRow[]> => {
      const { data, error } = await getSupabase().from('camo_notes').select('*').eq('weapon_id', weaponId);
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveCamoNote(weaponId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ camoId, body }: { camoId: string; body: string }) => {
      const { error } = await getSupabase()
        .from('camo_notes')
        .upsert({ weapon_id: weaponId, camo_id: camoId, body }, { onConflict: 'user_id,weapon_id,camo_id' });
      if (error) throw error;
    },
    onSuccess: (_data, { camoId, body }) => {
      // Atualizar a cache sem refazer o pedido: o texto no ecrã já é o gravado.
      queryClient.setQueryData<CamoNoteRow[]>(camoNotesKey(weaponId), (rows = []) => [
        ...rows.filter((r) => r.camo_id !== camoId),
        { user_id: '', weapon_id: weaponId, camo_id: camoId, body, updated_at: new Date().toISOString() },
      ]);
    },
  });
}

export function useWeaponNote(weaponId: string) {
  return useQuery({
    queryKey: weaponNoteKey(weaponId),
    queryFn: async (): Promise<string> => {
      const { data, error } = await getSupabase()
        .from('weapon_notes')
        .select('body')
        .eq('weapon_id', weaponId)
        .maybeSingle();
      if (error) throw error;
      return data?.body ?? '';
    },
  });
}

export function useSaveWeaponNote(weaponId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await getSupabase()
        .from('weapon_notes')
        .upsert({ weapon_id: weaponId, body }, { onConflict: 'user_id,weapon_id' });
      if (error) throw error;
    },
    onSuccess: (_data, body) => queryClient.setQueryData(weaponNoteKey(weaponId), body),
  });
}
