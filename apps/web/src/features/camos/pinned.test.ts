import { describe, expect, it } from 'vitest';
import { indexProgress, type CamoLike, type CamoProgressLike } from '../../lib/progress';
import { moveItem, nextCamoInfo, requirementUnit } from './pinned';

describe('moveItem', () => {
  it('move para a frente e para trás', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('índices inválidos ou iguais devolvem uma cópia sem mudanças', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 1, 1)).toEqual(list);
    expect(moveItem(list, -1, 0)).toEqual(list);
    expect(moveItem(list, 0, 5)).toEqual(list);
    expect(moveItem(list, 0, 0)).not.toBe(list);
  });
});

describe('nextCamoInfo', () => {
  const k10: CamoLike = { id: 'k', tier: 1, requirement_type: 'kills', requirement_value: 10 };
  const unknown: CamoLike = { id: 'u', tier: 2, requirement_type: 'unknown', requirement_value: null };
  const gold: CamoLike = { id: 'g', tier: 3, requirement_type: 'prereq_all', requirement_value: null };
  const row = (camo_id: string, count: number, unlocked = false): CamoProgressLike => ({
    weapon_id: 'w',
    camo_id,
    current_count: count,
    unlocked_at: unlocked ? '2026-11-12T00:00:00Z' : null,
  });
  const camos = [gold, unknown, k10];

  it('primeiro camo por fazer, com quanto falta', () => {
    expect(nextCamoInfo('w', camos, indexProgress([row('k', 4)]))).toEqual({
      kind: 'measurable',
      camo: k10,
      count: 4,
      target: 10,
      remaining: 6,
      fraction: 0.4,
    });
  });

  it('requisito por confirmar, mastery pronto e arma completa', () => {
    expect(nextCamoInfo('w', camos, indexProgress([row('k', 10, true), row('u', 3)]))).toEqual({
      kind: 'unknown',
      camo: unknown,
      count: 3,
    });
    expect(nextCamoInfo('w', [k10, gold], indexProgress([]))).toMatchObject({ kind: 'measurable' });
    expect(nextCamoInfo('w', [gold, k10], indexProgress([row('k', 10, true)]))).toEqual({ kind: 'mastery', camo: gold });
    expect(
      nextCamoInfo('w', camos, indexProgress([row('k', 10, true), row('u', 0, true), row('g', 0, true)])),
    ).toEqual({ kind: 'complete' });
  });

  it('unidade do requisito', () => {
    expect(requirementUnit('headshots')).toBe('headshots');
    expect(requirementUnit('kills')).toBe('kills');
  });
});
