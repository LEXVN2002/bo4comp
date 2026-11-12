// Sessão ao vivo do modo grind e definições de som do utilizador.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionMode } from '@bo4/shared';
import { getSupabase } from '../../lib/supabase';
import { camoProgressKey } from '../camos/queries';
import { sessionsKey } from '../sessions/queries';
import type { WeaponTally } from './tally';

export interface LiveSession {
  id: string;
  map_id: string;
  mode: string;
  players: number;
  played_at: string;
  counts: Record<string, WeaponTally>;
}

const liveKey = [...sessionsKey, 'live'] as const;

/** A sessão ao vivo do utilizador, se existir (há no máximo uma). */
export function useLiveSession() {
  return useQuery({
    queryKey: liveKey,
    queryFn: async (): Promise<LiveSession | null> => {
      const { data, error } = await getSupabase()
        .from('sessions')
        .select('id, map_id, mode, players, played_at, session_weapon_stats(weapon_id, kills, headshots)')
        .eq('status', 'live')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        map_id: data.map_id,
        mode: data.mode,
        players: data.players,
        played_at: data.played_at,
        counts: Object.fromEntries(
          data.session_weapon_stats.map((s) => [s.weapon_id, { kills: s.kills, headshots: s.headshots }]),
        ),
      };
    },
  });
}

export function useStartLiveSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { mapId: string; mode: SessionMode; players: number }) => {
      const { data, error } = await getSupabase()
        .from('sessions')
        .insert({ map_id: input.mapId, mode: input.mode, players: input.players, status: 'live' })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveKey }),
  });
}

/** Grava as contagens atuais da sessão ao vivo (valores absolutos por arma). */
export async function saveLiveStats(sessionId: string, stats: { weapon_id: string; kills: number; headshots: number }[]) {
  if (stats.length === 0) return;
  const { error } = await getSupabase()
    .from('session_weapon_stats')
    .upsert(
      stats.map((s) => ({ session_id: sessionId, ...s })),
      { onConflict: 'session_id,weapon_id' },
    );
  if (error) throw error;
}

export interface UnlockedCamo {
  weapon_id: string;
  camo_id: string;
}

/** Termina a sessão: grava a ronda e soma tudo ao progresso. Devolve os camos desbloqueados. */
export function useFinishLiveSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, round }: { sessionId: string; round: number }): Promise<UnlockedCamo[]> => {
      const { data, error } = await getSupabase().rpc('record_session', {
        p_session_id: sessionId,
        p_round_reached: round,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: sessionsKey }),
        queryClient.invalidateQueries({ queryKey: camoProgressKey }),
      ]),
  });
}

/** Descarta a sessão ao vivo (não mexe no progresso: nunca foi somada). */
export function useDiscardLiveSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await getSupabase().rpc('delete_session', { p_session_id: sessionId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveKey }),
  });
}

// ---------- Definições ----------

export interface UserSettings {
  player_name: string | null;
  sound_enabled: boolean;
  sound_volume: number;
}

export const DEFAULT_SETTINGS: UserSettings = { player_name: null, sound_enabled: true, sound_volume: 0.6 };
const settingsKey = ['user-settings'] as const;

export function useUserSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await getSupabase()
        .from('user_settings')
        .select('player_name, sound_enabled, sound_volume')
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, sound_volume: Number(data.sound_volume) } : DEFAULT_SETTINGS;
    },
  });
}

export function useSaveUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    // Em fila: arrastar o volume dispara vários pedidos e o último tem de ganhar.
    scope: { id: 'save-user-settings' },
    mutationFn: async (settings: UserSettings) => {
      const { error } = await getSupabase().from('user_settings').upsert(settings, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onMutate: (settings) => {
      const previous = queryClient.getQueryData<UserSettings>(settingsKey);
      queryClient.setQueryData(settingsKey, settings);
      return { previous };
    },
    onError: (_e, _s, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKey, context.previous);
    },
  });
}
