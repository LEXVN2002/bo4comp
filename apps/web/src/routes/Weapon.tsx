import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorMessage, Loading } from '../components/QueryState';
import { UnverifiedBadge } from '../components/UnverifiedBadge';
import { useCatalog, type CamoRow } from '../features/catalog/queries';
import { CamoEditor, type CamoEditorTarget } from '../features/camos/CamoEditor';
import { useCamoProgress } from '../features/camos/queries';
import { weaponClassLabel } from '../lib/labels';
import { camoState, formatPercent, indexProgress, progressKey, weaponSummary, type CamoState } from '../lib/progress';

export default function Weapon() {
  const { weaponId = '' } = useParams();
  const catalog = useCatalog();
  const progress = useCamoProgress();
  const [editing, setEditing] = useState<CamoEditorTarget | null>(null);
  const index = useMemo(() => indexProgress(progress.data ?? []), [progress.data]);

  if (catalog.isPending || progress.isPending) return <Loading />;
  if (catalog.isError) return <ErrorMessage error={catalog.error} onRetry={() => catalog.refetch()} />;
  if (progress.isError) return <ErrorMessage error={progress.error} onRetry={() => progress.refetch()} />;

  const weapon = catalog.data.weaponsById.get(weaponId);
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

  const camos = catalog.data.camos;
  const summary = weaponSummary(weapon.id, camos, index);
  const next = summary.next;

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <Link to={`/camos?classe=${weapon.weapon_class}`} className="text-sm text-zinc-400 hover:text-emerald-400">
          ← {weaponClassLabel(weapon.weapon_class)}
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{weapon.name}</h1>
          <p className="text-sm text-zinc-400">
            {summary.unlocked} de {summary.total} camos ·{' '}
            <span className="text-zinc-200">
              {formatPercent(summary.total ? summary.unlocked / summary.total : 0)}
            </span>
          </p>
        </div>
        <ProgressBar
          value={summary.total ? summary.unlocked / summary.total : 0}
          label={`Camos desbloqueados da ${weapon.name}`}
        />
      </header>

      <div className="card p-4">
        <h2 className="text-sm font-medium text-zinc-400">Próximo desbloqueio</h2>
        {next ? (
          <div className="mt-2 space-y-2">
            <p className="flex items-center gap-2 text-lg font-semibold">
              {next.camo.name}
              {!next.camo.verified && <UnverifiedBadge />}
            </p>
            <p className="text-sm text-zinc-400">{next.camo.requirement_text}</p>
            <NextProgress state={next.state} name={next.camo.name} />
          </div>
        ) : (
          <p className="mt-2 text-emerald-400">Todos os camos desta arma estão desbloqueados.</p>
        )}
      </div>

      <ol className="card divide-y divide-zinc-800">
        {camos.map((camo) => {
          const row = index.get(progressKey(weapon.id, camo.id));
          return (
            <CamoItem
              key={camo.id}
              camo={camo}
              state={camoState(camo, row)}
              isNext={next?.camo.id === camo.id}
              onEdit={() => setEditing({ weapon, camo, progress: row })}
            />
          );
        })}
      </ol>

      <CamoEditor target={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function NextProgress({ state, name }: { state: CamoState; name: string }) {
  if (state.target !== null && state.fraction !== null) {
    return (
      <div className="space-y-1">
        <ProgressBar value={state.fraction} label={`Progresso de ${name}`} />
        <p className="text-sm tabular-nums text-zinc-300">
          {state.count} / {state.target} · faltam {Math.max(state.target - state.count, 0)}
        </p>
      </div>
    );
  }
  if (state.counted) {
    return (
      <p className="text-sm text-zinc-300">
        Contador: <span className="tabular-nums">{state.count}</span> (objetivo por confirmar)
      </p>
    );
  }
  return null;
}

function CamoItem({
  camo,
  state,
  isNext,
  onEdit,
}: {
  camo: CamoRow;
  state: CamoState;
  isNext: boolean;
  onEdit: () => void;
}) {
  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${isNext ? 'bg-emerald-950/20' : ''}`}>
      <span
        aria-hidden
        className={`flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold ${
          state.unlocked ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500'
        }`}
      >
        {state.unlocked ? '✓' : camo.tier}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{camo.name}</span>
          {!camo.verified && <UnverifiedBadge />}
          <span className="sr-only">{state.unlocked ? 'desbloqueado' : 'bloqueado'}</span>
        </p>
        {!state.unlocked && state.counted && (
          <p className="text-xs tabular-nums text-zinc-400">
            {state.target !== null ? `${state.count} / ${state.target}` : `${state.count} · objetivo por confirmar`}
          </p>
        )}
        {!state.unlocked && state.fraction !== null && (
          <ProgressBar value={state.fraction} label={`Progresso de ${camo.name}`} className="h-1.5" />
        )}
      </div>
      <button type="button" onClick={onEdit} className="btn-secondary px-3 py-1.5">
        Editar
      </button>
    </li>
  );
}
