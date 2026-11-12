import { useEffect, useMemo, useRef } from 'react';
import { weaponClassLabel } from '../../lib/labels';
import { formatPercent } from '../../lib/progress';
import { useUnlockAnimations } from '../unlocks/UnlockAnimations';
import { camoPattern } from './camoPattern';
import { allClassSeals, newlyCompletedSeals } from './seals';
import { useCamoData, type CamoData } from './useCamoData';

/** Id usado para o padrão em CSS do selo de uma classe. */
export function sealPatternId(weaponClass: string): string {
  return `selo-${weaponClass}`;
}

/** Selos de classe: completos com a data; bloqueados a cinzento com a % da classe. */
export function ClassSeals({ data }: { data: CamoData }) {
  const seals = useMemo(() => allClassSeals(data.weapons, data.camos, data.index), [data]);
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Selos de classe">
      {seals.map((seal) => (
        <li
          key={seal.weaponClass}
          className={`flex items-center gap-3 rounded-lg border p-2.5 ${
            seal.complete
              ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
              : 'border-zinc-800 bg-zinc-900/60'
          }`}
        >
          <span
            aria-hidden
            className={`relative size-9 shrink-0 overflow-hidden rounded-full ${
              seal.complete ? 'ring-2 ring-emerald-400' : 'opacity-30 grayscale'
            }`}
          >
            <span className="absolute inset-0" style={camoPattern(sealPatternId(seal.weaponClass)).style} />
          </span>
          <span className="min-w-0">
            <span className={`block truncate text-sm font-medium ${seal.complete ? 'text-emerald-200' : 'text-zinc-300'}`}>
              {weaponClassLabel(seal.weaponClass)}
            </span>
            <span className="block text-xs text-zinc-500">
              {seal.complete && seal.earnedAt
                ? new Date(seal.earnedAt).toLocaleDateString('pt-PT')
                : `${formatPercent(seal.fraction)} · ${seal.unlocked}/${seal.total}`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Corre a animação "MASTERY DE CLASSE" quando uma classe fica completa,
 * venha o desbloqueio de onde vier (grelha, arma, modo grind).
 */
export function ClassSealWatcher() {
  const { data } = useCamoData();
  const { enqueue } = useUnlockAnimations();
  const previous = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    const seals = allClassSeals(data.weapons, data.camos, data.index);
    // Na primeira leitura só se regista o estado: os selos antigos não voltam a animar.
    if (previous.current) {
      enqueue(
        newlyCompletedSeals(previous.current, seals).map((s) => ({
          camoId: sealPatternId(s.weaponClass),
          title: weaponClassLabel(s.weaponClass),
          subtitle: 'Todos os camos de todas as armas da classe',
          label: 'MASTERY DE CLASSE',
        })),
      );
    }
    previous.current = new Set(seals.filter((s) => s.complete).map((s) => s.weaponClass));
  }, [data, enqueue]);

  return null;
}
