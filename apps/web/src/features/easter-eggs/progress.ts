export interface StepLike {
  id: string;
  step_order: number;
}

export interface CompletionLike {
  easter_egg_id: string;
  completed_at: string;
}

/** Passos feitos / total de um easter egg (total 0 quando ainda não há passos). */
export function stepProgress(steps: readonly StepLike[], done: ReadonlySet<string>) {
  const total = steps.length;
  const completed = steps.filter((s) => done.has(s.id)).length;
  return { done: completed, total, fraction: total === 0 ? 0 : completed / total };
}

/** Número de conclusões e a mais recente, por easter egg. */
export function summarizeCompletions<C extends CompletionLike>(completions: readonly C[]) {
  const byEgg = new Map<string, { count: number; last: C }>();
  for (const c of completions) {
    const current = byEgg.get(c.easter_egg_id);
    if (!current) byEgg.set(c.easter_egg_id, { count: 1, last: c });
    else {
      current.count += 1;
      if (c.completed_at > current.last.completed_at) current.last = c;
    }
  }
  return byEgg;
}

export function sortSteps<S extends StepLike>(steps: readonly S[]): S[] {
  return [...steps].sort((a, b) => a.step_order - b.step_order);
}

export function playersRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    if (min === max) return min === 1 ? 'Solo' : `${min} jogadores`;
    return `${min}–${max} jogadores`;
  }
  if (min !== null) return `${min}+ jogadores`;
  return `até ${max} jogadores`;
}
