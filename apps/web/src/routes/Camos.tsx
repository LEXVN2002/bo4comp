import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorMessage, Loading } from '../components/QueryState';
import { CompleteSeal, PinButton } from '../features/camos/CamoBits';
import {
  filterWeapons,
  filtersToParams,
  parseFilters,
  SORT_LABELS,
  SORT_OPTIONS,
  type WeaponListFilters,
  type WeaponListItem,
  type WeaponSort,
} from '../features/camos/listFilters';
import { useCamoData } from '../features/camos/useCamoData';
import { useTogglePin } from '../features/camos/userData';
import { weaponClassesOf } from '../features/camos/weapons';
import type { CamoRow, WeaponRow } from '../features/catalog/queries';
import { weaponClassLabel } from '../lib/labels';
import { formatPercent, overallCompletion } from '../lib/progress';

type Item = WeaponListItem<WeaponRow, CamoRow>;

export default function Camos() {
  const { data, isPending, error, retry } = useCamoData();
  const [searchParams, setSearchParams] = useSearchParams();
  const togglePin = useTogglePin();

  const classes = useMemo(() => weaponClassesOf(data?.weapons ?? []), [data]);
  const filters = useMemo(() => parseFilters(searchParams, classes), [searchParams, classes]);
  const items = useMemo(
    () => (data ? filterWeapons(data.weapons, data.camos, data.index, filters) : []),
    [data, filters],
  );

  if (isPending) return <Loading />;
  if (error || !data) return <ErrorMessage error={error} onRetry={retry} />;

  const completion = overallCompletion(
    data.weapons.map((w) => w.id),
    data.camos,
    data.index,
  );
  const pinned = new Set(data.pinned);

  function update(patch: Partial<WeaponListFilters>) {
    setSearchParams(filtersToParams({ ...filters, ...patch }), { replace: true });
  }

  // Agrupado por classe só na ordenação por nome; nas outras, a ordem é o que interessa.
  const groups: { weaponClass: string | null; items: Item[] }[] =
    filters.sort === 'nome'
      ? groupByClass(items)
      : [{ weaponClass: null, items }];

  return (
    <section className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Camos</h1>
          <p className="text-sm text-zinc-400">
            {completion.unlocked} de {completion.total} desbloqueados ·{' '}
            <span className="text-zinc-200">{formatPercent(completion.fraction)}</span>
          </p>
        </div>
        <ProgressBar value={completion.fraction} label="Progresso total de camos" />
        <div className="flex justify-end">
          <Link to="/camos/grelha" className="btn-secondary px-3 py-1.5">
            Grelha mestra
          </Link>
        </div>
      </header>

      <div className="space-y-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por classe">
          <FilterChip active={!filters.weaponClass} onClick={() => update({ weaponClass: null })}>
            Todas
          </FilterChip>
          {classes.map((c) => (
            <FilterChip key={c} active={filters.weaponClass === c} onClick={() => update({ weaponClass: c })}>
              {weaponClassLabel(c)}
            </FilterChip>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <label className="block">
            <span className="sr-only">Pesquisar arma</span>
            <input
              type="search"
              value={filters.query}
              onChange={(e) => update({ query: e.target.value })}
              placeholder="Pesquisar arma…"
              className="input"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            Ordenar por
            <select
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as WeaponSort })}
              className="input w-auto py-1.5"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={filters.onlyIncomplete}
              onChange={(e) => update({ onlyIncomplete: e.target.checked })}
              className="size-4 accent-emerald-500"
            />
            Só incompletas
          </label>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-400">Nenhuma arma corresponde aos filtros.</p>
      ) : (
        groups.map((group) => (
          <section key={group.weaponClass ?? 'todas'} className="space-y-2">
            {group.weaponClass && (
              <h2 className="text-sm font-medium tracking-wide text-zinc-400 uppercase">
                {weaponClassLabel(group.weaponClass)}
              </h2>
            )}
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <WeaponCard
                  key={item.weapon.id}
                  item={item}
                  pinned={pinned.has(item.weapon.id)}
                  showClass={filters.sort !== 'nome'}
                  sort={filters.sort}
                  onTogglePin={() =>
                    togglePin.mutate({ weaponId: item.weapon.id, pinned: !pinned.has(item.weapon.id) })
                  }
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

function groupByClass(items: Item[]): { weaponClass: string; items: Item[] }[] {
  const groups: { weaponClass: string; items: Item[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.weaponClass === item.weapon.weapon_class) last.items.push(item);
    else groups.push({ weaponClass: item.weapon.weapon_class, items: [item] });
  }
  return groups;
}

function WeaponCard({
  item,
  pinned,
  showClass,
  sort,
  onTogglePin,
}: {
  item: Item;
  pinned: boolean;
  showClass: boolean;
  sort: WeaponSort;
  onTogglePin: () => void;
}) {
  const { weapon, closest } = item;
  return (
    <li className="card relative flex flex-col gap-2 p-3 transition-colors hover:border-zinc-600">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* O link cobre o cartão todo; o alfinete fica por cima (z-10). */}
          <Link
            to={`/camos/${weapon.id}`}
            className="font-medium after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:text-emerald-400 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-emerald-400"
          >
            {weapon.name}
          </Link>
          {showClass && <p className="text-xs text-zinc-500">{weaponClassLabel(weapon.weapon_class)}</p>}
        </div>
        <div className="relative z-10 -mt-1 -mr-1 flex items-center gap-1">
          {item.complete && <CompleteSeal label="Completa" />}
          <PinButton pinned={pinned} weaponName={weapon.name} onToggle={onTogglePin} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ProgressBar value={item.fraction} label={`Camos da ${weapon.name}`} className="flex-1" />
        <span className="text-xs text-zinc-400 tabular-nums">
          {item.unlocked}/{item.total}
        </span>
      </div>
      {!item.complete && (
        <p className="text-xs text-zinc-500">
          {closest
            ? `Próximo: ${closest.camo.name} · faltam ${closest.remaining} ${closest.camo.requirement_type === 'headshots' ? 'headshots' : 'kills'}`
            : sort === 'perto'
              ? 'Sem requisitos conhecidos'
              : null}
        </p>
      )}
    </li>
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
