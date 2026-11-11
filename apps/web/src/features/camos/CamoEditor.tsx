import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { UnverifiedBadge } from '../../components/UnverifiedBadge';
import { describeError } from '../../lib/errors';
import { camoState } from '../../lib/progress';
import type { CamoRow, WeaponRow } from '../catalog/queries';
import { useSaveCamoProgress, type CamoProgressRow } from './queries';

export interface CamoEditorTarget {
  weapon: WeaponRow;
  camo: CamoRow;
  progress: CamoProgressRow | undefined;
}

interface Props {
  target: CamoEditorTarget | null;
  onClose: () => void;
}

/** Diálogo para editar o contador de um camo e marcá-lo como (des)bloqueado. */
export function CamoEditor({ target, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // Clicar fora do conteúdo (no backdrop) fecha o diálogo.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/70"
    >
      {target && (
        <EditorForm
          key={`${target.weapon.id}:${target.camo.id}`}
          target={target}
          onDone={onClose}
        />
      )}
    </dialog>
  );
}

function EditorForm({ target, onDone }: { target: CamoEditorTarget; onDone: () => void }) {
  const { weapon, camo, progress } = target;
  const state = camoState(camo, progress);
  const save = useSaveCamoProgress();
  const [count, setCount] = useState(String(state.count));
  const [error, setError] = useState<string | null>(null);
  const showCounter = camo.requirement_type !== 'prereq_all';

  function submit(unlocked: boolean) {
    const parsed = showCounter ? Number(count.trim() || '0') : state.count;
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('O contador tem de ser um número inteiro maior ou igual a 0.');
      return;
    }
    setError(null);
    save.mutate(
      {
        weaponId: weapon.id,
        camoId: camo.id,
        currentCount: parsed,
        unlocked,
        previousUnlockedAt: progress?.unlocked_at ?? null,
      },
      { onSuccess: onDone, onError: (e) => setError(describeError(e)) },
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit(state.unlocked);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5">
      <header>
        <p className="text-xs tracking-wide text-zinc-400 uppercase">{weapon.name}</p>
        <h2 className="mt-0.5 flex items-center gap-2 text-lg font-semibold">
          {camo.name}
          {!camo.verified && <UnverifiedBadge />}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{camo.requirement_text}</p>
        <p className="mt-2 text-sm">
          Estado:{' '}
          <span className={state.unlocked ? 'text-emerald-400' : 'text-zinc-300'}>
            {state.unlocked ? 'desbloqueado' : 'bloqueado'}
          </span>
        </p>
      </header>

      {showCounter && (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="text-zinc-300">
              Contador
              {state.target !== null
                ? ` (objetivo: ${state.target})`
                : state.counted
                  ? ' (objetivo por confirmar)'
                  : ''}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="input mt-1"
            />
          </label>
          {state.target !== null && (
            <ProgressBar
              value={Math.min(Number(count) / state.target, 1) || 0}
              label={`Progresso de ${camo.name}`}
            />
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="btn-secondary">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => submit(!state.unlocked)}
          disabled={save.isPending}
          className="btn-secondary"
        >
          {state.unlocked ? 'Marcar como bloqueado' : 'Marcar como desbloqueado'}
        </button>
        {showCounter && (
          <button type="submit" disabled={save.isPending} className="btn-primary">
            {save.isPending ? 'A guardar…' : 'Guardar'}
          </button>
        )}
      </div>
    </form>
  );
}
