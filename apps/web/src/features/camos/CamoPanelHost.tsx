import { useMemo } from 'react';
import { camoDisplayState, camoState, estimateMatches, progressKey, sortByTier } from '../../lib/progress';
import type { CamoRow, WeaponRow } from '../catalog/queries';
import { CamoPanel } from './CamoPanel';
import type { CamoActions } from './useCamoActions';
import type { CamoData } from './useCamoData';
import { useCamoNotes, useSaveCamoNote, useWeaponRecentStats } from './userData';

/** Liga o painel de um camo aos dados (notas, estimativa) e às ações. Usado na arma e na grelha mestra. */
export function CamoPanelHost({
  weapon,
  camo,
  data,
  actions,
  onClose,
}: {
  weapon: WeaponRow;
  /** Camo com o override aplicado. */
  camo: CamoRow;
  data: CamoData;
  actions: CamoActions;
  onClose: () => void;
}) {
  const notes = useCamoNotes(weapon.id);
  const saveNote = useSaveCamoNote(weapon.id);
  const recentStats = useWeaponRecentStats(weapon.id);
  const camos = useMemo(() => sortByTier(data.camos), [data.camos]);
  const catalogCamo = data.catalogCamos.find((c) => c.id === camo.id) ?? camo;
  const progress = data.index.get(progressKey(weapon.id, camo.id));

  function estimate() {
    const state = camoState(camo, progress);
    if (state.unlocked || state.target === null) return null;
    if (camo.requirement_type !== 'kills' && camo.requirement_type !== 'headshots') return null;
    if (!recentStats.data) return recentStats.isError ? null : 'loading';
    return estimateMatches(state.target - state.count, camo.requirement_type, recentStats.data);
  }

  return (
    <CamoPanel
      weapon={weapon}
      catalogCamo={catalogCamo}
      camo={camo}
      override={data.overrides.get(camo.id)}
      progress={progress}
      display={camoDisplayState(weapon.id, camo, camos, data.index)}
      note={notes.data ? (notes.data.find((n) => n.camo_id === camo.id)?.body ?? '') : null}
      onSaveNote={(body) => saveNote.mutateAsync({ camoId: camo.id, body })}
      onSetCount={(count) => actions.setCount(weapon, camo, count)}
      onChangeCountBy={(delta) => actions.changeCountBy(weapon, camo, delta)}
      onToggleDone={() => actions.toggleDone(weapon, camo)}
      onClose={onClose}
      saveError={actions.saveError}
      estimate={estimate()}
    />
  );
}
