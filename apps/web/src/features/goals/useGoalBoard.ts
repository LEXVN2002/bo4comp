import { useMemo } from 'react';
import { useCamoData } from '../camos/useCamoData';
import {
  earliestNeeded,
  goalProgress,
  goalProgressIn,
  previousWindow,
  type GoalContext,
  type GoalProgress,
} from './goalProgress';
import { useGoals, useSessionsSince, type GoalRow } from './queries';

export interface GoalItem {
  goal: GoalRow;
  progress: GoalProgress;
  /** Resultado do período anterior (só diários e semanais). */
  previous: GoalProgress | null;
}

/** Objetivos com o progresso calculado: ativos e histórico (concluídos sem prazo + arquivados). */
export function useGoalBoard() {
  const goals = useGoals();
  const camoData = useCamoData();
  // Hora de referência fixa por montagem: os períodos não mudam a meio de um render.
  const now = useMemo(() => new Date(), []);
  const since = goals.data ? earliestNeeded(goals.data, now) : null;
  const sessions = useSessionsSince(since);

  const board = useMemo(() => {
    if (!goals.data || !camoData.data || !sessions.data) return undefined;
    const ctx: GoalContext = {
      weapons: camoData.data.weapons,
      progress: [...camoData.data.index.values()],
      sessions: sessions.data,
    };
    const items: GoalItem[] = goals.data.map((goal) => {
      const prev = previousWindow(goal, now);
      return {
        goal,
        progress: goalProgress(goal, ctx, now),
        previous: prev ? goalProgressIn(goal, ctx, prev) : null,
      };
    });
    const isHistory = (i: GoalItem) => i.goal.archived_at !== null || (i.goal.period === 'none' && i.progress.done);
    return {
      active: items.filter((i) => !isHistory(i)),
      history: items.filter(isHistory).reverse(),
      data: camoData.data,
    };
  }, [goals.data, camoData.data, sessions.data, now]);

  const failed = [goals, sessions].find((q) => q.isError);
  return {
    board,
    isPending: goals.isPending || camoData.isPending || (since !== null && sessions.isPending),
    error: failed?.error ?? camoData.error ?? null,
    retry: () => {
      if (goals.isError) void goals.refetch();
      if (sessions.isError) void sessions.refetch();
      camoData.retry();
    },
  };
}
