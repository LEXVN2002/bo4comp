import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorMessage, Loading } from '../components/QueryState';
import { ClassSeals } from '../features/camos/ClassSeals';
import { ClosestToUnlock } from '../features/camos/ClosestToUnlock';
import { PinnedWeapons } from '../features/camos/PinnedWeapons';
import { useCamoProgress } from '../features/camos/queries';
import { useCamoData } from '../features/camos/useCamoData';
import { globalCardInput, ShareButton } from '../features/share/ShareCard';
import { useCatalog } from '../features/catalog/queries';
import { useBestRounds, useRecentSessions } from '../features/dashboard/queries';
import { useCompletions, useEasterEggs } from '../features/easter-eggs/queries';
import { formatDateTime, formatPlayers } from '../lib/format';
import { SESSION_MODE_LABELS } from '../lib/labels';
import { formatPercent, indexProgress, overallCompletion } from '../lib/progress';
import type { SessionMode } from '@bo4/shared';

export default function Dashboard() {
  const catalog = useCatalog();
  const progress = useCamoProgress();
  const eggs = useEasterEggs();
  const completions = useCompletions();
  const bestRounds = useBestRounds();
  const recent = useRecentSessions(5);
  const camoData = useCamoData();

  const index = useMemo(() => indexProgress(progress.data ?? []), [progress.data]);

  const queries = [catalog, progress, eggs, completions, bestRounds, recent];
  if (queries.some((q) => q.isPending)) return <Loading />;
  const failed = queries.find((q) => q.isError);
  if (failed) return <ErrorMessage error={failed.error} onRetry={() => failed.refetch()} />;
  if (camoData.isPending) return <Loading />;
  if (camoData.error || !camoData.data) return <ErrorMessage error={camoData.error} onRetry={camoData.retry} />;

  const maps = catalog.data?.maps ?? [];
  const weapons = catalog.data?.weapons ?? [];
  const camos = catalog.data?.camos ?? [];
  const camoCompletion = overallCompletion(
    weapons.map((w) => w.id),
    camos,
    index,
  );

  const completedEggs = new Set((completions.data ?? []).map((c) => c.easter_egg_id));
  const mainEggs = (eggs.data ?? []).filter((e) => e.type === 'main');
  const mainDone = mainEggs.filter((e) => completedEggs.has(e.id)).length;

  const bestByMap = new Map((bestRounds.data ?? []).map((b) => [b.map_id, b]));
  const mapName = (id: string) => maps.find((m) => m.id === id)?.name ?? id;
  const sessions = recent.data ?? [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <ShareButton build={(name) => globalCardInput(camoData.data!, name)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          title="Camos desbloqueados"
          value={formatPercent(camoCompletion.fraction)}
          detail={`${camoCompletion.unlocked} de ${camoCompletion.total}`}
          to="/camos"
        >
          <ProgressBar value={camoCompletion.fraction} label="Progresso total de camos" />
        </StatCard>
        <StatCard
          title="Easter eggs principais"
          value={`${mainDone}/${mainEggs.length}`}
          detail={mainDone === mainEggs.length && mainEggs.length > 0 ? 'Todos concluídos' : 'concluídos'}
          to="/easter-eggs"
        >
          <ProgressBar value={mainEggs.length ? mainDone / mainEggs.length : 0} label="Easter eggs principais concluídos" />
        </StatCard>
      </div>

      <section aria-labelledby="seals" className="space-y-2">
        <h2 id="seals" className="text-sm font-medium text-zinc-400">
          Selos de classe
        </h2>
        <ClassSeals data={camoData.data} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="closest" className="space-y-2">
          <h2 id="closest" className="text-sm font-medium text-zinc-400">
            Mais perto de desbloquear
          </h2>
          <ClosestToUnlock data={camoData.data} />
        </section>

        {camoData.data.pinned.length > 0 && (
          <section aria-labelledby="pinned" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 id="pinned" className="text-sm font-medium text-zinc-400">
                Armas afixadas
              </h2>
              <Link to="/camos" className="text-xs text-zinc-400 hover:text-emerald-400">
                Ver camos
              </Link>
            </div>
            <PinnedWeapons data={camoData.data} compact />
          </section>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="best-rounds" className="space-y-2">
          <h2 id="best-rounds" className="text-sm font-medium text-zinc-400">
            Melhor ronda por mapa
          </h2>
          <ul className="card divide-y divide-zinc-800">
            {maps.map((map) => {
              const best = bestByMap.get(map.id);
              return (
                <li key={map.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate">{map.name}</span>
                  {best ? (
                    <>
                      <span className="text-xs text-zinc-500">
                        {best.session_count === 1 ? '1 sessão' : `${best.session_count} sessões`}
                      </span>
                      <span className="w-12 text-right text-lg font-semibold tabular-nums">{best.best_round}</span>
                    </>
                  ) : (
                    <span className="w-12 text-right text-zinc-600" aria-label="sem sessões">
                      —
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="recent-sessions" className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-sessions" className="text-sm font-medium text-zinc-400">
              Últimas sessões
            </h2>
            {sessions.length > 0 && (
              <Link to="/sessions" className="text-xs text-zinc-400 hover:text-emerald-400">
                Ver histórico
              </Link>
            )}
          </div>
          {sessions.length > 0 ? (
            <ul className="card divide-y divide-zinc-800">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{mapName(s.map_id)}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDateTime(s.played_at)} · {SESSION_MODE_LABELS[s.mode as SessionMode] ?? s.mode} ·{' '}
                      {formatPlayers(s.players)}
                    </p>
                  </div>
                  <span className="text-right">
                    <span className="block text-lg leading-none font-semibold tabular-nums">{s.round_reached}</span>
                    <span className="text-[10px] tracking-wide text-zinc-500 uppercase">ronda</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card p-4 text-sm text-zinc-400">
              Ainda não registaste nenhuma sessão.{' '}
              <Link to="/sessions/new" className="text-emerald-400 hover:underline">
                Registar a primeira
              </Link>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function StatCard({
  title,
  value,
  detail,
  to,
  children,
}: {
  title: string;
  value: string;
  detail: string;
  to: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className="card block space-y-3 p-4 transition-colors hover:border-zinc-700">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        <span className="text-sm text-zinc-500">{detail}</span>
      </p>
      {children}
    </Link>
  );
}
