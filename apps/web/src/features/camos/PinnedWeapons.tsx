import { useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { ProgressBar } from '../../components/ProgressBar';
import type { CamoRow, WeaponRow } from '../catalog/queries';
import { PinButton } from './CamoBits';
import { moveItem, nextCamoInfo, PINNED_WARNING_AT, requirementUnit } from './pinned';
import type { CamoData } from './useCamoData';
import { useReorderPinned, useTogglePin } from './userData';

/**
 * Armas afixadas: ordem por arrastar e largar (desktop) ou pelos botões ↑/↓ (telemóvel, teclado).
 * Cada arma mostra o próximo camo e quanto falta.
 */
export function PinnedWeapons({ data, compact = false }: { data: CamoData; compact?: boolean }) {
  const reorder = useReorderPinned();
  const togglePin = useTogglePin();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const weapons = data.pinned
    .map((id) => data.weaponsById.get(id))
    .filter((w): w is WeaponRow => w !== undefined);

  if (weapons.length === 0) {
    return compact ? null : (
      <p className="card p-4 text-sm text-zinc-400">
        Ainda não afixaste nenhuma arma. Usa o alfinete num cartão para a teres sempre à mão aqui, no painel e no
        modo grind.
      </p>
    );
  }

  const ids = weapons.map((w) => w.id);
  function move(from: number, to: number) {
    const next = moveItem(ids, from, to);
    if (next.join() !== ids.join()) reorder.mutate(next);
  }

  function onDrop(event: DragEvent, to: number) {
    event.preventDefault();
    if (dragging !== null) move(dragging, to);
    setDragging(null);
    setOver(null);
  }

  return (
    <div className="space-y-2">
      {weapons.length >= PINNED_WARNING_AT && (
        <p className="text-xs text-amber-300">
          Tens {weapons.length} armas afixadas. Com muitas, a lista perde utilidade: considera desafixar as que já não
          estás a fazer.
        </p>
      )}
      <ol
        className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2 lg:grid-cols-3'}`}
        aria-label="Armas afixadas"
      >
        {weapons.map((weapon, i) => (
          <li
            key={weapon.id}
            draggable
            onDragStart={(e) => {
              setDragging(i);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', weapon.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => onDrop(e, i)}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            className={`card flex items-start gap-2 p-3 transition-colors ${
              dragging === i ? 'opacity-50' : ''
            } ${over === i && dragging !== i ? 'border-emerald-500' : ''}`}
          >
            <span aria-hidden className="mt-0.5 cursor-grab text-zinc-600 select-none" title="Arrastar para reordenar">
              ⋮⋮
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <Link to={`/camos/${weapon.id}`} className="font-medium hover:text-emerald-400">
                {weapon.name}
              </Link>
              <NextCamoLine weaponId={weapon.id} camos={data.camos} data={data} />
            </div>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={`Subir ${weapon.name}`}
                className="rounded px-1.5 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === weapons.length - 1}
                aria-label={`Descer ${weapon.name}`}
                className="rounded px-1.5 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30"
              >
                ↓
              </button>
              <PinButton
                pinned
                weaponName={weapon.name}
                onToggle={() => togglePin.mutate({ weaponId: weapon.id, pinned: false })}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function NextCamoLine({ weaponId, camos, data }: { weaponId: string; camos: CamoRow[]; data: CamoData }) {
  const info = nextCamoInfo(weaponId, camos, data.index);
  switch (info.kind) {
    case 'complete':
      return <p className="text-xs text-emerald-400">Todos os camos concluídos</p>;
    case 'mastery':
      return <p className="text-xs text-zinc-400">Próximo: {info.camo.name} (mastery)</p>;
    case 'unknown':
      return (
        <p className="text-xs text-zinc-400">
          Próximo: {info.camo.name} · <span className="text-amber-300">requisito por confirmar</span>
        </p>
      );
    case 'measurable':
      return (
        <div className="space-y-1">
          <p className="text-xs text-zinc-400">
            Próximo: {info.camo.name} · faltam {info.remaining} {requirementUnit(info.camo.requirement_type)}
          </p>
          <ProgressBar value={info.fraction} label={`Progresso de ${info.camo.name}`} className="h-1.5" />
        </div>
      );
  }
}
