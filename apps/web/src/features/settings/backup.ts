import { z } from 'zod';

export const BACKUP_FORMAT = 'bo4-zombies-companion';
/** Versão que o export gera hoje; a 1 (sem as coleções da aba de camos) continua a ser aceite. */
export const BACKUP_VERSION = 2;
const SUPPORTED_VERSIONS = [1, 2] as const;

const timestamp = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'data inválida');
const count = z.number().int().min(0);

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT, { message: 'não é um backup do BO4 Zombies Companion' }),
  version: z.union(
    SUPPORTED_VERSIONS.map((v) => z.literal(v)),
    { message: `versão não suportada (esperada ${SUPPORTED_VERSIONS.join(' ou ')})` },
  ),
  exported_at: timestamp,
  weapon_camo_progress: z.array(
    z.object({ weapon_id: z.string(), camo_id: z.string(), current_count: count, unlocked_at: timestamp.nullable() }),
  ),
  easter_egg_step_progress: z.array(z.object({ step_id: z.string(), done_at: timestamp })),
  easter_egg_completions: z.array(
    z.object({
      easter_egg_id: z.string(),
      completed_at: timestamp,
      players: z.number().int().min(1).max(4).nullable(),
      notes: z.string().nullable(),
    }),
  ),
  challenge_progress: z.array(
    z.object({ challenge_id: z.string(), current_count: count, completed_at: timestamp.nullable() }),
  ),
  sessions: z.array(
    z
      .object({
        map_id: z.string(),
        played_at: timestamp,
        round_reached: count.nullable(),
        mode: z.string(),
        players: z.number().int().min(1).max(4),
        source: z.string(),
        notes: z.string().nullable(),
        // Ausente nos backups da versão 1: eram todas terminadas.
        status: z.enum(['live', 'done']).default('done'),
        weapon_stats: z.array(z.object({ weapon_id: z.string(), kills: count, headshots: count })),
      })
      .refine((s) => s.status === 'live' || s.round_reached !== null, {
        message: 'sessão terminada sem ronda',
        path: ['round_reached'],
      }),
  ),
  // Coleções da versão 2 (opcionais para aceitar a versão 1).
  user_camo_overrides: z
    .array(
      z.object({
        camo_id: z.string(),
        requirement_type: z.enum(['kills', 'headshots']).nullable(),
        requirement_text: z.string().nullable(),
        requirement_value: z.number().int().min(1).nullable(),
        updated_at: timestamp,
      }),
    )
    .default([]),
  pinned_weapons: z
    .array(z.object({ weapon_id: z.string(), sort_order: z.number().int(), pinned_at: timestamp }))
    .default([]),
  camo_notes: z
    .array(z.object({ weapon_id: z.string(), camo_id: z.string(), body: z.string(), updated_at: timestamp }))
    .default([]),
  weapon_notes: z.array(z.object({ weapon_id: z.string(), body: z.string(), updated_at: timestamp })).default([]),
  goals: z
    .array(
      z.object({
        title: z.string(),
        type: z.enum(['camo_count', 'weapon_camo', 'kills', 'headshots']),
        target: z.number().int().min(1),
        weapon_id: z.string().nullable(),
        weapon_class: z.string().nullable(),
        camo_id: z.string().nullable(),
        period: z.enum(['daily', 'weekly', 'none']),
        created_at: timestamp,
        archived_at: timestamp.nullable(),
      }),
    )
    .default([]),
  user_settings: z
    .object({
      player_name: z.string().nullable(),
      sound_enabled: z.boolean(),
      sound_volume: z.number().min(0).max(1),
    })
    .nullable()
    .default(null),
});

export type Backup = z.infer<typeof backupSchema>;
/** Forma do ficheiro antes dos valores por defeito (o que o export devolve). */
export type BackupInput = z.input<typeof backupSchema>;

/** Ids do catálogo atual, para detetar referências que deixaram de existir. */
export interface CatalogIds {
  maps: ReadonlySet<string>;
  weapons: ReadonlySet<string>;
  camos: ReadonlySet<string>;
  easterEggs: ReadonlySet<string>;
  steps: ReadonlySet<string>;
  challenges: ReadonlySet<string>;
}

export interface BackupSummary {
  exportedAt: string;
  sessions: number;
  camoRows: number;
  unlockedCamos: number;
  steps: number;
  completions: number;
  challenges: number;
  overrides: number;
  pinnedWeapons: number;
  notes: number;
  goals: number;
}

export type ParseBackupResult =
  | { ok: true; backup: Backup; summary: BackupSummary }
  | { ok: false; errors: string[] };

const MAX_LISTED = 10;

/** Lê e valida um ficheiro de backup contra o schema e o catálogo atual. */
export function parseBackup(text: string, catalog: CatalogIds): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['O ficheiro não é JSON válido.'] };
  }

  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, MAX_LISTED).map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }

  const backup = parsed.data;
  const missing = new Map<string, Set<string>>();
  const check = (label: string, ids: ReadonlySet<string>, id: string) => {
    if (ids.has(id)) return;
    const set = missing.get(label) ?? new Set<string>();
    set.add(id);
    missing.set(label, set);
  };

  for (const r of backup.weapon_camo_progress) {
    check('armas', catalog.weapons, r.weapon_id);
    check('camos', catalog.camos, r.camo_id);
  }
  for (const r of backup.easter_egg_step_progress) check('passos de easter eggs', catalog.steps, r.step_id);
  for (const r of backup.easter_egg_completions) check('easter eggs', catalog.easterEggs, r.easter_egg_id);
  for (const r of backup.challenge_progress) check('desafios', catalog.challenges, r.challenge_id);
  for (const s of backup.sessions) {
    check('mapas', catalog.maps, s.map_id);
    for (const w of s.weapon_stats) check('armas', catalog.weapons, w.weapon_id);
  }
  for (const r of backup.user_camo_overrides) check('camos', catalog.camos, r.camo_id);
  for (const r of backup.pinned_weapons) check('armas', catalog.weapons, r.weapon_id);
  for (const r of backup.camo_notes) {
    check('armas', catalog.weapons, r.weapon_id);
    check('camos', catalog.camos, r.camo_id);
  }
  for (const r of backup.weapon_notes) check('armas', catalog.weapons, r.weapon_id);
  for (const g of backup.goals) {
    if (g.weapon_id) check('armas', catalog.weapons, g.weapon_id);
    if (g.camo_id) check('camos', catalog.camos, g.camo_id);
  }

  if (missing.size > 0) {
    return {
      ok: false,
      errors: [...missing].map(([label, ids]) => {
        const list = [...ids];
        const shown = list.slice(0, MAX_LISTED).join(', ');
        const more = list.length > MAX_LISTED ? ` e mais ${list.length - MAX_LISTED}` : '';
        return `O backup refere ${label} que não existem no catálogo atual: ${shown}${more}.`;
      }),
    };
  }

  return {
    ok: true,
    backup,
    summary: {
      exportedAt: backup.exported_at,
      sessions: backup.sessions.length,
      camoRows: backup.weapon_camo_progress.length,
      unlockedCamos: backup.weapon_camo_progress.filter((r) => r.unlocked_at !== null).length,
      steps: backup.easter_egg_step_progress.length,
      completions: backup.easter_egg_completions.length,
      challenges: backup.challenge_progress.length,
      overrides: backup.user_camo_overrides.length,
      pinnedWeapons: backup.pinned_weapons.length,
      notes: backup.camo_notes.length + backup.weapon_notes.length,
      goals: backup.goals.length,
    },
  };
}

/** Nome do ficheiro de export, com a data local (ex.: bo4-progresso-2026-11-12.json). */
export function backupFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `bo4-progresso-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
