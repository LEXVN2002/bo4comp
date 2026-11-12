import { describe, expect, it } from 'vitest';
import { indexProgress, type CamoLike, type CamoState } from '../../lib/progress';
import { allClassSeals, cellLevel, newlyCompletedSeals } from './seals';

const state = (s: Partial<CamoState>): CamoState => ({
  unlocked: false,
  count: 0,
  target: null,
  fraction: null,
  counted: true,
  ...s,
});

describe('cellLevel', () => {
  it('vazia, intensidades pela % e concluída', () => {
    expect(cellLevel(state({}))).toBe('empty');
    expect(cellLevel(state({ count: 1, target: 10, fraction: 0.1 }))).toBe('low');
    expect(cellLevel(state({ count: 5, target: 10, fraction: 0.5 }))).toBe('mid');
    expect(cellLevel(state({ count: 9, target: 10, fraction: 0.9 }))).toBe('high');
    expect(cellLevel(state({ unlocked: true, fraction: 1 }))).toBe('done');
  });

  it('requisito por confirmar com contador conta como progresso baixo', () => {
    expect(cellLevel(state({ count: 3 }))).toBe('low');
  });
});

describe('selos de classe', () => {
  const weapons = [
    { id: 'saug', weapon_class: 'smg' },
    { id: 'kn57', weapon_class: 'ar' },
  ];
  const camos: CamoLike[] = [{ id: 'k', tier: 1, requirement_type: 'kills', requirement_value: 10 }];
  const done = (weapon_id: string) => ({ weapon_id, camo_id: 'k', current_count: 10, unlocked_at: '2026-11-12T00:00:00Z' });

  it('um selo por classe, pela ordem da spec', () => {
    const seals = allClassSeals(weapons, camos, indexProgress([done('kn57')]));
    expect(seals.map((s) => [s.weaponClass, s.complete])).toEqual([
      ['smg', false],
      ['ar', true],
    ]);
  });

  it('deteta só as classes que acabaram de ficar completas', () => {
    const seals = allClassSeals(weapons, camos, indexProgress([done('kn57'), done('saug')]));
    expect(newlyCompletedSeals(new Set(['ar']), seals).map((s) => s.weaponClass)).toEqual(['smg']);
    expect(newlyCompletedSeals(new Set(['ar', 'smg']), seals)).toEqual([]);
  });
});
