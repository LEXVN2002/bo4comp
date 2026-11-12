// Filtros e ordenação da lista de armas em /camos, com o estado guardado no URL
// (?classe=smg&ordem=progresso&q=saug&incompletas=1).
import {
  nextMeasurableCamo,
  weaponSummary,
  type CamoLike,
  type ProgressIndex,
  type UnlockCandidate,
} from '../../lib/progress';
import { searchWeapons, sortWeapons } from './weapons';

export const SORT_OPTIONS = ['nome', 'progresso', 'perto'] as const;
export type WeaponSort = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<WeaponSort, string> = {
  nome: 'Nome',
  progresso: '% de progresso',
  perto: 'Mais perto de desbloquear',
};

export interface WeaponListFilters {
  weaponClass: string | null;
  sort: WeaponSort;
  query: string;
  onlyIncomplete: boolean;
}

export const DEFAULT_FILTERS: WeaponListFilters = {
  weaponClass: null,
  sort: 'nome',
  query: '',
  onlyIncomplete: false,
};

/** Lê os filtros do URL; valores inválidos voltam ao valor por defeito. */
export function parseFilters(params: URLSearchParams, validClasses: readonly string[]): WeaponListFilters {
  const weaponClass = params.get('classe');
  const sort = params.get('ordem');
  return {
    weaponClass: weaponClass && validClasses.includes(weaponClass) ? weaponClass : null,
    sort: SORT_OPTIONS.includes(sort as WeaponSort) ? (sort as WeaponSort) : DEFAULT_FILTERS.sort,
    // Sem trim: o campo de pesquisa escreve aqui a cada tecla e tem de aceitar espaços.
    query: params.get('q') ?? '',
    onlyIncomplete: params.get('incompletas') === '1',
  };
}

/** Escreve só o que difere do valor por defeito, para o URL ficar curto. */
export function filtersToParams(filters: WeaponListFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.weaponClass) params.set('classe', filters.weaponClass);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('ordem', filters.sort);
  if (filters.query.trim()) params.set('q', filters.query);
  if (filters.onlyIncomplete) params.set('incompletas', '1');
  return params;
}

export interface WeaponListItem<W, C extends CamoLike> {
  weapon: W;
  unlocked: number;
  total: number;
  fraction: number;
  complete: boolean;
  /** Próximo camo com requisito conhecido (para "mais perto de desbloquear"). */
  closest: UnlockCandidate<C> | null;
}

/**
 * Aplica pesquisa, classe e "só incompletas", e ordena.
 * `camos` já deve vir com os overrides do utilizador aplicados.
 */
export function filterWeapons<W extends { id: string; name: string; weapon_class: string }, C extends CamoLike>(
  weapons: readonly W[],
  camos: readonly C[],
  index: ProgressIndex,
  filters: WeaponListFilters,
): WeaponListItem<W, C>[] {
  let list = sortWeapons(weapons);
  if (filters.weaponClass) list = list.filter((w) => w.weapon_class === filters.weaponClass);
  if (filters.query.trim()) {
    const matches = new Set(searchWeapons(list, filters.query).map((w) => w.id));
    list = list.filter((w) => matches.has(w.id));
  }

  let items = list.map((weapon): WeaponListItem<W, C> => {
    const summary = weaponSummary(weapon.id, camos, index);
    return {
      weapon,
      unlocked: summary.unlocked,
      total: summary.total,
      fraction: summary.total === 0 ? 0 : summary.unlocked / summary.total,
      complete: summary.total > 0 && summary.unlocked === summary.total,
      closest: nextMeasurableCamo(weapon.id, camos, index),
    };
  });
  if (filters.onlyIncomplete) items = items.filter((i) => !i.complete);

  // sortWeapons já deixou tudo por classe e nome: os sorts abaixo são estáveis.
  if (filters.sort === 'progresso') {
    items = [...items].sort((a, b) => b.fraction - a.fraction);
  } else if (filters.sort === 'perto') {
    items = [...items].sort((a, b) => {
      if (a.closest && b.closest) {
        return b.closest.fraction - a.closest.fraction || a.closest.remaining - b.closest.remaining;
      }
      // Armas sem nenhum camo medível (requisitos por confirmar) vão para o fim.
      return a.closest ? -1 : b.closest ? 1 : 0;
    });
  }
  return items;
}
