import { useCallback, useRef } from 'react';
import {
  camoDisplayState,
  camoState,
  isCountedRequirement,
  masteryUnlockedBy,
  progressKey,
  sortByTier,
} from '../../lib/progress';
import type { CamoRow, WeaponRow } from '../catalog/queries';
import { useUnlockAnimations } from '../unlocks/UnlockAnimations';
import { useSaveCamoProgress } from './queries';
import type { CamoData } from './useCamoData';

/**
 * Ações sobre o progresso de um camo (contador e "Concluído"), partilhadas pelo ecrã da arma
 * e pela grelha mestra. `camo` deve vir com o override aplicado (data.camos).
 */
export function useCamoActions(data: CamoData) {
  const save = useSaveCamoProgress();
  const { enqueue } = useUnlockAnimations();
  // Último valor pedido por arma:camo, ainda por confirmar. A cache do TanStack Query só recebe
  // o valor otimista depois de um await, por isso toques muito rápidos leriam o valor antigo.
  const pendingCounts = useRef(new Map<string, number>());

  // O camo concluído e os mastery que o servidor desbloqueia em cadeia por causa dele.
  const announceUnlock = useCallback(
    (weapon: WeaponRow, camo: CamoRow) => {
      const chained = masteryUnlockedBy(weapon.id, camo.id, data.camos, data.index);
      enqueue(
        [camo, ...chained].map((c) => ({ camoId: c.id, title: c.name, subtitle: weapon.name })),
      );
    },
    [data.camos, data.index, enqueue],
  );

  const setCount = useCallback(
    (weapon: WeaponRow, camo: CamoRow, count: number) => {
      const key = progressKey(weapon.id, camo.id);
      const row = data.index.get(key);
      const state = camoState(camo, row);
      // Atingir o objetivo marca o camo como concluído automaticamente.
      const reached =
        isCountedRequirement(camo.requirement_type) && camo.requirement_value !== null && count >= camo.requirement_value;
      if (reached && !state.unlocked) announceUnlock(weapon, camo);
      pendingCounts.current.set(key, count);
      save.mutate(
        {
          weaponId: weapon.id,
          camoId: camo.id,
          currentCount: count,
          unlocked: state.unlocked || reached,
          previousUnlockedAt: row?.unlocked_at ?? null,
        },
        {
          onSettled: () => {
            if (pendingCounts.current.get(key) === count) pendingCounts.current.delete(key);
          },
        },
      );
    },
    [announceUnlock, data.index, save],
  );

  const changeCountBy = useCallback(
    (weapon: WeaponRow, camo: CamoRow, delta: number) => {
      const key = progressKey(weapon.id, camo.id);
      const current = pendingCounts.current.get(key) ?? data.index.get(key)?.current_count ?? 0;
      setCount(weapon, camo, Math.max(current + delta, 0));
    },
    [data.index, setCount],
  );

  const toggleDone = useCallback(
    (weapon: WeaponRow, camo: CamoRow) => {
      if (camoDisplayState(weapon.id, camo, sortByTier(data.camos), data.index) === 'locked') return;
      const row = data.index.get(progressKey(weapon.id, camo.id));
      const unlocked = row?.unlocked_at == null;
      if (unlocked) announceUnlock(weapon, camo);
      save.mutate({
        weaponId: weapon.id,
        camoId: camo.id,
        currentCount: row?.current_count ?? 0,
        unlocked,
        previousUnlockedAt: row?.unlocked_at ?? null,
      });
    },
    [announceUnlock, data.camos, data.index, save],
  );

  return { setCount, changeCountBy, toggleDone, saveError: save.error };
}

export type CamoActions = ReturnType<typeof useCamoActions>;
