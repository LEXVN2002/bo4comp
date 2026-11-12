import { z } from 'zod';

/** Slug estável: minúsculas, dígitos e hífens (ex.: 'saug-9mm'). */
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug inválido (usar minúsculas, dígitos e hífens)');

const nonEmpty = z.string().trim().min(1, 'não pode estar vazio');
const playerCount = z.number().int().min(1).max(4);

export const STORYLINES = ['chaos', 'aether'] as const;
export const WEAPON_CLASSES = [
  'smg',
  'ar',
  'tactical',
  'lmg',
  'sniper',
  'pistol',
  'shotgun',
  'launcher',
  'melee',
  'special',
] as const;
export const WEAPON_SOURCES = ['base', 'dlc', 'reserves'] as const;
export const CAMO_KINDS = ['zombies', 'mastery', 'reactive'] as const;
/**
 * 'unknown' = requisito ainda por confirmar no jogo; nunca desbloqueia sozinho.
 * Manter em sincronia com o check constraint em supabase/migrations.
 */
export const REQUIREMENT_TYPES = ['kills', 'headshots', 'prereq_all', 'unknown'] as const;
export const EASTER_EGG_TYPES = ['main', 'side', 'song', 'music', 'other'] as const;

export const mapSchema = z.strictObject({
  id: slugSchema,
  name: nonEmpty,
  storyline: z.enum(STORYLINES),
  release_order: z.number().int().min(1),
  is_dlc: z.boolean(),
});

export const weaponSchema = z.strictObject({
  id: slugSchema,
  name: nonEmpty,
  weapon_class: z.enum(WEAPON_CLASSES),
  source: z.enum(WEAPON_SOURCES),
});

export const camoSchema = z
  .strictObject({
    id: slugSchema,
    name: nonEmpty,
    tier: z.number().int().min(1),
    kind: z.enum(CAMO_KINDS),
    requirement_type: z.enum(REQUIREMENT_TYPES),
    requirement_value: z.number().int().min(1).nullable(),
    requirement_text: nonEmpty,
    verified: z.boolean(),
  })
  .superRefine((camo, ctx) => {
    const counted = camo.requirement_type === 'kills' || camo.requirement_type === 'headshots';
    if (!counted && camo.requirement_value !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['requirement_value'],
        message: `requirement_value tem de ser null quando requirement_type é '${camo.requirement_type}'`,
      });
    }
    if (camo.requirement_type === 'unknown' && camo.verified) {
      ctx.addIssue({
        code: 'custom',
        path: ['verified'],
        message: "um camo com requirement_type 'unknown' não pode estar verified",
      });
    }
    if (counted && camo.verified && camo.requirement_value === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['requirement_value'],
        message: 'um camo verified com kills/headshots precisa de requirement_value',
      });
    }
  });

export const easterEggStepSchema = z.strictObject({
  order: z.number().int().min(1),
  /** Agrupa passos no ecrã (ex.: 'Pack-a-Punch', 'Escudo'). null = sem secção. */
  section: nonEmpty.nullable(),
  title: nonEmpty,
  details: z.string().nullable(),
});

/** Link para um guia de terceiros usado para escrever os passos. */
const guideUrl = z.url({ protocol: /^https$/, error: 'tem de ser um URL https' });

export const easterEggSchema = z
  .strictObject({
    id: slugSchema,
    map_id: slugSchema,
    name: nonEmpty,
    type: z.enum(EASTER_EGG_TYPES),
    min_players: playerCount.nullable(),
    max_players: playerCount.nullable(),
    verified: z.boolean(),
    sources: z.array(guideUrl),
    steps: z.array(easterEggStepSchema),
  })
  .superRefine((egg, ctx) => {
    if (egg.min_players !== null && egg.max_players !== null && egg.min_players > egg.max_players) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_players'],
        message: 'max_players tem de ser >= min_players',
      });
    }
    if (egg.steps.length > 0 && egg.sources.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'passos de um guia precisam de pelo menos uma fonte',
      });
    }
    const seen = new Set<number>();
    egg.steps.forEach((step, i) => {
      if (seen.has(step.order)) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'order'],
          message: `ordem de passo repetida: ${step.order}`,
        });
      }
      seen.add(step.order);
    });
  });

export const challengeSchema = z.strictObject({
  id: slugSchema,
  map_id: slugSchema.nullable(),
  name: nonEmpty,
  description: nonEmpty,
  target: z.number().int().min(1),
});

export type GameMap = z.infer<typeof mapSchema>;
export type Weapon = z.infer<typeof weaponSchema>;
export type Camo = z.infer<typeof camoSchema>;
export type EasterEggStep = z.infer<typeof easterEggStepSchema>;
export type EasterEgg = z.infer<typeof easterEggSchema>;
export type Challenge = z.infer<typeof challengeSchema>;

export interface GameData {
  maps: GameMap[];
  weapons: Weapon[];
  camos: Camo[];
  easterEggs: EasterEgg[];
  challenges: Challenge[];
}

/** Nome do ficheiro JSON de cada coleção, usado nas mensagens de erro. */
export const GAME_DATA_FILES: Record<keyof GameData, string> = {
  maps: 'maps.json',
  weapons: 'weapons.json',
  camos: 'camos.json',
  easterEggs: 'easter-eggs.json',
  challenges: 'challenges.json',
};

export class GameDataValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`game-data inválido (${issues.length} problema(s)):\n- ${issues.join('\n- ')}`);
    this.name = 'GameDataValidationError';
  }
}

/** Id do passo na base de dados: derivado do easter egg e da ordem. */
export function stepId(easterEggId: string, order: number): string {
  return `${easterEggId}-${order}`;
}

function parseCollection<T>(
  file: string,
  schema: z.ZodType<T>,
  raw: unknown,
  issues: string[],
): T[] {
  const result = z.array(schema).safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.length ? issue.path.join('.') : '(raiz)';
      issues.push(`${file} [${path}]: ${issue.message}`);
    }
    return [];
  }
  return result.data;
}

function checkUnique<T>(
  file: string,
  items: T[],
  key: (item: T) => string | number,
  label: string,
  issues: string[],
): void {
  const seen = new Set<string | number>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) issues.push(`${file}: ${label} repetido: ${value}`);
    seen.add(value);
  }
}

/**
 * Valida todos os ficheiros de game-data (forma + referências cruzadas).
 * Lança GameDataValidationError com a lista completa de problemas.
 */
export function validateGameData(raw: Record<keyof GameData, unknown>): GameData {
  const issues: string[] = [];
  const f = GAME_DATA_FILES;

  const data: GameData = {
    maps: parseCollection(f.maps, mapSchema, raw.maps, issues),
    weapons: parseCollection(f.weapons, weaponSchema, raw.weapons, issues),
    camos: parseCollection(f.camos, camoSchema, raw.camos, issues),
    easterEggs: parseCollection(f.easterEggs, easterEggSchema, raw.easterEggs, issues),
    challenges: parseCollection(f.challenges, challengeSchema, raw.challenges, issues),
  };

  checkUnique(f.maps, data.maps, (m) => m.id, 'id', issues);
  checkUnique(f.maps, data.maps, (m) => m.release_order, 'release_order', issues);
  checkUnique(f.weapons, data.weapons, (w) => w.id, 'id', issues);
  checkUnique(f.camos, data.camos, (c) => c.id, 'id', issues);
  checkUnique(f.camos, data.camos, (c) => c.tier, 'tier', issues);
  checkUnique(f.easterEggs, data.easterEggs, (e) => e.id, 'id', issues);
  checkUnique(f.challenges, data.challenges, (c) => c.id, 'id', issues);
  checkUnique(
    f.easterEggs,
    data.easterEggs.flatMap((e) => e.steps.map((s) => stepId(e.id, s.order))),
    (id) => id,
    'id de passo',
    issues,
  );

  const mapIds = new Set(data.maps.map((m) => m.id));
  for (const egg of data.easterEggs) {
    if (!mapIds.has(egg.map_id)) {
      issues.push(`${f.easterEggs}: '${egg.id}' refere o mapa inexistente '${egg.map_id}'`);
    }
  }
  for (const challenge of data.challenges) {
    if (challenge.map_id !== null && !mapIds.has(challenge.map_id)) {
      issues.push(
        `${f.challenges}: '${challenge.id}' refere o mapa inexistente '${challenge.map_id}'`,
      );
    }
  }

  if (issues.length > 0) throw new GameDataValidationError(issues);
  return data;
}
