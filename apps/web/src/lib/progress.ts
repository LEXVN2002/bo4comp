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
