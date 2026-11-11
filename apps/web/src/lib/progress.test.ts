import { describe, expect, it } from 'vitest';
import {
  camoState,
  formatPercent,
  indexProgress,
  overallCompletion,
  progressKey,
  weaponSummary,
  type CamoLike,
  type CamoProgressLike,
} from './progress';

const kills10: CamoLike = { id: 'k', tier: 1, requirement_type: 'kills', requirement_value: 10 };
const headsNull: CamoLike = { id: 'h', tier: 2, requirement_type: 'headshots', requirement_value: null };
const unknown: CamoLike = { id: 'u', tier: 3, requirement_type: 'unknown', requirement_value: null };
const gold: CamoLike = { id: 'g', tier: 4, requirement_type: 'prereq_all', requirement_value: null };

function row(camo_id: string, current_count: number, unlocked: boolean, weapon_id = 'w'): CamoProgressLike {
  return { weapon_id, camo_id, current_count, unlocked_at: unlocked ? '2026-11-11T00:00:00Z' : null };
}

describe('camoState', () => {
  it('sem linha de progresso: bloqueado e a zero', () => {
    expect(camoState(kills10, undefined)).toEqual({
      unlocked: false,
      count: 0,
      target: 10,
      fraction: 0,
      counted: true,
    });
  });

  it('calcula a fração até ao requisito e limita a 1', () => {
    expect(camoState(kills10, row('k', 4, false)).fraction).toBe(0.4);
    expect(camoState(kills10, row('k', 25, false)).fraction).toBe(1);
  });

  it('desbloqueado tem fração 1 mesmo sem requisito conhecido', () => {
    expect(camoState(headsNull, row('h', 0, true))).toMatchObject({ unlocked: true, fraction: 1 });
  });

  it('requisito por confirmar: conta mas não tem alvo nem fração', () => {
    expect(camoState(headsNull, row('h', 7, false))).toMatchObject({
      count: 7,
      target: null,
      fraction: null,
      counted: true,
    });
  });

  it('camos unknown e prereq_all não são de contagem', () => {
    expect(camoState(unknown, undefined).counted).toBe(false);
    expect(camoState(gold, undefined)).toMatchObject({ counted: false, target: null, fraction: null });
  });
});

describe('weaponSummary', () => {
  const camos = [gold, unknown, kills10, headsNull]; // fora de ordem de propósito

  it('conta desbloqueados e escolhe o próximo pelo tier', () => {
    const index = indexProgress([row('k', 10, true), row('h', 3, false)]);
    const summary = weaponSummary('w', camos, index);
    expect(summary.unlocked).toBe(1);
    expect(summary.total).toBe(4);
    expect(summary.next?.camo.id).toBe('h');
    expect(summary.next?.state.count).toBe(3);
  });

  it('ignora progresso de outras armas', () => {
    const index = indexProgress([row('k', 10, true, 'outra')]);
    expect(weaponSummary('w', camos, index)).toMatchObject({ unlocked: 0 });
    expect(weaponSummary('w', camos, index).next?.camo.id).toBe('k');
  });

  it('sem próximo quando tudo está desbloqueado', () => {
    const index = indexProgress(camos.map((c) => row(c.id, 0, true)));
    expect(weaponSummary('w', camos, index)).toMatchObject({ unlocked: 4, next: null });
  });
});

describe('overallCompletion', () => {
  it('divide desbloqueados por armas × camos', () => {
    const index = indexProgress([
      row('k', 10, true, 'a'),
      row('h', 0, true, 'b'),
      row('u', 5, false, 'a'),
    ]);
    expect(overallCompletion(['a', 'b'], [kills10, headsNull], index)).toEqual({
      unlocked: 2,
      total: 4,
      fraction: 0.5,
    });
  });

  it('ignora linhas de armas ou camos fora do filtro', () => {
    const index = indexProgress([row('k', 10, true, 'a'), row('x', 0, true, 'a')]);
    expect(overallCompletion(['a'], [kills10], index).unlocked).toBe(1);
    expect(overallCompletion(['b'], [kills10], index).unlocked).toBe(0);
  });

  it('é 0 sem armas ou camos', () => {
    expect(overallCompletion([], [], new Map()).fraction).toBe(0);
  });
});

describe('utilitários', () => {
  it('progressKey e formatPercent', () => {
    expect(progressKey('saug-9mm', 'gold')).toBe('saug-9mm:gold');
    expect(formatPercent(0.999)).toBe('99%');
    expect(formatPercent(1)).toBe('100%');
  });
});
