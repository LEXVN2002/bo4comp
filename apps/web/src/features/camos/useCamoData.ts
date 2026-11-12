import { useMemo } from 'react';
import { indexOverrides, indexProgress, withOverride, type OverrideIndex, type ProgressIndex } from '../../lib/progress';
import { useCatalog, type CamoRow, type WeaponRow } from '../catalog/queries';
import { useCamoProgress, type CamoProgressRow } from './queries';
import { useCamoOverrides, usePinnedWeapons } from './userData';

export interface CamoData {
  weapons: WeaponRow[];
  weaponsById: Map<string, WeaponRow>;
  /** Camos do catálogo, por tier. */
  catalogCamos: CamoRow[];
  /** Camos com o requisito efetivo (overrides do utilizador aplicados). */
  camos: CamoRow[];
  index: ProgressIndex<CamoProgressRow>;
  overrides: OverrideIndex;
  /** Ids das armas afixadas, pela ordem definida pelo utilizador. */
  pinned: string[];
}

/** Junta catálogo, progresso, overrides e armas afixadas para os ecrãs de camos. */
export function useCamoData() {
  const catalog = useCatalog();
  const progress = useCamoProgress();
  const overrides = useCamoOverrides();
  const pinned = usePinnedWeapons();

  const data = useMemo((): CamoData | undefined => {
    if (!catalog.data || !progress.data || !overrides.data || !pinned.data) return undefined;
    const overrideIndex = indexOverrides(overrides.data);
    return {
      weapons: catalog.data.weapons,
      weaponsById: catalog.data.weaponsById,
      catalogCamos: catalog.data.camos,
      camos: catalog.data.camos.map((c) => withOverride(c, overrideIndex.get(c.id))),
      index: indexProgress(progress.data),
      overrides: overrideIndex,
      pinned: pinned.data.map((p) => p.weapon_id),
    };
  }, [catalog.data, progress.data, overrides.data, pinned.data]);

  const queries = [catalog, progress, overrides, pinned];
  const failed = queries.find((q) => q.isError);
  return {
    data,
    isPending: queries.some((q) => q.isPending),
    error: failed?.error ?? null,
    retry: () => queries.forEach((q) => q.isError && q.refetch()),
  };
}
