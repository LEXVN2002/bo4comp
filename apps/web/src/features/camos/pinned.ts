// Lógica pura das armas afixadas.
import {
  camoState,
  progressKey,
  sortByTier,
  type CamoLike,
  type ProgressIndex,
} from '../../lib/progress';

/** A partir de quantas armas afixadas se mostra o aviso (sem limite rígido). */
export const PINNED_WARNING_AT = 6;

/** Move um item de `from` para `to`, devolvendo uma lista nova. Índices fora dos limites não mudam nada. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export type NextCamoInfo<C extends CamoLike> =
  | { kind: 'complete' }
  | { kind: 'measurable'; camo: C; count: number; target: number; remaining: number; fraction: number }
  | { kind: 'unknown'; camo: C; count: number }
  /** Mastery com todos os camos anteriores feitos (o servidor desbloqueia-o na próxima gravação). */
  | { kind: 'mastery'; camo: C };

/**
 * Próximo camo por desbloquear numa arma (por tier) e quanto falta.
 * Como se percorre por tier, um mastery só é o "próximo" quando os anteriores estão feitos.
 * `camos` já deve vir com os overrides aplicados.
 */
export function nextCamoInfo<C extends CamoLike>(
  weaponId: string,
  camos: readonly C[],
  index: ProgressIndex,
): NextCamoInfo<C> {
  for (const camo of sortByTier(camos)) {
    const state = camoState(camo, index.get(progressKey(weaponId, camo.id)));
    if (state.unlocked) continue;
    if (camo.requirement_type === 'prereq_all') return { kind: 'mastery', camo };
    if (state.target !== null) {
      return {
        kind: 'measurable',
        camo,
        count: state.count,
        target: state.target,
        remaining: Math.max(state.target - state.count, 0),
        fraction: state.fraction ?? 0,
      };
    }
    return { kind: 'unknown', camo, count: state.count };
  }
  return { kind: 'complete' };
}

export function requirementUnit(type: string): string {
  return type === 'headshots' ? 'headshots' : 'kills';
}
