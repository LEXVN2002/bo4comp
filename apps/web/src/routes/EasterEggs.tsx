import { useMemo } from 'react';
import { ErrorMessage, Loading } from '../components/QueryState';
import { useCatalog } from '../features/catalog/queries';
import { EasterEggCard } from '../features/easter-eggs/EasterEggCard';
import { useCompletions, useEasterEggs, useStepProgress, type CompletionRow } from '../features/easter-eggs/queries';

const STORYLINE_LABELS: Record<string, string> = { chaos: 'Chaos', aether: 'Aether' };

export default function EasterEggs() {
  const catalog = useCatalog();
  const eggs = useEasterEggs();
  const steps = useStepProgress();
  const completions = useCompletions();

  const doneSteps = useMemo(() => new Set((steps.data ?? []).map((s) => s.step_id)), [steps.data]);
  const completionsByEgg = useMemo(() => {
    const map = new Map<string, CompletionRow[]>();
    for (const c of completions.data ?? []) {
      const list = map.get(c.easter_egg_id) ?? [];
      list.push(c);
      map.set(c.easter_egg_id, list);
    }
    return map;
  }, [completions.data]);

  const queries = [catalog, eggs, steps, completions];
  if (queries.some((q) => q.isPending)) return <Loading />;
  const failed = queries.find((q) => q.isError);
  if (failed) return <ErrorMessage error={failed.error} onRetry={() => failed.refetch()} />;

  const allEggs = eggs.data ?? [];
  const mainEggs = allEggs.filter((e) => e.type === 'main');
  const mainDone = mainEggs.filter((e) => completionsByEgg.has(e.id)).length;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Easter eggs</h1>
        <p className="text-sm text-zinc-400">
          Principais concluídos:{' '}
          <span className="text-zinc-200 tabular-nums">
            {mainDone}/{mainEggs.length}
          </span>
        </p>
      </header>

      {(catalog.data?.maps ?? []).map((map) => {
        const mapEggs = allEggs.filter((e) => e.map_id === map.id);
        return (
          <section key={map.id} aria-labelledby={`map-${map.id}`} className="space-y-3">
            <h2 id={`map-${map.id}`} className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">{map.name}</span>
              <span className="text-xs text-zinc-500">
                {STORYLINE_LABELS[map.storyline] ?? map.storyline}
                {map.is_dlc && ' · DLC'}
              </span>
            </h2>
            {mapEggs.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {mapEggs.map((egg) => (
                  <EasterEggCard
                    key={egg.id}
                    egg={egg}
                    doneSteps={doneSteps}
                    completions={completionsByEgg.get(egg.id) ?? []}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Ainda não há easter eggs registados para este mapa.</p>
            )}
          </section>
        );
      })}
    </section>
  );
}
