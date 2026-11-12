import { useEffect, useRef, useState } from 'react';
import { weaponClassLabel } from '../../lib/labels';
import { camoDisplayState, camoState, overallCompletion, progressKey, sortByTier, weaponSummary } from '../../lib/progress';
import { describeError } from '../../lib/errors';
import { sealPatternId } from '../camos/ClassSeals';
import { allClassSeals, cellLevel } from '../camos/seals';
import type { CamoData } from '../camos/useCamoData';
import { sortWeapons } from '../camos/weapons';
import type { WeaponRow } from '../catalog/queries';
import { useUserSettings } from '../grind/queries';
import { shareFileName } from './cardLayout';
import { renderCardBlob, type CardInput } from './renderCard';

function seals(data: CamoData) {
  return allClassSeals(data.weapons, data.camos, data.index).map((s) => ({
    label: weaponClassLabel(s.weaponClass),
    patternId: sealPatternId(s.weaponClass),
    complete: s.complete,
    fraction: s.fraction,
  }));
}

export function weaponCardInput(weapon: WeaponRow, data: CamoData, playerName: string | null): CardInput {
  const camos = sortByTier(data.camos);
  const summary = weaponSummary(weapon.id, camos, data.index);
  return {
    title: weapon.name,
    subtitle: weaponClassLabel(weapon.weapon_class),
    unlocked: summary.unlocked,
    total: summary.total,
    tiles: camos.map((camo) => ({
      camoId: camo.id,
      name: camo.name,
      state: camoDisplayState(weapon.id, camo, camos, data.index),
      fraction: camoState(camo, data.index.get(progressKey(weapon.id, camo.id))).fraction,
    })),
    seals: seals(data),
    playerName,
    date: new Date(),
  };
}

export function globalCardInput(data: CamoData, playerName: string | null): CardInput {
  const camos = sortByTier(data.camos);
  const weapons = sortWeapons(data.weapons);
  const completion = overallCompletion(
    weapons.map((w) => w.id),
    camos,
    data.index,
  );
  return {
    title: 'Progresso global',
    subtitle: `${weapons.length} armas · ${camos.length} camos por arma`,
    unlocked: completion.unlocked,
    total: completion.total,
    matrix: weapons.map((w) => ({
      label: w.name,
      cells: camos.map((c) => cellLevel(camoState(c, data.index.get(progressKey(w.id, c.id))))),
    })),
    seals: seals(data),
    playerName,
    date: new Date(),
  };
}

type State =
  | { kind: 'idle' }
  | { kind: 'rendering' }
  | { kind: 'ready'; url: string; file: File }
  | { kind: 'error'; message: string };

/** Botão "Partilhar progresso": gera o PNG, mostra a pré-visualização e deixa descarregar ou partilhar. */
export function ShareButton({
  build,
  className = 'btn-secondary px-3 py-1.5',
}: {
  /** Monta os dados do cartão no momento do clique (com o nome de jogador das definições). */
  build: (playerName: string | null) => CardInput;
  className?: string;
}) {
  const settings = useUserSettings();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });

  // Libertar o URL da imagem quando deixar de ser preciso.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const url = state.url;
    return () => URL.revokeObjectURL(url);
  }, [state]);

  async function open() {
    setState({ kind: 'rendering' });
    dialogRef.current?.showModal();
    try {
      const input = build(settings.data?.player_name ?? null);
      const blob = await renderCardBlob(input);
      const file = new File([blob], shareFileName(input.title, input.date), { type: 'image/png' });
      setState({ kind: 'ready', url: URL.createObjectURL(blob), file });
    } catch (error) {
      setState({ kind: 'error', message: describeError(error) });
    }
  }

  function close() {
    dialogRef.current?.close();
    setState({ kind: 'idle' });
  }

  const canShareFile =
    state.kind === 'ready' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [state.file] });

  return (
    <>
      <button type="button" onClick={() => void open()} className={className}>
        Partilhar progresso
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setState({ kind: 'idle' })}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/70"
      >
        <div className="space-y-4 p-4">
          <h2 className="text-lg font-semibold">Cartão de progresso</h2>
          {state.kind === 'rendering' && <p className="text-sm text-zinc-400">A gerar a imagem…</p>}
          {state.kind === 'error' && (
            <p role="alert" className="text-sm text-red-400">
              {state.message}
            </p>
          )}
          {state.kind === 'ready' && (
            <img
              src={state.url}
              alt="Pré-visualização do cartão de progresso"
              width={1080}
              height={1350}
              className="h-auto w-full rounded-md border border-zinc-800"
            />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} className="btn-secondary">
              Fechar
            </button>
            {state.kind === 'ready' && canShareFile && (
              <button
                type="button"
                onClick={() =>
                  void navigator.share({ files: [state.file], title: 'Progresso BO4 Zombies' }).catch(() => {})
                }
                className="btn-secondary"
              >
                Partilhar
              </button>
            )}
            {state.kind === 'ready' && (
              <a href={state.url} download={state.file.name} className="btn-primary">
                Descarregar PNG
              </a>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
