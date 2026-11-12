import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorMessage, Loading } from '../components/QueryState';
import { UnverifiedBadge } from '../components/UnverifiedBadge';
import { useCatalog, type CamoRow } from '../features/catalog/queries';
import { CamoEditor, type CamoEditorTarget } from '../features/camos/CamoEditor';
import { useCamoProgress } from '../features/camos/queries';
import { sortWeapons, weaponClassesOf } from '../features/camos/weapons';
import { weaponClassLabel } from '../lib/labels';
import {
  camoState,
  formatPercent,
  indexProgress,
  overallCompletion,
  progressKey,
  weaponSummary,
  type CamoState,
} from '../lib/progress';

export default function MasterGrid() {
  const catalog = useCatalog();
  const progress = useCamoProgress();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<CamoEditorTarget | null>(null);
  const classFilter = searchParams.get('classe');

  const index = useMemo(() => indexProgress(progress.data ?? []), [progress.data]);
  const allWeapons = useMemo(() => sortWeapons(catalog.data?.weapons ?? []), [catalog.data]);
  const classes = useMemo(() => weaponClassesOf(allWeapons), [allWeapons]);
  const weapons = classFilter ? allWeapons.filter((w) => w.weapon_class === classFilter) : allWeapons;

  if (catalog.isPending || progress.isPending) return <Loading />;
  if (catalog.isError) return <ErrorMessage error={catalog.error} onRetry={() => catalog.refetch()} />;
  if (progress.isError) return <ErrorMessage error={progress.error} onRetry={() => progress.refetch()} />;

  const camos = catalog.data.camos;
  const completion = overallCompletion(
    weapons.map((w) => w.id),
    camos,
    index,
  );

  function setClass(value: string | null) {
    setSearchParams(value ? { classe: value } : {}, { replace: true });
  }

  return (
    <section className="space-y-4">
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
        <ProgressBar value={completion.fraction} label="Progresso total de camos" />

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por classe">
          <FilterChip active={!classFilter} onClick={() => setClass(null)}>
            Todas
          </FilterChip>
          {classes.map((c) => (
            <FilterChip key={c} active={classFilter === c} onClick={() => setClass(c)}>
              {weaponClassLabel(c)}
            </FilterChip>
          ))}
        </div>
      </header>

      {weapons.length === 0 ? (
        <p className="text-sm text-zinc-400">Não há armas nesta classe.</p>
      ) : (
        <div className="card -mx-4 overflow-x-auto sm:mx-0">
          <table className="w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-900 px-3 py-2 text-left font-medium text-zinc-400">
                  Arma
                </th>
                {camos.map((camo) => (
                  <CamoHeader key={camo.id} camo={camo} />
                ))}
              </tr>
            </thead>
            <tbody>
              {weapons.map((weapon) => {
                const summary = weaponSummary(weapon.id, camos, index);
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
                      const row = index.get(progressKey(weapon.id, camo.id));
                      return (
                        <td key={camo.id} className="border-t border-zinc-800 p-1 text-center">
                          <CamoCell
                            state={camoState(camo, row)}
                            label={`${weapon.name}, ${camo.name}`}
                            onClick={() => setEditing({ weapon, camo, progress: row })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Legend />
      <CamoEditor target={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
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

function CamoHeader({ camo }: { camo: CamoRow }) {
  return (
    <th scope="col" className="h-32 px-1 pb-2 align-bottom font-normal">
      <div className="mx-auto flex w-9 flex-col items-center justify-end gap-1">
        <span
          className="text-xs whitespace-nowrap text-zinc-300 [writing-mode:vertical-rl]"
          style={{ transform: 'rotate(180deg)' }}
        >
          {camo.name}
        </span>
        {!camo.verified && <UnverifiedBadge compact />}
      </div>
    </th>
  );
}

function CamoCell({ state, label, onClick }: { state: CamoState; label: string; onClick: () => void }) {
  let content: ReactNode;
  let classes: string;
  let status: string;

  if (state.unlocked) {
    content = '✓';
    classes = 'bg-emerald-600 text-white hover:bg-emerald-500';
    status = 'desbloqueado';
  } else if (state.count > 0) {
    content = <span className="text-[10px] leading-none tabular-nums">{compactCount(state.count)}</span>;
    classes = 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700';
    status = state.target !== null ? `${state.count} de ${state.target}` : `${state.count}, objetivo por confirmar`;
  } else {
    content = null;
    classes = 'bg-zinc-800/60 hover:bg-zinc-700';
    status = 'bloqueado';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${status}`}
      title={`${label}: ${status}`}
      className={`relative flex size-9 items-center justify-center overflow-hidden rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${classes}`}
    >
      {content}
      {!state.unlocked && state.fraction !== null && state.fraction > 0 && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-1 bg-emerald-500"
          style={{ width: `${state.fraction * 100}%` }}
        />
      )}
    </button>
  );
}

function compactCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}k`;
  return String(n);
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
      <li className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm bg-emerald-600" /> desbloqueado
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm bg-zinc-800" /> bloqueado (número = contador)
      </li>
      <li className="flex items-center gap-1.5">
        <UnverifiedBadge compact /> requisito por confirmar
      </li>
    </ul>
  );
}
