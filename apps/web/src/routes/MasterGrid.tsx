import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorMessage, Loading } from '../components/QueryState';
import { UnverifiedBadge } from '../components/UnverifiedBadge';
import { CamoPanelHost } from '../features/camos/CamoPanelHost';
import { CELL_CLASSES, cellLevel } from '../features/camos/seals';
import { useCamoActions } from '../features/camos/useCamoActions';
import { useCamoData, type CamoData } from '../features/camos/useCamoData';
import { sortWeapons, weaponClassesOf } from '../features/camos/weapons';
import type { CamoRow, WeaponRow } from '../features/catalog/queries';
import { weaponClassLabel } from '../lib/labels';
import {
  camoDisplayState,
  camoState,
  formatPercent,
  overallCompletion,
  progressKey,
  sortByTier,
  weaponSummary,
} from '../lib/progress';

export default function MasterGrid() {
  const { data, isPending, error, retry } = useCamoData();
  if (isPending) return <Loading />;
  if (error || !data) return <ErrorMessage error={error} onRetry={retry} />;
  return <Grid data={data} />;
}

interface Cell {
  weapon: WeaponRow;
  camo: CamoRow;
}

function Grid({ data }: { data: CamoData }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const actions = useCamoActions(data);
  const [open, setOpen] = useState<Cell | null>(null);
  const [hovered, setHovered] = useState<Cell | null>(null);

  const camos = useMemo(() => sortByTier(data.camos), [data.camos]);
  const catalogById = useMemo(() => new Map(data.catalogCamos.map((c) => [c.id, c])), [data.catalogCamos]);
  const allWeapons = useMemo(() => sortWeapons(data.weapons), [data.weapons]);
  const classes = useMemo(() => weaponClassesOf(allWeapons), [allWeapons]);
  const classParam = searchParams.get('classe');
  const classFilter = classParam && classes.includes(classParam) ? classParam : null;
  const weapons = classFilter ? allWeapons.filter((w) => w.weapon_class === classFilter) : allWeapons;
  const groups = classes
    .filter((c) => !classFilter || c === classFilter)
    .map((c) => ({ weaponClass: c, weapons: weapons.filter((w) => w.weapon_class === c) }));

  const completion = overallCompletion(
    weapons.map((w) => w.id),
    camos,
    data.index,
  );

  // Esc fecha o painel.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const info = hovered ?? open;

  return (
    <section className={`space-y-4 ${open ? 'pb-[60vh] lg:pr-[24rem] lg:pb-0' : ''}`}>
      <header className="space-y-3">
        <Link to="/camos" className="text-sm text-zinc-400 hover:text-emerald-400">
          ← Camos
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Grelha mestra</h1>
          <p className="text-sm text-zinc-400">
            {completion.unlocked} de {completion.total} desbloqueados ·{' '}
            <span className="text-zinc-200">{formatPercent(completion.fraction)}</span>
          </p>
        </div>
        <ProgressBar value={completion.fraction} label="Progresso de camos na grelha" />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por classe">
          <FilterChip active={!classFilter} onClick={() => setSearchParams({}, { replace: true })}>
            Todas
          </FilterChip>
          {classes.map((c) => (
            <FilterChip
              key={c}
              active={classFilter === c}
              onClick={() => setSearchParams({ classe: c }, { replace: true })}
            >
              {weaponClassLabel(c)}
            </FilterChip>
          ))}
        </div>
      </header>

      {/* Linha de informação: o que está debaixo do rato (ou a célula aberta, no telemóvel). */}
      <p aria-live="polite" className="min-h-5 text-sm text-zinc-300">
        {info ? <CellInfo cell={info} data={data} /> : <span className="text-zinc-500">Passa o rato ou toca numa célula.</span>}
      </p>

      <div className="card max-h-[70vh] overflow-auto">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-zinc-900 px-3 py-2 text-left font-medium text-zinc-400">
                Arma
              </th>
              {camos.map((camo) => (
                <th
                  key={camo.id}
                  scope="col"
                  className="sticky top-0 z-20 h-32 bg-zinc-900 px-1 pb-2 align-bottom font-normal"
                >
                  <div className="mx-auto flex w-9 flex-col items-center justify-end gap-1">
                    <span
                      className="text-xs whitespace-nowrap text-zinc-300 [writing-mode:vertical-rl]"
                      style={{ transform: 'rotate(180deg)' }}
                    >
                      {camo.name}
                    </span>
                    {catalogById.get(camo.id)?.verified === false && <UnverifiedBadge compact />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.weaponClass}>
                <tr>
                  <th
                    colSpan={camos.length + 1}
                    scope="colgroup"
                    className="sticky left-0 z-10 bg-zinc-950/95 px-3 pt-3 pb-1 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase"
                  >
                    {weaponClassLabel(group.weaponClass)}
                  </th>
                </tr>
                {group.weapons.map((weapon) => {
                  const summary = weaponSummary(weapon.id, camos, data.index);
                  return (
                    <tr key={weapon.id} className="group">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-t border-zinc-800 bg-zinc-900 px-3 py-1.5 text-left font-normal group-hover:bg-zinc-800"
                      >
                        <Link to={`/camos/${weapon.id}`} className="block hover:text-emerald-400">
                          <span className="block whitespace-nowrap">{weapon.name}</span>
                          <span className="block text-xs text-zinc-500">
                            {summary.unlocked}/{summary.total}
                          </span>
                        </Link>
                      </th>
                      {camos.map((camo) => {
                        const state = camoState(camo, data.index.get(progressKey(weapon.id, camo.id)));
                        const locked = camoDisplayState(weapon.id, camo, camos, data.index) === 'locked';
                        const level = cellLevel(state);
                        const cell = { weapon, camo };
                        const isOpen = open?.weapon.id === weapon.id && open.camo.id === camo.id;
                        return (
                          <td key={camo.id} className="border-t border-zinc-800 p-1 text-center">
                            <button
                              type="button"
                              onClick={() => setOpen(isOpen ? null : cell)}
                              onMouseEnter={() => setHovered(cell)}
                              onMouseLeave={() => setHovered(null)}
                              onFocus={() => setHovered(cell)}
                              onBlur={() => setHovered(null)}
                              aria-label={`${weapon.name}, ${camo.name}: ${describeCell(state, locked)}`}
                              title={`${weapon.name} · ${camo.name}: ${describeCell(state, locked)}`}
                              className={`flex size-9 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                                CELL_CLASSES[level]
                              } ${locked ? 'opacity-40' : ''} ${isOpen ? 'ring-2 ring-white' : ''}`}
                            >
                              {state.unlocked ? '✓' : state.count > 0 ? compactCount(state.count) : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Legend />

      {open && (
        <CamoPanelHost
          key={`${open.weapon.id}:${open.camo.id}`}
          weapon={open.weapon}
          camo={data.camos.find((c) => c.id === open.camo.id) ?? open.camo}
          data={data}
          actions={actions}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

function describeCell(state: ReturnType<typeof camoState>, locked: boolean): string {
  if (state.unlocked) return 'concluído';
  if (locked) return 'bloqueado';
  if (state.target !== null) return `${state.count} de ${state.target}`;
  return state.count > 0 ? `${state.count}, objetivo por confirmar` : 'por confirmar';
}

function CellInfo({ cell, data }: { cell: Cell; data: CamoData }) {
  const camo = data.camos.find((c) => c.id === cell.camo.id) ?? cell.camo;
  const state = camoState(camo, data.index.get(progressKey(cell.weapon.id, camo.id)));
  const locked = camoDisplayState(cell.weapon.id, camo, sortByTier(data.camos), data.index) === 'locked';
  return (
    <>
      <span className="font-medium">{cell.weapon.name}</span> · {camo.name} ·{' '}
      <span className="text-zinc-400">{describeCell(state, locked)}</span>
    </>
  );
}

function compactCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}k`;
  return String(n);
}

function Legend() {
  const items: { cls: string; label: string }[] = [
    { cls: CELL_CLASSES.empty, label: 'por começar' },
    { cls: CELL_CLASSES.low, label: 'em progresso (até 33%)' },
    { cls: CELL_CLASSES.mid, label: '33–66%' },
    { cls: CELL_CLASSES.high, label: 'mais de 66%' },
    { cls: CELL_CLASSES.done, label: 'concluído' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block size-3 rounded-sm ${i.cls}`} /> {i.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <UnverifiedBadge compact /> requisito por confirmar
      </li>
    </ul>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? 'border-emerald-600 bg-emerald-600/20 text-emerald-200'
          : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
  );
}
