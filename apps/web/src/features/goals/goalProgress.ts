// Objetivos (docs/CAMOS.md, secção 8). Lógica pura: períodos e progresso.

export const GOAL_TYPES = ['camo_count', 'weapon_camo', 'kills', 'headshots'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
export const GOAL_PERIODS = ['daily', 'weekly', 'none'] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  camo_count: 'Concluir camos',
  weapon_camo: 'Camo específico',
  kills: 'Kills',
  headshots: 'Headshots',
};

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  none: 'Sem prazo',
};

export interface GoalLike {
  type: string;
  target: number;
  weapon_id: string | null;
  weapon_class: string | null;
  camo_id: string | null;
  period: string;
  created_at: string;
}

export interface GoalContext {
  weapons: readonly { id: string; weapon_class: string }[];
  /** Linhas de weapon_camo_progress do utilizador. */
  progress: readonly { weapon_id: string; camo_id: string; unlocked_at: string | null }[];
  /** Sessões terminadas com as stats por arma. */
  sessions: readonly { played_at: string; stats: readonly { weapon_id: string; kills: number; headshots: number }[] }[];
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Segunda-feira às 00:00 (hora local) da semana de `d`. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const sinceMonday = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - sinceMonday);
}

/**
 * Janela atual do objetivo: desde a meia-noite (diário), desde segunda (semanal)
 * ou desde a criação do objetivo (sem prazo). Vai até `now`.
 */
export function currentWindow(goal: Pick<GoalLike, 'period' | 'created_at'>, now: Date): TimeWindow {
  if (goal.period === 'daily') return { start: startOfDay(now), end: now };
  if (goal.period === 'weekly') return { start: startOfWeek(now), end: now };
  return { start: new Date(goal.created_at), end: now };
}

/** Período anterior completo (só para objetivos diários e semanais). */
export function previousWindow(goal: Pick<GoalLike, 'period'>, now: Date): TimeWindow | null {
  if (goal.period === 'daily') {
    const start = startOfDay(now);
    return { start: new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1), end: start };
  }
  if (goal.period === 'weekly') {
    const start = startOfWeek(now);
    return { start: new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7), end: start };
  }
  return null;
}

function inWindow(iso: string, w: TimeWindow): boolean {
  const t = Date.parse(iso);
  return t >= w.start.getTime() && t < w.end.getTime() + 1;
}

export interface GoalProgress {
  current: number;
  target: number;
  fraction: number;
  done: boolean;
}

/** Progresso de um objetivo numa janela. */
export function goalProgressIn(goal: GoalLike, ctx: GoalContext, w: TimeWindow): GoalProgress {
  let current = 0;
  let target = goal.target;

  if (goal.type === 'weapon_camo') {
    // Um camo específico: cumprido se estiver concluído, seja quando for.
    target = 1;
    current = ctx.progress.some(
      (p) => p.weapon_id === goal.weapon_id && p.camo_id === goal.camo_id && p.unlocked_at != null,
    )
      ? 1
      : 0;
  } else if (goal.type === 'camo_count') {
    const classOf = new Map(ctx.weapons.map((w) => [w.id, w.weapon_class]));
    current = ctx.progress.filter(
      (p) =>
        p.unlocked_at != null &&
        inWindow(p.unlocked_at, w) &&
        (!goal.weapon_id || p.weapon_id === goal.weapon_id) &&
        (!goal.weapon_class || classOf.get(p.weapon_id) === goal.weapon_class),
    ).length;
  } else if (goal.type === 'kills' || goal.type === 'headshots') {
    const field = goal.type;
    for (const s of ctx.sessions) {
      if (!inWindow(s.played_at, w)) continue;
      for (const st of s.stats) {
        if (!goal.weapon_id || st.weapon_id === goal.weapon_id) current += st[field];
      }
    }
  }

  return { current, target, fraction: target > 0 ? Math.min(current / target, 1) : 0, done: current >= target };
}

export function goalProgress(goal: GoalLike, ctx: GoalContext, now: Date): GoalProgress {
  return goalProgressIn(goal, ctx, currentWindow(goal, now));
}

/** Data mais antiga de que os objetivos precisam (para pedir só as sessões necessárias). */
export function earliestNeeded(goals: readonly GoalLike[], now: Date): Date {
  let earliest = previousWindow({ period: 'weekly' }, now)!.start;
  for (const g of goals) {
    if (g.period === 'none') {
      const created = new Date(g.created_at);
      if (created < earliest) earliest = created;
    }
  }
  return earliest;
}
