import { z } from 'zod';

export const BACKUP_FORMAT = 'bo4-zombies-companion';
export const BACKUP_VERSION = 1;

const timestamp = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'data inválida');
const count = z.number().int().min(0);

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT, { message: 'não é um backup do BO4 Zombies Companion' }),
  version: z.literal(BACKUP_VERSION, { message: `versão não suportada (esperada ${BACKUP_VERSION})` }),
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
    z.object({
      map_id: z.string(),
      played_at: timestamp,
      round_reached: count,
      mode: z.string(),
      players: z.number().int().min(1).max(4),
      source: z.string(),
      notes: z.string().nullable(),
      weapon_stats: z.array(z.object({ weapon_id: z.string(), kills: count, headshots: count })),
    }),
  ),
});

export type Backup = z.infer<typeof backupSchema>;

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
    },
  };
}

/** Nome do ficheiro de export, com a data local (ex.: bo4-progresso-2026-11-12.json). */
export function backupFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `bo4-progresso-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
