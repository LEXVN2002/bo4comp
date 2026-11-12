import { useState } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { weaponClassLabel } from '../../lib/labels';
import type { CamoData } from '../camos/useCamoData';
import { GOAL_PERIOD_LABELS, GOAL_TYPE_LABELS, type GoalPeriod, type GoalType } from './goalProgress';
import { useArchiveGoal, useDeleteGoal } from './queries';
import type { GoalItem } from './useGoalBoard';

/** Texto curto do âmbito do objetivo (arma, classe, camo). */
export function goalScope(item: GoalItem, data: CamoData): string {
  const g = item.goal;
  const weapon = g.weapon_id ? (data.weaponsById.get(g.weapon_id)?.name ?? g.weapon_id) : null;
  const camo = g.camo_id ? (data.catalogCamos.find((c) => c.id === g.camo_id)?.name ?? g.camo_id) : null;
  if (g.type === 'weapon_camo') return `${weapon} · ${camo}`;
  if (weapon) return weapon;
  if (g.weapon_class) return weaponClassLabel(g.weapon_class);
  return 'Todas as armas';
}

export function GoalCard({
  item,
  data,
  compact = false,
}: {
  item: GoalItem;
  data: CamoData;
  compact?: boolean;
}) {
  const archive = useArchiveGoal();
  const remove = useDeleteGoal();
  const [confirming, setConfirming] = useState(false);
  const { goal, progress, previous } = item;
  const archived = goal.archived_at !== null;
  const periodLabel = GOAL_PERIOD_LABELS[goal.period as GoalPeriod] ?? goal.period;

  return (
    <li className="card space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-medium ${progress.done ? 'text-emerald-300' : ''}`}>
            {progress.done && '✓ '}
            {goal.title}
          </p>
          <p className="text-xs text-zinc-500">
            {GOAL_TYPE_LABELS[goal.type as GoalType] ?? goal.type} · {goalScope(item, data)} · {periodLabel}
          </p>
        </div>
        <span className="shrink-0 text-sm text-zinc-300 tabular-nums">
          {goal.type === 'weapon_camo' ? (progress.done ? 'Concluído' : 'Por fazer') : `${progress.current}/${progress.target}`}
        </span>
      </div>
      <ProgressBar value={progress.fraction} label={`Progresso de ${goal.title}`} />
      {previous && (
        <p className="text-xs text-zinc-500">
          {goal.period === 'daily' ? 'Ontem' : 'Semana passada'}:{' '}
          {previous.done ? (
            <span className="text-emerald-400">cumprido</span>
          ) : (
            `${previous.current}/${previous.target}`
          )}
        </p>
      )}
      {!compact && (
        <div className="flex flex-wrap justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => archive.mutate({ id: goal.id, archived: !archived })}
            disabled={archive.isPending}
            className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            {archived ? 'Repor' : 'Arquivar'}
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(goal.id)}
                disabled={remove.isPending}
                className="rounded px-2 py-1 text-red-400 hover:bg-zinc-800"
              >
                {remove.isPending ? 'A apagar…' : 'Confirmar apagar'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-red-300"
            >
              Apagar
            </button>
          )}
        </div>
      )}
    </li>
  );
}
