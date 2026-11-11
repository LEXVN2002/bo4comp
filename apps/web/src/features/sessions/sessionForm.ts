import { SESSION_MODES, type SessionMode } from '@bo4/shared';
import { z } from 'zod';

/** Valores do formulário tal como vêm dos inputs (strings). */
export interface SessionFormValues {
  mapId: string;
  mode: SessionMode;
  players: string;
  round: string;
  notes: string;
  weapons: { weaponId: string; kills: string; headshots: string }[];
}

function intField(label: string, opts: { min: number; max?: number; emptyAs?: number }) {
  return z.string().transform((raw, ctx) => {
    const s = raw.trim();
    if (s === '') {
      if (opts.emptyAs !== undefined) return opts.emptyAs;
      ctx.addIssue({ code: 'custom', message: `Indica ${label}.` });
      return z.NEVER;
    }
    const n = Number(s);
    const tooHigh = opts.max !== undefined && n > opts.max;
    if (!Number.isInteger(n) || n < opts.min || tooHigh) {
      const range = opts.max !== undefined ? `entre ${opts.min} e ${opts.max}` : `maior ou igual a ${opts.min}`;
      ctx.addIssue({ code: 'custom', message: `${capitalize(label)} tem de ser um número inteiro ${range}.` });
      return z.NEVER;
    }
    return n;
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const sessionFormSchema = z.object({
  mapId: z.string().min(1, 'Escolhe um mapa.'),
  mode: z.enum(SESSION_MODES, { message: 'Modo inválido.' }),
  players: intField('o número de jogadores', { min: 1, max: 4 }),
  round: intField('a ronda', { min: 0, max: 10_000 }),
  notes: z.string().trim().max(1000, 'As notas têm no máximo 1000 caracteres.'),
  weapons: z
    .array(
      z.object({
        weaponId: z.string().min(1),
        kills: intField('kills', { min: 0, emptyAs: 0 }),
        headshots: intField('headshots', { min: 0, emptyAs: 0 }),
      }),
    )
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((row, i) => {
        if (seen.has(row.weaponId)) {
          ctx.addIssue({ code: 'custom', path: [i, 'weaponId'], message: 'Arma repetida.' });
        }
        seen.add(row.weaponId);
      });
    }),
});

export type ParsedSessionForm = z.output<typeof sessionFormSchema>;

/** Argumentos da RPC record_session (nomes iguais aos da função Postgres). */
export interface RecordSessionPayload {
  p_map_id: string;
  p_round_reached: number;
  p_mode: SessionMode;
  p_players: number;
  /** Omitido quando vazio (a função usa null por defeito). */
  p_notes?: string;
  p_weapon_stats: { weapon_id: string; kills: number; headshots: number }[];
}

export function toRecordSessionPayload(form: ParsedSessionForm): RecordSessionPayload {
  return {
    p_map_id: form.mapId,
    p_round_reached: form.round,
    p_mode: form.mode,
    p_players: form.players,
    ...(form.notes === '' ? {} : { p_notes: form.notes }),
    // Linhas a zero não alteram nada; não vale a pena gravá-las.
    p_weapon_stats: form.weapons
      .filter((w) => w.kills > 0 || w.headshots > 0)
      .map((w) => ({ weapon_id: w.weaponId, kills: w.kills, headshots: w.headshots })),
  };
}

export type FieldErrors = Record<string, string>;

/** Valida o formulário; devolve o payload ou erros por campo ("round", "weapons.0.kills"…). */
export function parseSessionForm(
  values: SessionFormValues,
): { ok: true; payload: RecordSessionPayload } | { ok: false; errors: FieldErrors } {
  const result = sessionFormSchema.safeParse(values);
  if (result.success) return { ok: true, payload: toRecordSessionPayload(result.data) };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
