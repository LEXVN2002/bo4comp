// Cálculo de progresso de camos no cliente (só leitura).
// A fonte de verdade dos desbloqueios automáticos é a função Postgres
// record_session; aqui só se apresenta o estado guardado.

export interface CamoLike {
  id: string;
  tier: number;
  requirement_type: string;
  requirement_value: number | null;
}

export interface CamoProgressLike {
  weapon_id: string;
  camo_id: string;
  current_count: number;
  unlocked_at: string | null;
}

export interface CamoState {
  unlocked: boolean;
  count: number;
  /** Requisito numérico conhecido; null se ainda por confirmar ou não for de contagem. */
  target: number | null;
  /** 0..1 quando há requisito conhecido (1 se desbloqueado); senão null. */
  fraction: number | null;
  /** O camo avança com kills/headshots (mostra contador). */
  counted: boolean;
}

export type ProgressIndex<R extends CamoProgressLike = CamoProgressLike> = ReadonlyMap<string, R>;

export function progressKey(weaponId: string, camoId: string): string {
  return `${weaponId}:${camoId}`;
}

export function indexProgress<R extends CamoProgressLike>(rows: readonly R[]): ProgressIndex<R> {
  return new Map(rows.map((row) => [progressKey(row.weapon_id, row.camo_id), row]));
}

export function isCountedRequirement(type: string): boolean {
  return type === 'kills' || type === 'headshots';
}

export function camoState(camo: CamoLike, row: CamoProgressLike | undefined): CamoState {
  const unlocked = row?.unlocked_at != null;
  const count = row?.current_count ?? 0;
  const counted = isCountedRequirement(camo.requirement_type);
  const target = counted ? camo.requirement_value : null;
  let fraction: number | null = null;
  if (unlocked) fraction = 1;
  else if (target !== null) fraction = Math.min(count / target, 1);
  return { unlocked, count, target, fraction, counted };
}

export function sortByTier<T extends { tier: number }>(camos: readonly T[]): T[] {
  return [...camos].sort((a, b) => a.tier - b.tier);
}

export interface WeaponSummary<C extends CamoLike> {
  unlocked: number;
  total: number;
  /** Primeiro camo bloqueado por ordem de tier (o "próximo desbloqueio"). */
  next: { camo: C; state: CamoState } | null;
}

export function weaponSummary<C extends CamoLike>(
  weaponId: string,
  camos: readonly C[],
  index: ProgressIndex,
): WeaponSummary<C> {
  let unlocked = 0;
  let next: WeaponSummary<C>['next'] = null;
  for (const camo of sortByTier(camos)) {
    const state = camoState(camo, index.get(progressKey(weaponId, camo.id)));
    if (state.unlocked) unlocked += 1;
    else if (next === null) next = { camo, state };
  }
  return { unlocked, total: camos.length, next };
}

export interface Completion {
  unlocked: number;
  total: number;
  /** 0..1; 0 quando não há nada para desbloquear. */
  fraction: number;
}

/** Percentagem total de camos (armas × camos) desbloqueados. */
export function overallCompletion(
  weaponIds: readonly string[],
  camos: readonly CamoLike[],
  index: ProgressIndex,
): Completion {
  const camoIds = new Set(camos.map((c) => c.id));
  const weapons = new Set(weaponIds);
  let unlocked = 0;
  for (const row of index.values()) {
    if (row.unlocked_at != null && weapons.has(row.weapon_id) && camoIds.has(row.camo_id)) {
      unlocked += 1;
    }
  }
  const total = weapons.size * camoIds.size;
  return { unlocked, total, fraction: total === 0 ? 0 : unlocked / total };
}

export function formatPercent(fraction: number): string {
  return `${Math.floor(fraction * 100)}%`;
}

// ---------------------------------------------------------------------------
// Aba de camos e grind (docs/CAMOS.md). Funções puras, sem acesso à rede.
// ---------------------------------------------------------------------------

/** Override do utilizador para um camo (tabela user_camo_overrides). */
export interface CamoOverrideLike {
  camo_id: string;
  requirement_type: string | null;
  requirement_text: string | null;
  requirement_value: number | null;
}

export type OverrideIndex = ReadonlyMap<string, CamoOverrideLike>;

export function indexOverrides(rows: readonly CamoOverrideLike[]): OverrideIndex {
  return new Map(rows.map((row) => [row.camo_id, row]));
}

/**
 * Camo com o requisito efetivo do utilizador: o override ganha ao catálogo
 * (o mesmo que a função Postgres effective_camo_requirements).
 */
export function withOverride<C extends CamoLike & { requirement_text?: string }>(
  camo: C,
  override: CamoOverrideLike | undefined,
): C {
  if (!override) return camo;
  return {
    ...camo,
    requirement_type: override.requirement_type ?? camo.requirement_type,
    requirement_value: override.requirement_value ?? camo.requirement_value,
    ...(camo.requirement_text !== undefined && { requirement_text: override.requirement_text ?? camo.requirement_text }),
  };
}

/**
 * Um camo de mastery (prereq_all) fica bloqueado enquanto algum camo de tier inferior
 * da mesma arma não estiver concluído. Os outros camos nunca estão bloqueados.
 */
export function isMasteryLocked(
  weaponId: string,
  camo: CamoLike,
  camos: readonly CamoLike[],
  index: ProgressIndex,
): boolean {
  if (camo.requirement_type !== 'prereq_all') return false;
  return camos.some(
    (prev) => prev.tier < camo.tier && index.get(progressKey(weaponId, prev.id))?.unlocked_at == null,
  );
}

/**
 * Camos de mastery que o servidor (unlock_mastery_camos) vai desbloquear em cadeia
 * quando `camoId` ficar concluído nesta arma: todos os de prereq_all ainda por fazer,
 * se todos os outros camos da arma ficarem concluídos. Por ordem de tier.
 */
export function masteryUnlockedBy<C extends CamoLike>(
  weaponId: string,
  camoId: string,
  camos: readonly C[],
  index: ProgressIndex,
): C[] {
  const isDone = (c: CamoLike) => c.id === camoId || index.get(progressKey(weaponId, c.id))?.unlocked_at != null;
  const others = camos.filter((c) => c.requirement_type !== 'prereq_all');
  if (others.length === 0 || !others.every(isDone)) return [];
  return sortByTier(camos.filter((c) => c.requirement_type === 'prereq_all' && !isDone(c)));
}

export type CamoDisplayState = 'locked' | 'in_progress' | 'done';

/** Estado visual de um camo na grelha: bloqueado, em progresso ou concluído. */
export function camoDisplayState(
  weaponId: string,
  camo: CamoLike,
  camos: readonly CamoLike[],
  index: ProgressIndex,
): CamoDisplayState {
  if (index.get(progressKey(weaponId, camo.id))?.unlocked_at != null) return 'done';
  return isMasteryLocked(weaponId, camo, camos, index) ? 'locked' : 'in_progress';
}

export interface UnlockCandidate<C extends CamoLike> {
  weaponId: string;
  camo: C;
  count: number;
  target: number;
  remaining: number;
  /** 0..1 (current_count / requirement_value, limitado a 1). */
  fraction: number;
}

/**
 * Próximo camo de uma arma que se pode medir: o de tier mais baixo ainda não concluído,
 * de contagem (kills/headshots), com requisito conhecido e não bloqueado.
 * `camos` já deve vir com os overrides aplicados (withOverride).
 */
export function nextMeasurableCamo<C extends CamoLike>(
  weaponId: string,
  camos: readonly C[],
  index: ProgressIndex,
): UnlockCandidate<C> | null {
  for (const camo of sortByTier(camos)) {
    const row = index.get(progressKey(weaponId, camo.id));
    if (row?.unlocked_at != null) continue;
    if (!isCountedRequirement(camo.requirement_type) || camo.requirement_value === null) continue;
    if (isMasteryLocked(weaponId, camo, camos, index)) continue;
    const count = row?.current_count ?? 0;
    const target = camo.requirement_value;
    return {
      weaponId,
      camo,
      count,
      target,
      remaining: Math.max(target - count, 0),
      fraction: Math.min(count / target, 1),
    };
  }
  return null;
}

/**
 * "Mais perto de desbloquear": um candidato por arma, ordenados por percentagem
 * descendente e, em empate, pelo menor número em falta. Camos por confirmar ficam de fora.
 */
export function closestToUnlock<C extends CamoLike>(
  weaponIds: readonly string[],
  camos: readonly C[],
  index: ProgressIndex,
  limit = 3,
): UnlockCandidate<C>[] {
  return weaponIds
    .map((id) => nextMeasurableCamo(id, camos, index))
    .filter((c): c is UnlockCandidate<C> => c !== null)
    .sort((a, b) => b.fraction - a.fraction || a.remaining - b.remaining || a.weaponId.localeCompare(b.weaponId))
    .slice(0, limit);
}

export interface WeaponSessionStats {
  kills: number;
  headshots: number;
}

export type MatchEstimate =
  | { kind: 'estimate'; matches: number; average: number }
  /** Menos de 3 sessões com a arma. */
  | { kind: 'insufficient' }
  /** Há sessões suficientes, mas a média do tipo pedido é 0. */
  | { kind: 'no_progress' };

export const ESTIMATE_WINDOW = 10;
export const ESTIMATE_MIN_SESSIONS = 3;

/**
 * Partidas que faltam para um camo, pela média das últimas 10 sessões em que a arma foi usada.
 * `recent` vem da mais recente para a mais antiga; só se usam as primeiras 10.
 */
export function estimateMatches(
  remaining: number,
  type: 'kills' | 'headshots',
  recent: readonly WeaponSessionStats[],
): MatchEstimate {
  const window = recent.slice(0, ESTIMATE_WINDOW);
  if (window.length < ESTIMATE_MIN_SESSIONS) return { kind: 'insufficient' };
  const average = window.reduce((sum, s) => sum + s[type], 0) / window.length;
  if (remaining <= 0) return { kind: 'estimate', matches: 0, average };
  if (average <= 0) return { kind: 'no_progress' };
  return { kind: 'estimate', matches: Math.ceil(remaining / average), average };
}

export interface ClassSeal {
  weaponClass: string;
  complete: boolean;
  unlocked: number;
  total: number;
  fraction: number;
  /** unlocked_at mais recente entre os camos da classe, quando o selo está completo. */
  earnedAt: string | null;
}

/** Selo de classe: todas as armas da classe com todos os camos concluídos. */
export function classSeal(
  weaponClass: string,
  weapons: readonly { id: string; weapon_class: string }[],
  camos: readonly CamoLike[],
  index: ProgressIndex,
): ClassSeal {
  const ids = weapons.filter((w) => w.weapon_class === weaponClass).map((w) => w.id);
  let unlocked = 0;
  let latest: string | null = null;
  for (const id of ids) {
    for (const camo of camos) {
      const at = index.get(progressKey(id, camo.id))?.unlocked_at;
      if (at == null) continue;
      unlocked += 1;
      if (latest === null || Date.parse(at) > Date.parse(latest)) latest = at;
    }
  }
  const total = ids.length * camos.length;
  const complete = total > 0 && unlocked === total;
  return {
    weaponClass,
    complete,
    unlocked,
    total,
    fraction: total === 0 ? 0 : unlocked / total,
    earnedAt: complete ? latest : null,
  };
}
