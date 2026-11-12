// Contagem de uma partida no modo grind (docs/CAMOS.md, secção 5). Lógica pura.
import { camoState, progressKey, sortByTier, type CamoLike, type ProgressIndex } from '../../lib/progress';

export interface WeaponTally {
  kills: number;
  headshots: number;
}

export type TapKind = 'kill' | 'headshot';

export interface TallyState {
  activeWeaponId: string | null;
  /** Contagens desta partida por arma (inclui armas usadas e depois trocadas). */
  counts: Record<string, WeaponTally>;
  /** Toques por ordem, para "desfazer" (não sobrevive a recarregar a página). */
  history: { weaponId: string; kind: TapKind }[];
}

export type TallyAction =
  | { type: 'tap'; kind: TapKind }
  | { type: 'undo' }
  | { type: 'switch'; weaponId: string }
  | { type: 'load'; counts: Record<string, WeaponTally>; activeWeaponId: string | null };

export const EMPTY_TALLY: TallyState = { activeWeaponId: null, counts: {}, history: [] };

const ZERO: WeaponTally = { kills: 0, headshots: 0 };

/** Um headshot conta também como kill. */
function applyTap(t: WeaponTally, kind: TapKind, sign: 1 | -1): WeaponTally {
  return {
    kills: Math.max(t.kills + sign, 0),
    headshots: kind === 'headshot' ? Math.max(t.headshots + sign, 0) : t.headshots,
  };
}

export function tallyReducer(state: TallyState, action: TallyAction): TallyState {
  switch (action.type) {
    case 'tap': {
      const id = state.activeWeaponId;
      if (!id) return state;
      return {
        ...state,
        counts: { ...state.counts, [id]: applyTap(state.counts[id] ?? ZERO, action.kind, 1) },
        history: [...state.history, { weaponId: id, kind: action.kind }],
      };
    }
    case 'undo': {
      const last = state.history.at(-1);
      if (!last) return state;
      return {
        ...state,
        counts: { ...state.counts, [last.weaponId]: applyTap(state.counts[last.weaponId] ?? ZERO, last.kind, -1) },
        history: state.history.slice(0, -1),
      };
    }
    case 'switch':
      return {
        ...state,
        activeWeaponId: action.weaponId,
        counts: state.counts[action.weaponId] ? state.counts : { ...state.counts, [action.weaponId]: { ...ZERO } },
      };
    case 'load':
      return { activeWeaponId: action.activeWeaponId, counts: action.counts, history: [] };
  }
}

/** Linhas para session_weapon_stats, por ordem de id (determinístico). */
export function tallyToStats(counts: Record<string, WeaponTally>) {
  return Object.entries(counts)
    .map(([weapon_id, t]) => ({ weapon_id, kills: t.kills, headshots: t.headshots }))
    .sort((a, b) => a.weapon_id.localeCompare(b.weapon_id));
}

export function totalKills(counts: Record<string, WeaponTally>): number {
  return Object.values(counts).reduce((sum, t) => sum + t.kills, 0);
}

export type Projection<C extends CamoLike> =
  | { kind: 'complete' }
  | {
      kind: 'measurable';
      camo: C;
      saved: number;
      session: number;
      projected: number;
      target: number;
      /** A barra projetada atinge o objetivo: desbloqueia ao terminar a partida. */
      unlocksOnFinish: boolean;
      savedFraction: number;
      projectedFraction: number;
    }
  | { kind: 'unknown'; camo: C; saved: number }
  | { kind: 'mastery'; camo: C };

/**
 * Próximo camo da arma ativa com a barra projetada (gravado + esta partida).
 * Nada é gravado aqui: é só o que se mostra durante a partida.
 * `camos` já deve vir com os overrides aplicados.
 */
export function projectNextCamo<C extends CamoLike>(
  weaponId: string,
  camos: readonly C[],
  index: ProgressIndex,
  session: WeaponTally,
): Projection<C> {
  for (const camo of sortByTier(camos)) {
    const state = camoState(camo, index.get(progressKey(weaponId, camo.id)));
    if (state.unlocked) continue;
    if (camo.requirement_type === 'prereq_all') return { kind: 'mastery', camo };
    if (state.target === null || (camo.requirement_type !== 'kills' && camo.requirement_type !== 'headshots')) {
      return { kind: 'unknown', camo, saved: state.count };
    }
    const sessionCount = camo.requirement_type === 'kills' ? session.kills : session.headshots;
    const projected = state.count + sessionCount;
    return {
      kind: 'measurable',
      camo,
      saved: state.count,
      session: sessionCount,
      projected,
      target: state.target,
      unlocksOnFinish: projected >= state.target,
      savedFraction: Math.min(state.count / state.target, 1),
      projectedFraction: Math.min(projected / state.target, 1),
    };
  }
  return { kind: 'complete' };
}
