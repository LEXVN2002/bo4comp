import { useState, type FormEvent } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { UnverifiedBadge } from '../../components/UnverifiedBadge';
import { describeError } from '../../lib/errors';
import { formatDateTime, formatPlayers } from '../../lib/format';
import { playersRange, sortSteps, stepProgress } from './progress';
import {
  useAddCompletion,
  useDeleteCompletion,
  useToggleStep,
  type CompletionRow,
  type EasterEggWithSteps,
} from './queries';

const TYPE_LABELS: Record<string, string> = {
  main: 'Principal',
  side: 'Secundário',
  song: 'Música',
  music: 'Música',
  other: 'Outro',
};

interface Props {
  egg: EasterEggWithSteps;
  doneSteps: ReadonlySet<string>;
  /** Conclusões deste easter egg, mais recentes primeiro. */
  completions: CompletionRow[];
}

export function EasterEggCard({ egg, doneSteps, completions }: Props) {
  const steps = sortSteps(egg.easter_egg_steps);
  const progress = stepProgress(steps, doneSteps);
  const toggle = useToggleStep();
  const players = playersRange(egg.min_players, egg.max_players);
  const completed = completions.length > 0;

  return (
    <article className="card space-y-3 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            {egg.name}
            {!egg.verified && <UnverifiedBadge />}
          </h3>
          <p className="text-xs text-zinc-400">
            {TYPE_LABELS[egg.type] ?? egg.type}
            {players && ` · ${players}`}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            completed ? 'bg-emerald-600/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {completed
            ? completions.length === 1
              ? 'Concluído'
              : `Concluído ${completions.length}×`
            : 'Por concluir'}
        </span>
      </header>

      {steps.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <ProgressBar value={progress.fraction} label={`Passos de ${egg.name}`} className="flex-1" />
            <span className="text-xs text-zinc-400 tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </div>
          <ol className="space-y-1">
            {steps.map((step) => {
              const done = doneSteps.has(step.id);
              return (
                <li key={step.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-800/60">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggle.mutate({ stepId: step.id, done: !done })}
                      className="mt-0.5 size-4 shrink-0 accent-emerald-500"
                    />
                    <span className="min-w-0 text-sm">
                      <span className={done ? 'text-zinc-500 line-through' : 'text-zinc-100'}>
                        {step.step_order}. {step.title}
                      </span>
                      {step.details && <span className="mt-0.5 block text-xs text-zinc-400">{step.details}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ol>
          {toggle.isError && (
            <p role="alert" className="text-xs text-red-400">
              Não foi possível guardar o passo: {describeError(toggle.error)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Ainda não há passos registados para este easter egg. Marca-o como concluído quando o terminares.
        </p>
      )}

      <CompletionControls egg={egg} completions={completions} />
    </article>
  );
}

function CompletionControls({ egg, completions }: { egg: EasterEggWithSteps; completions: CompletionRow[] }) {
  const add = useAddCompletion();
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState('');
  const [notes, setNotes] = useState('');
  const [showAll, setShowAll] = useState(false);

  const minPlayers = egg.min_players ?? 1;
  const maxPlayers = egg.max_players ?? 4;
  const playerOptions = Array.from({ length: maxPlayers - minPlayers + 1 }, (_, i) => minPlayers + i);
  const visible = showAll ? completions : completions.slice(0, 3);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    add.mutate(
      {
        easterEggId: egg.id,
        players: players ? Number(players) : null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setPlayers('');
          setNotes('');
        },
      },
    );
  }

  return (
    <div className="space-y-2 border-t border-zinc-800 pt-3">
      {visible.length > 0 && (
        <ul className="space-y-1">
          {visible.map((c) => (
            <CompletionItem key={c.id} completion={c} />
          ))}
        </ul>
      )}
      {completions.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-zinc-400 hover:text-zinc-100"
        >
          {showAll ? 'Mostrar menos' : `Mostrar todas (${completions.length})`}
        </button>
      )}

      {open ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-[auto_1fr] items-center gap-2">
            <label htmlFor={`${egg.id}-players`} className="text-xs text-zinc-400">
              Jogadores
            </label>
            <select
              id={`${egg.id}-players`}
              value={players}
              onChange={(e) => setPlayers(e.target.value)}
              className="input py-1.5"
            >
              <option value="">Não indicar</option>
              {playerOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <label htmlFor={`${egg.id}-notes`} className="text-xs text-zinc-400">
              Notas
            </label>
            <input
              id={`${egg.id}-notes`}
              type="text"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input py-1.5"
              placeholder="Opcional"
            />
          </div>
          {add.isError && (
            <p role="alert" className="text-xs text-red-400">
              Não foi possível registar: {describeError(add.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3 py-1.5">
              Cancelar
            </button>
            <button type="submit" disabled={add.isPending} className="btn-primary px-3 py-1.5">
              {add.isPending ? 'A registar…' : 'Confirmar conclusão'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full py-1.5">
          Marcar como concluído
        </button>
      )}
    </div>
  );
}

function CompletionItem({ completion }: { completion: CompletionRow }) {
  const remove = useDeleteCompletion();
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-center gap-2 text-xs text-zinc-400">
      <span className="text-emerald-400">✓</span>
      <span className="min-w-0 flex-1 truncate">
        {formatDateTime(completion.completed_at)}
        {completion.players != null && ` · ${formatPlayers(completion.players)}`}
        {completion.notes && ` · ${completion.notes}`}
      </span>
      {confirming ? (
        <>
          <button type="button" onClick={() => setConfirming(false)} className="hover:text-zinc-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate(completion.id)}
            className="text-red-400 hover:text-red-300"
          >
            {remove.isPending ? 'A remover…' : 'Remover'}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Remover conclusão"
          className="rounded px-1 hover:bg-zinc-800 hover:text-zinc-100"
        >
          ✕
        </button>
      )}
    </li>
  );
}
