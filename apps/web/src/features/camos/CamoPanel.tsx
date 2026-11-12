import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { UnverifiedBadge } from '../../components/UnverifiedBadge';
import { describeError } from '../../lib/errors';
import { camoState, type CamoDisplayState, type CamoOverrideLike } from '../../lib/progress';
import type { CamoRow, WeaponRow } from '../catalog/queries';
import { NotesField } from './CamoBits';
import type { CamoProgressRow } from './queries';
import { useSaveOverride } from './userData';

interface Props {
  weapon: WeaponRow;
  /** Camo do catálogo (para o selo "por confirmar" e o texto original). */
  catalogCamo: CamoRow;
  /** O mesmo camo com o override aplicado. */
  camo: CamoRow;
  override: CamoOverrideLike | undefined;
  progress: CamoProgressRow | undefined;
  display: CamoDisplayState;
  /** null enquanto as notas carregam (para não escrever por cima de uma nota existente). */
  note: string | null;
  onSaveNote: (body: string) => Promise<unknown>;
  onSetCount: (count: number) => void;
  /** Botões −1/+1/+10: relativo ao último valor pedido (seguro com toques rápidos). */
  onChangeCountBy: (delta: number) => void;
  onToggleDone: () => void;
  onClose: () => void;
  saveError: unknown;
}

/** Painel de um camo: lateral no desktop, de baixo no telemóvel. Não é modal (os atalhos continuam). */
export function CamoPanel(props: Props) {
  const { weapon, catalogCamo, camo, progress, display, onClose } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const state = camoState(camo, progress);
  const isMastery = camo.requirement_type === 'prereq_all';
  const text = props.override?.requirement_text ?? catalogCamo.requirement_text;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [camo.id]);

  return (
    <aside
      role="dialog"
      aria-labelledby="camo-panel-title"
      className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-zinc-700 bg-zinc-900 shadow-2xl lg:inset-x-auto lg:top-0 lg:right-0 lg:bottom-0 lg:max-h-none lg:w-[24rem] lg:rounded-none lg:border-t-0 lg:border-l"
    >
      <div className="space-y-5 p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-zinc-400 uppercase">{weapon.name}</p>
            <h2
              id="camo-panel-title"
              ref={headingRef}
              tabIndex={-1}
              className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-semibold focus:outline-none"
            >
              {camo.name}
              {!catalogCamo.verified && <UnverifiedBadge />}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{text}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </header>

        {display === 'locked' && (
          <p className="rounded-md border border-zinc-700 bg-zinc-800/60 p-3 text-sm text-zinc-300">
            Bloqueado: conclui primeiro todos os camos anteriores desta arma.
          </p>
        )}

        {!isMastery && <Counter {...props} count={state.count} target={state.target} counted={state.counted} />}

        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.unlocked}
            disabled={display === 'locked'}
            onChange={props.onToggleDone}
            className="size-5 accent-emerald-500"
          />
          <span className={state.unlocked ? 'text-emerald-300' : 'text-zinc-200'}>Concluído</span>
          {progress?.unlocked_at && (
            <span className="text-xs text-zinc-500">
              em {new Date(progress.unlocked_at).toLocaleDateString('pt-PT')}
            </span>
          )}
        </label>

        {props.saveError != null && (
          <p role="alert" className="text-sm text-red-400">
            Não foi possível guardar: {describeError(props.saveError)}
          </p>
        )}

        {!catalogCamo.verified && !isMastery && (
          <OverrideForm key={camo.id} catalogCamo={catalogCamo} override={props.override} />
        )}

        {props.note === null ? (
          <p className="text-sm text-zinc-500">A carregar notas…</p>
        ) : (
          <NotesField
            key={`${weapon.id}:${camo.id}`}
            id={`camo-note-${camo.id}`}
            label="Notas do camo"
            initial={props.note}
            onSave={props.onSaveNote}
            placeholder="Ex.: melhor mapa para isto, estratégia…"
          />
        )}
      </div>
    </aside>
  );
}

function Counter({
  camo,
  count,
  target,
  counted,
  onSetCount,
  onChangeCountBy,
}: Props & { count: number; target: number | null; counted: boolean }) {
  const [draft, setDraft] = useState(String(count));
  // Mantém o campo em sincronia com os botões e os atalhos (ajuste durante o render,
  // como recomenda o React, em vez de um efeito).
  const [shownCount, setShownCount] = useState(count);
  if (shownCount !== count) {
    setShownCount(count);
    setDraft(String(count));
  }

  function commitDraft(event?: FormEvent) {
    event?.preventDefault();
    const parsed = Number(draft.trim() || '0');
    if (!Number.isInteger(parsed) || parsed < 0) {
      setDraft(String(count));
      return;
    }
    if (parsed !== count) onSetCount(parsed);
  }

  const unit = camo.requirement_type === 'headshots' ? 'headshots' : camo.requirement_type === 'kills' ? 'kills' : '';

  return (
    <div className="space-y-3">
      <p className="text-2xl font-semibold tabular-nums">
        {count}
        <span className="text-base font-normal text-zinc-400">
          {target !== null ? ` / ${target} ${unit}` : counted ? ` ${unit} · objetivo por confirmar` : ' · tipo e objetivo por confirmar'}
        </span>
      </p>
      {target !== null && <ProgressBar value={Math.min(count / target, 1)} label={`Progresso de ${camo.name}`} />}
      <form onSubmit={commitDraft} className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChangeCountBy(-1)} className="btn-secondary px-3">
          −1
        </button>
        <button type="button" onClick={() => onChangeCountBy(1)} className="btn-secondary px-3">
          +1
        </button>
        <button type="button" onClick={() => onChangeCountBy(10)} className="btn-secondary px-3">
          +10
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-zinc-400">
          <span className="sr-only">Contador</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitDraft()}
            className="input w-24 py-1.5 tabular-nums"
          />
        </label>
      </form>
    </div>
  );
}

function OverrideForm({ catalogCamo, override }: { catalogCamo: CamoRow; override: CamoOverrideLike | undefined }) {
  const save = useSaveOverride();
  const [type, setType] = useState(override?.requirement_type ?? '');
  const [value, setValue] = useState(override?.requirement_value != null ? String(override.requirement_value) : '');
  const [text, setText] = useState(override?.requirement_text ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = value.trim() ? Number(value) : null;
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
      setError('O objetivo tem de ser um número inteiro maior que 0.');
      return;
    }
    setError(null);
    save.mutate(
      {
        camoId: catalogCamo.id,
        requirementType: type === 'kills' || type === 'headshots' ? type : null,
        requirementValue: parsed,
        requirementText: text.trim() || null,
      },
      { onSuccess: () => setSaved(true), onError: (e) => setError(describeError(e)) },
    );
  }

  function reset() {
    setType('');
    setValue('');
    setText('');
    setSaved(false);
    save.mutate(
      { camoId: catalogCamo.id, requirementType: null, requirementValue: null, requirementText: null },
      { onError: (e) => setError(describeError(e)) },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-amber-800/50 bg-amber-950/20 p-3">
      <div>
        <h3 className="text-sm font-medium text-amber-200">Requisito por confirmar</h3>
        <p className="text-xs text-zinc-400">
          Se já sabes o desafio, preenche-o aqui. Fica guardado só para ti; o catálogo não muda.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-zinc-400">
          Conta
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setSaved(false);
            }}
            className="input mt-1 py-1.5"
          >
            <option value="">Por confirmar</option>
            <option value="kills">Kills</option>
            <option value="headshots">Headshots</option>
          </select>
        </label>
        <label className="text-xs text-zinc-400">
          Objetivo
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            placeholder="ex.: 200"
            className="input mt-1 py-1.5"
          />
        </label>
      </div>
      <label className="block text-xs text-zinc-400">
        Texto do desafio
        <input
          type="text"
          maxLength={200}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          placeholder={catalogCamo.requirement_text}
          className="input mt-1 py-1.5"
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        {saved && !save.isPending && <span className="text-xs text-emerald-400">Guardado</span>}
        {override && (
          <button type="button" onClick={reset} disabled={save.isPending} className="btn-secondary px-3 py-1.5">
            Repor
          </button>
        )}
        <button type="submit" disabled={save.isPending} className="btn-primary px-3 py-1.5">
          {save.isPending ? 'A guardar…' : 'Guardar requisito'}
        </button>
      </div>
    </form>
  );
}
