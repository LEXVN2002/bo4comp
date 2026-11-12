// Grelha mestra e selos de classe (docs/CAMOS.md, secção 6). Lógica pura.
import { classSeal, type CamoLike, type CamoState, type ClassSeal, type ProgressIndex } from '../../lib/progress';
import { weaponClassesOf } from './weapons';

/** Selos de todas as classes presentes, pela ordem da spec. */
export function allClassSeals(
  weapons: readonly { id: string; weapon_class: string }[],
  camos: readonly CamoLike[],
  index: ProgressIndex,
): ClassSeal[] {
  return weaponClassesOf(weapons).map((c) => classSeal(c, weapons, camos, index));
}

/** Classes que passaram a ter selo desde a última vez (para a animação "MASTERY DE CLASSE"). */
export function newlyCompletedSeals(previous: ReadonlySet<string>, seals: readonly ClassSeal[]): ClassSeal[] {
  return seals.filter((s) => s.complete && !previous.has(s.weaponClass));
}

export type CellLevel = 'empty' | 'low' | 'mid' | 'high' | 'done';

/**
 * Cor da célula da grelha mestra: vazia, em progresso (intensidade pela %) ou concluída.
 * Com requisito por confirmar mas contador > 0, conta como progresso baixo.
 */
export function cellLevel(state: CamoState): CellLevel {
  if (state.unlocked) return 'done';
  if (state.fraction !== null && state.fraction > 0) {
    if (state.fraction >= 0.66) return 'high';
    if (state.fraction >= 0.33) return 'mid';
    return 'low';
  }
  return state.count > 0 ? 'low' : 'empty';
}

export const CELL_CLASSES: Record<CellLevel, string> = {
  empty: 'bg-zinc-800/60 hover:bg-zinc-700',
  low: 'bg-emerald-950 text-emerald-200 hover:bg-emerald-900',
  mid: 'bg-emerald-800 text-emerald-50 hover:bg-emerald-700',
  high: 'bg-emerald-600/80 text-white hover:bg-emerald-500',
  done: 'bg-emerald-500 text-zinc-950 shadow-[0_0_8px_rgba(52,211,153,0.5)] hover:bg-emerald-400',
};
