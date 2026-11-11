// Tipos partilhados entre a app web e (na Fase 3) a app desktop.
// Os tipos do catálogo vêm dos schemas Zod de @bo4/game-data;
// os do progresso espelham as tabelas em supabase/migrations.

export type {
  Camo,
  Challenge,
  EasterEgg,
  EasterEggStep,
  GameData,
  GameMap,
  Weapon,
} from '@bo4/game-data/schemas';

export const SESSION_MODES = [
  'casual',
  'normal',
  'hardcore',
  'realistic',
  'rush',
  'gauntlet',
] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const SESSION_SOURCES = ['manual', 'api', 'ocr'] as const;
export type SessionSource = (typeof SESSION_SOURCES)[number];

/** Datas chegam do Supabase como strings ISO 8601. */
type Timestamp = string;

export interface WeaponCamoProgress {
  user_id: string;
  weapon_id: string;
  camo_id: string;
  current_count: number;
  unlocked_at: Timestamp | null;
}

export interface EasterEggStepProgress {
  user_id: string;
  step_id: string;
  done_at: Timestamp;
}

export interface EasterEggCompletion {
  id: string;
  user_id: string;
  easter_egg_id: string;
  completed_at: Timestamp;
  players: number | null;
  notes: string | null;
}

export interface ChallengeProgress {
  user_id: string;
  challenge_id: string;
  current_count: number;
  completed_at: Timestamp | null;
}

export interface Session {
  id: string;
  user_id: string;
  map_id: string;
  played_at: Timestamp;
  round_reached: number;
  mode: SessionMode;
  players: number;
  source: SessionSource;
  notes: string | null;
}

export interface SessionWeaponStats {
  session_id: string;
  weapon_id: string;
  kills: number;
  headshots: number;
}

/** Argumentos da função Postgres public.record_session. */
export interface RecordSessionArgs {
  p_map_id: string;
  p_round_reached: number;
  p_mode?: SessionMode;
  p_players?: number;
  p_played_at?: Timestamp;
  p_notes?: string | null;
  p_weapon_stats?: Pick<SessionWeaponStats, 'weapon_id' | 'kills' | 'headshots'>[];
}
