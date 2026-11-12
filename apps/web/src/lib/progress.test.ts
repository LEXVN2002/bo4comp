import { describe, expect, it } from 'vitest';
import {
  camoDisplayState,
  camoState,
  classSeal,
  closestToUnlock,
  estimateMatches,
  indexOverrides,
  isMasteryLocked,
  nextMeasurableCamo,
  withOverride,
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

describe('withOverride', () => {
  const unknownCamo = { ...unknown, requirement_text: 'Por confirmar' };

  it('sem override devolve o camo do catálogo', () => {
    expect(withOverride(unknownCamo, undefined)).toBe(unknownCamo);
  });

  it('o override ganha ao catálogo, campo a campo', () => {
    const overrides = indexOverrides([
      { camo_id: 'u', requirement_type: 'headshots', requirement_text: null, requirement_value: 50 },
    ]);
    expect(withOverride(unknownCamo, overrides.get('u'))).toEqual({
      ...unknownCamo,
      requirement_type: 'headshots',
      requirement_value: 50,
    });
    expect(
      withOverride(kills10, { camo_id: 'k', requirement_type: null, requirement_text: null, requirement_value: 7 }),
    ).toEqual({ ...kills10, requirement_value: 7 });
  });
});

describe('isMasteryLocked e camoDisplayState', () => {
  const camos = [kills10, headsNull, gold];

  it('mastery fica bloqueado até todos os tiers inferiores estarem concluídos', () => {
    const partial = indexProgress([row('k', 10, true)]);
    expect(isMasteryLocked('w', gold, camos, partial)).toBe(true);
    expect(camoDisplayState('w', gold, camos, partial)).toBe('locked');

    const all = indexProgress([row('k', 10, true), row('h', 0, true)]);
    expect(isMasteryLocked('w', gold, camos, all)).toBe(false);
    expect(camoDisplayState('w', gold, camos, all)).toBe('in_progress');
  });

  it('camos que não são mastery nunca ficam bloqueados', () => {
    expect(isMasteryLocked('w', headsNull, camos, indexProgress([]))).toBe(false);
    expect(camoDisplayState('w', kills10, camos, indexProgress([row('k', 10, true)]))).toBe('done');
    expect(camoDisplayState('w', kills10, camos, indexProgress([]))).toBe('in_progress');
  });
});

describe('nextMeasurableCamo e closestToUnlock', () => {
  const heads20: CamoLike = { id: 'h2', tier: 5, requirement_type: 'headshots', requirement_value: 20 };
  const camos = [kills10, headsNull, unknown, gold, heads20];

  it('salta camos concluídos, por confirmar e bloqueados', () => {
    const index = indexProgress([row('k', 10, true), row('h2', 5, false)]);
    expect(nextMeasurableCamo('w', camos, index)).toEqual({
      weaponId: 'w',
      camo: heads20,
      count: 5,
      target: 20,
      remaining: 15,
      fraction: 0.25,
    });
  });

  it('devolve null quando nada se pode medir', () => {
    expect(nextMeasurableCamo('w', [headsNull, unknown], indexProgress([]))).toBeNull();
  });

  it('ordena por percentagem e, em empate, pelo menor em falta', () => {
    const k100: CamoLike = { id: 'k100', tier: 1, requirement_type: 'kills', requirement_value: 100 };
    const index = indexProgress([
      row('k', 5, false, 'a'), // 50%, faltam 5
      row('k', 9, false, 'b'), // 90%, faltam 1
      row('k', 2, false, 'c'), // 20%
      row('k100', 50, false, 'd'), // 50%, faltam 50
    ]);
    const ranked = closestToUnlock(['a', 'b', 'c', 'd', 'e'], [kills10], index);
    expect(ranked.map((c) => c.weaponId)).toEqual(['b', 'a', 'c']);

    const withD = closestToUnlock(['a', 'd'], [k100], indexProgress([row('k100', 50, false, 'a'), row('k100', 50, false, 'd')]));
    expect(withD.map((c) => c.weaponId)).toEqual(['a', 'd']);
    expect(closestToUnlock(['a', 'b'], [kills10], index, 1)).toHaveLength(1);
  });

  it('não inclui camos por confirmar', () => {
    expect(closestToUnlock(['w'], [headsNull, unknown], indexProgress([]))).toEqual([]);
  });
});

describe('estimateMatches', () => {
  const s = (kills: number, headshots: number) => ({ kills, headshots });

  it('com menos de 3 sessões: dados insuficientes', () => {
    expect(estimateMatches(100, 'kills', [s(10, 1), s(10, 1)])).toEqual({ kind: 'insufficient' });
  });

  it('usa a média das últimas 10 sessões e arredonda para cima', () => {
    expect(estimateMatches(25, 'kills', [s(10, 0), s(10, 0), s(10, 0)])).toEqual({
      kind: 'estimate',
      matches: 3,
      average: 10,
    });
    const recent = [...Array.from({ length: 10 }, () => s(0, 4)), ...Array.from({ length: 5 }, () => s(0, 100))];
    expect(estimateMatches(10, 'headshots', recent)).toEqual({ kind: 'estimate', matches: 3, average: 4 });
  });

  it('média zero: sem progresso; nada em falta: 0 partidas', () => {
    expect(estimateMatches(10, 'headshots', [s(5, 0), s(5, 0), s(5, 0)])).toEqual({ kind: 'no_progress' });
    expect(estimateMatches(0, 'kills', [s(5, 0), s(5, 0), s(5, 0)])).toEqual({
      kind: 'estimate',
      matches: 0,
      average: 5,
    });
  });
});

describe('classSeal', () => {
  const weapons = [
    { id: 'a', weapon_class: 'smg' },
    { id: 'b', weapon_class: 'smg' },
    { id: 'c', weapon_class: 'ar' },
  ];
  const camos = [kills10, gold];
  const at = (weapon_id: string, camo_id: string, unlocked_at: string): CamoProgressLike => ({
    weapon_id,
    camo_id,
    current_count: 0,
    unlocked_at,
  });

  it('completo quando todas as armas da classe têm todos os camos; data = desbloqueio mais recente', () => {
    const index = indexProgress([
      at('a', 'k', '2026-11-01T00:00:00Z'),
      at('a', 'g', '2026-11-03T00:00:00Z'),
      at('b', 'k', '2026-11-05T00:00:00Z'),
      at('b', 'g', '2026-11-02T00:00:00Z'),
    ]);
    expect(classSeal('smg', weapons, camos, index)).toEqual({
      weaponClass: 'smg',
      complete: true,
      unlocked: 4,
      total: 4,
      fraction: 1,
      earnedAt: '2026-11-05T00:00:00Z',
    });
  });

  it('incompleto mostra a percentagem e não tem data', () => {
    const seal = classSeal('smg', weapons, camos, indexProgress([at('a', 'k', '2026-11-01T00:00:00Z')]));
    expect(seal).toMatchObject({ complete: false, unlocked: 1, total: 4, fraction: 0.25, earnedAt: null });
    expect(classSeal('sniper', weapons, camos, indexProgress([]))).toMatchObject({ complete: false, total: 0 });
  });
});
