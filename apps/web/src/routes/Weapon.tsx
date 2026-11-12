import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorMessage, Loading } from '../components/QueryState';
import { UnverifiedBadge } from '../components/UnverifiedBadge';
import { CamoSwatch, CompleteSeal, NotesField, PinButton } from '../features/camos/CamoBits';
import { CamoPanel } from '../features/camos/CamoPanel';
import { useSaveCamoProgress } from '../features/camos/queries';
import { moveIndex, SHORTCUT_HELP, shortcutFor } from '../features/camos/shortcuts';
import { useCamoData, type CamoData } from '../features/camos/useCamoData';
import { useUnlockAnimations } from '../features/unlocks/UnlockAnimations';
import {
  useCamoNotes,
  useSaveCamoNote,
  useSaveWeaponNote,
  useTogglePin,
  useWeaponNote,
  useWeaponRecentStats,
} from '../features/camos/userData';
import type { CamoRow, WeaponRow } from '../features/catalog/queries';
import { formatDateTime } from '../lib/format';
import { weaponClassLabel } from '../lib/labels';
import {
  camoDisplayState,
  camoState,
  estimateMatches,
  formatPercent,
  isCountedRequirement,
  progressKey,
  sortByTier,
  weaponSummary,
} from '../lib/progress';

export default function Weapon() {
  const { weaponId = '' } = useParams();
  const { data, isPending, error, retry } = useCamoData();

  if (isPending) return <Loading />;
  if (error || !data) return <ErrorMessage error={error} onRetry={retry} />;

  const weapon = data.weaponsById.get(weaponId);
  if (!weapon) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Arma não encontrada</h1>
        <Link to="/camos" className="text-emerald-400 hover:underline">
          Voltar aos camos
        </Link>
      </section>
    );
  }
  // key: ao mudar de arma, o estado (seleção, painel) recomeça.
  return <WeaponScreen key={weapon.id} weapon={weapon} data={data} />;
}

function WeaponScreen({ weapon, data }: { weapon: WeaponRow; data: CamoData }) {
  const camos = useMemo(() => sortByTier(data.camos), [data.camos]);
  const catalogById = useMemo(() => new Map(data.catalogCamos.map((c) => [c.id, c])), [data.catalogCamos]);
  const save = useSaveCamoProgress();
  const togglePin = useTogglePin();
  const notes = useCamoNotes(weapon.id);
  const saveNote = useSaveCamoNote(weapon.id);
  const weaponNote = useWeaponNote(weapon.id);
  const saveWeaponNote = useSaveWeaponNote(weapon.id);
  const recentStats = useWeaponRecentStats(weapon.id);

  const [selected, setSelected] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const { enqueue } = useUnlockAnimations();
  const helpRef = useRef<HTMLDialogElement>(null);
  const gridRef = useRef<HTMLOListElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const pinned = data.pinned.includes(weapon.id);
  const summary = weaponSummary(weapon.id, camos, data.index);
  const selectedCamo = camos[selected];

  // Último valor pedido por camo, ainda por confirmar. A cache do TanStack Query só recebe
  // o valor otimista depois de um await, por isso toques muito rápidos leriam o valor antigo.
  const pendingCounts = useRef(new Map<string, number>());

  const setCount = useCallback(
    (camo: CamoRow, count: number) => {
      const row = data.index.get(progressKey(weapon.id, camo.id));
      const state = camoState(camo, row);
      // Atingir o objetivo marca o camo como concluído automaticamente.
      const reached =
        isCountedRequirement(camo.requirement_type) && camo.requirement_value !== null && count >= camo.requirement_value;
      if (reached && !state.unlocked) enqueue([{ camoId: camo.id, title: camo.name, subtitle: weapon.name }]);
      pendingCounts.current.set(camo.id, count);
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
            if (pendingCounts.current.get(camo.id) === count) pendingCounts.current.delete(camo.id);
          },
        },
      );
    },
    [data.index, enqueue, save, weapon.id, weapon.name],
  );

  const changeCountBy = useCallback(
    (camo: CamoRow, delta: number) => {
      const current =
        pendingCounts.current.get(camo.id) ?? data.index.get(progressKey(weapon.id, camo.id))?.current_count ?? 0;
      setCount(camo, Math.max(current + delta, 0));
    },
    [data.index, setCount, weapon.id],
  );

  const toggleDone = useCallback(
    (camo: CamoRow) => {
      if (camoDisplayState(weapon.id, camo, camos, data.index) === 'locked') return;
      const row = data.index.get(progressKey(weapon.id, camo.id));
      const unlocked = row?.unlocked_at == null;
      if (unlocked) enqueue([{ camoId: camo.id, title: camo.name, subtitle: weapon.name }]);
      save.mutate({
        weaponId: weapon.id,
        camoId: camo.id,
        currentCount: row?.current_count ?? 0,
        unlocked,
        previousUnlockedAt: row?.unlocked_at ?? null,
      });
    },
    [camos, data.index, enqueue, save, weapon.id, weapon.name],
  );

  // ---------- Atalhos de teclado ----------
  useEffect(() => {
    function columns(): number {
      const grid = gridRef.current;
      if (!grid) return 1;
      return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    }
    function onKeyDown(event: KeyboardEvent) {
      const action = shortcutFor({
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        target: event.target instanceof HTMLElement ? event.target : null,
      });
      if (!action) return;
      const camo = camos[selected];
      const helpOpen = helpRef.current?.open ?? false;
      if (helpOpen && action.type !== 'help') return; // o diálogo trata do Esc
      switch (action.type) {
        case 'move': {
          const next = moveIndex(selected, action.dx, action.dy, camos.length, columns());
          setSelected(next);
          tileRefs.current[next]?.focus();
          break;
        }
        case 'toggle-panel':
          // Enter num botão já o "clica"; aqui só se trata quando o foco não está num controlo.
          if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return;
          setPanelOpen((open) => !open);
          break;
        case 'count':
          if (camo && camo.requirement_type !== 'prereq_all') changeCountBy(camo, action.delta);
          break;
        case 'toggle-done':
          if (camo) toggleDone(camo);
          break;
        case 'toggle-pin':
          togglePin.mutate({ weaponId: weapon.id, pinned: !pinned });
          break;
        case 'close':
          if (!panelOpen) return;
          setPanelOpen(false);
          tileRefs.current[selected]?.focus();
          break;
        case 'help':
          if (helpOpen) helpRef.current?.close();
          else helpRef.current?.showModal();
          break;
      }
      event.preventDefault();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [camos, changeCountBy, panelOpen, pinned, selected, toggleDone, togglePin, weapon.id]);

  const timeline = camos
    .map((camo) => ({ camo, at: data.index.get(progressKey(weapon.id, camo.id))?.unlocked_at ?? null }))
    .filter((e): e is { camo: CamoRow; at: string } => e.at !== null)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const fraction = summary.total ? summary.unlocked / summary.total : 0;

  function panelEstimate(camo: CamoRow) {
    const state = camoState(camo, data.index.get(progressKey(weapon.id, camo.id)));
    if (state.unlocked || state.target === null) return null;
    if (camo.requirement_type !== 'kills' && camo.requirement_type !== 'headshots') return null;
    if (!recentStats.data) return recentStats.isError ? null : 'loading';
    return estimateMatches(state.target - state.count, camo.requirement_type, recentStats.data);
  }

  return (
    <section className={`space-y-6 ${panelOpen ? 'pb-[60vh] lg:pr-[24rem] lg:pb-0' : ''}`}>
      <header className="space-y-2">
        <Link to={`/camos?classe=${weapon.weapon_class}`} className="text-sm text-zinc-400 hover:text-emerald-400">
          ← {weaponClassLabel(weapon.weapon_class)}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {weapon.name}
            {summary.total > 0 && summary.unlocked === summary.total && <CompleteSeal />}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => helpRef.current?.showModal()}
              className="hidden rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100 md:block"
              title="Atalhos de teclado (?)"
            >
              ? Atalhos
            </button>
            <PinButton
              pinned={pinned}
              weaponName={weapon.name}
              onToggle={() => togglePin.mutate({ weaponId: weapon.id, pinned: !pinned })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar value={fraction} label={`Camos da ${weapon.name}`} className="flex-1" />
          <span className="text-sm text-zinc-400 tabular-nums">
            {summary.unlocked}/{summary.total} · {formatPercent(fraction)}
          </span>
        </div>
      </header>

      <ol
        ref={gridRef}
        className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6"
        aria-label={`Camos da ${weapon.name}`}
      >
        {camos.map((camo, i) => {
          const row = data.index.get(progressKey(weapon.id, camo.id));
          const state = camoState(camo, row);
          const display = camoDisplayState(weapon.id, camo, camos, data.index);
          const catalogCamo = catalogById.get(camo.id);
          const statusText =
            display === 'done'
              ? 'concluído'
              : display === 'locked'
                ? 'bloqueado'
                : state.target !== null
                  ? `${state.count} de ${state.target}`
                  : 'por confirmar';
          return (
            <li key={camo.id}>
              <button
                ref={(el) => {
                  tileRefs.current[i] = el;
                }}
                type="button"
                onClick={() => {
                  // Clique (ou Enter) no camo já aberto fecha o painel.
                  if (panelOpen && selected === i) {
                    setPanelOpen(false);
                    return;
                  }
                  setSelected(i);
                  setPanelOpen(true);
                }}
                onFocus={() => setSelected(i)}
                aria-label={`${camo.name}: ${statusText}`}
                aria-current={panelOpen && selected === i ? 'true' : undefined}
                className={`group w-full rounded-lg p-1 text-left transition-colors focus-visible:outline-none ${
                  selected === i ? 'bg-zinc-800/80 ring-2 ring-emerald-500/70' : 'hover:bg-zinc-800/50'
                }`}
              >
                <CamoSwatch camoId={camo.id} state={display} fraction={state.fraction} className="aspect-square w-full" />
                <span className="mt-1 flex items-center gap-1 text-xs font-medium text-zinc-200">
                  <span className="truncate">{camo.name}</span>
                  {catalogCamo && !catalogCamo.verified && <UnverifiedBadge compact />}
                </span>
                <span className="block text-[11px] text-zinc-500 tabular-nums">{statusText}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card space-y-3 p-4">
          {weaponNote.isPending ? (
            <p className="text-sm text-zinc-500">A carregar notas…</p>
          ) : (
            <NotesField
              id={`weapon-note-${weapon.id}`}
              label="Notas da arma"
              initial={weaponNote.data ?? ''}
              onSave={(body) => saveWeaponNote.mutateAsync(body)}
              placeholder="Ex.: attachments, mapa preferido…"
            />
          )}
        </section>

        <section className="card space-y-2 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Linha do tempo</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-zinc-500">Ainda não concluíste nenhum camo nesta arma.</p>
          ) : (
            <ol className="space-y-2">
              {timeline.map(({ camo, at }) => (
                <li key={camo.id} className="flex items-center gap-3 text-sm">
                  <CamoSwatch camoId={camo.id} state="done" fraction={1} className="size-7 shrink-0" />
                  <span className="flex-1 font-medium">{camo.name}</span>
                  <time dateTime={at} className="text-xs text-zinc-500">
                    {formatDateTime(at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {panelOpen && selectedCamo && (
        <CamoPanel
          weapon={weapon}
          catalogCamo={catalogById.get(selectedCamo.id) ?? selectedCamo}
          camo={selectedCamo}
          override={data.overrides.get(selectedCamo.id)}
          progress={data.index.get(progressKey(weapon.id, selectedCamo.id))}
          display={camoDisplayState(weapon.id, selectedCamo, camos, data.index)}
          note={notes.data ? (notes.data.find((n) => n.camo_id === selectedCamo.id)?.body ?? '') : null}
          onSaveNote={(body) => saveNote.mutateAsync({ camoId: selectedCamo.id, body })}
          onSetCount={(count) => setCount(selectedCamo, count)}
          onChangeCountBy={(delta) => changeCountBy(selectedCamo, delta)}
          onToggleDone={() => toggleDone(selectedCamo)}
          onClose={() => {
            setPanelOpen(false);
            tileRefs.current[selected]?.focus();
          }}
          saveError={save.error}
          estimate={panelEstimate(selectedCamo)}
        />
      )}

      <dialog
        ref={helpRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) helpRef.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/70"
      >
        <div className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Atalhos de teclado</h2>
          <table className="w-full text-sm">
            <tbody>
              {SHORTCUT_HELP.map((s) => (
                <tr key={s.keys} className="border-t border-zinc-800">
                  <td className="py-1.5 pr-3">
                    <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-xs">{s.keys}</kbd>
                  </td>
                  <td className="py-1.5 text-zinc-300">{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-zinc-500">Desligados enquanto escreves num campo de texto.</p>
          <div className="flex justify-end">
            <button type="button" onClick={() => helpRef.current?.close()} className="btn-secondary px-3 py-1.5">
              Fechar
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
