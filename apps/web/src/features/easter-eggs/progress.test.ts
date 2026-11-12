import { describe, expect, it } from 'vitest';
import { groupSteps, playersRange, sortSteps, stepProgress, summarizeCompletions } from './progress';

describe('stepProgress', () => {
  const steps = [
    { id: 'a-1', step_order: 1 },
    { id: 'a-2', step_order: 2 },
    { id: 'a-3', step_order: 3 },
    { id: 'a-4', step_order: 4 },
  ];

  it('conta só os passos deste easter egg', () => {
    expect(stepProgress(steps, new Set(['a-1', 'a-3', 'b-1']))).toEqual({ done: 2, total: 4, fraction: 0.5 });
  });

  it('funciona com zero passos', () => {
    expect(stepProgress([], new Set(['a-1']))).toEqual({ done: 0, total: 0, fraction: 0 });
  });
});

describe('summarizeCompletions', () => {
  it('conta conclusões e guarda a mais recente', () => {
    const summary = summarizeCompletions([
      { easter_egg_id: 'ix-main', completed_at: '2026-11-01T10:00:00Z' },
      { easter_egg_id: 'ix-main', completed_at: '2026-11-10T10:00:00Z' },
      { easter_egg_id: 'ix-main', completed_at: '2026-11-05T10:00:00Z' },
      { easter_egg_id: 'ae-main', completed_at: '2026-11-02T10:00:00Z' },
    ]);
    expect(summary.get('ix-main')?.count).toBe(3);
    expect(summary.get('ix-main')?.last.completed_at).toBe('2026-11-10T10:00:00Z');
    expect(summary.get('ae-main')?.count).toBe(1);
    expect(summary.has('outro')).toBe(false);
  });
});

describe('sortSteps', () => {
  it('ordena por step_order', () => {
    expect(sortSteps([{ id: 'b', step_order: 2 }, { id: 'a', step_order: 1 }]).map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('playersRange', () => {
  it('descreve o intervalo de jogadores', () => {
    expect(playersRange(null, null)).toBeNull();
    expect(playersRange(1, 4)).toBe('1–4 jogadores');
    expect(playersRange(1, 1)).toBe('Solo');
    expect(playersRange(4, 4)).toBe('4 jogadores');
    expect(playersRange(2, null)).toBe('2+ jogadores');
    expect(playersRange(null, 2)).toBe('até 2 jogadores');
  });
});

describe('groupSteps', () => {
  const step = (n: number, section: string | null) => ({ id: `s${n}`, step_order: n, section });

  it('agrupa passos consecutivos da mesma secção, mantendo a ordem', () => {
    const groups = groupSteps([step(1, 'Pack-a-Punch'), step(2, 'Pack-a-Punch'), step(3, 'Escudo'), step(4, null)]);
    expect(groups.map((g) => [g.name, g.steps.map((s) => s.id)])).toEqual([
      ['Pack-a-Punch', ['s1', 's2']],
      ['Escudo', ['s3']],
      [null, ['s4']],
    ]);
  });

  it('não junta secções repetidas que não são consecutivas', () => {
    expect(groupSteps([step(1, 'A'), step(2, 'B'), step(3, 'A')])).toHaveLength(3);
    expect(groupSteps([])).toEqual([]);
  });
});
