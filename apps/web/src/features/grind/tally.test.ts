import { describe, expect, it } from 'vitest';
import { indexProgress, type CamoLike } from '../../lib/progress';
import { EMPTY_TALLY, projectNextCamo, tallyReducer, tallyToStats, totalKills, type TallyAction } from './tally';

const run = (...actions: TallyAction[]) => actions.reduce(tallyReducer, EMPTY_TALLY);

describe('tallyReducer', () => {
  it('sem arma ativa, os toques não contam', () => {
    expect(run({ type: 'tap', kind: 'kill' })).toEqual(EMPTY_TALLY);
  });

  it('um headshot conta também como kill', () => {
    const s = run({ type: 'switch', weaponId: 'gks' }, { type: 'tap', kind: 'kill' }, { type: 'tap', kind: 'headshot' });
    expect(s.counts).toEqual({ gks: { kills: 2, headshots: 1 } });
  });

  it('trocar de arma a meio não perde contagens', () => {
    const s = run(
      { type: 'switch', weaponId: 'gks' },
      { type: 'tap', kind: 'kill' },
      { type: 'switch', weaponId: 'saug' },
      { type: 'tap', kind: 'headshot' },
      { type: 'switch', weaponId: 'gks' },
      { type: 'tap', kind: 'kill' },
    );
    expect(s.activeWeaponId).toBe('gks');
    expect(s.counts).toEqual({ gks: { kills: 2, headshots: 0 }, saug: { kills: 1, headshots: 1 } });
    expect(totalKills(s.counts)).toBe(3);
  });

  it('desfazer anula o último toque, mesmo de outra arma', () => {
    const s = run(
      { type: 'switch', weaponId: 'gks' },
      { type: 'tap', kind: 'headshot' },
      { type: 'switch', weaponId: 'saug' },
      { type: 'undo' },
    );
    expect(s.counts).toEqual({ gks: { kills: 0, headshots: 0 }, saug: { kills: 0, headshots: 0 } });
    expect(s.activeWeaponId).toBe('saug');
    expect(run({ type: 'undo' })).toEqual(EMPTY_TALLY);
  });

  it('carregar uma sessão retomada limpa o histórico', () => {
    const s = run({ type: 'switch', weaponId: 'x' }, { type: 'tap', kind: 'kill' }, {
      type: 'load',
      counts: { gks: { kills: 5, headshots: 2 } },
      activeWeaponId: 'gks',
    });
    expect(s).toEqual({ activeWeaponId: 'gks', counts: { gks: { kills: 5, headshots: 2 } }, history: [] });
  });

  it('tallyToStats ordena por arma', () => {
    expect(tallyToStats({ saug: { kills: 1, headshots: 0 }, gks: { kills: 2, headshots: 1 } })).toEqual([
      { weapon_id: 'gks', kills: 2, headshots: 1 },
      { weapon_id: 'saug', kills: 1, headshots: 0 },
    ]);
  });
});

describe('projectNextCamo', () => {
  const k10: CamoLike = { id: 'k', tier: 1, requirement_type: 'kills', requirement_value: 10 };
  const h5: CamoLike = { id: 'h', tier: 2, requirement_type: 'headshots', requirement_value: 5 };
  const unknown: CamoLike = { id: 'u', tier: 3, requirement_type: 'unknown', requirement_value: null };
  const gold: CamoLike = { id: 'g', tier: 4, requirement_type: 'prereq_all', requirement_value: null };
  const camos = [k10, h5, unknown, gold];
  const index = indexProgress([{ weapon_id: 'w', camo_id: 'k', current_count: 6, unlocked_at: null }]);

  it('barra projetada = gravado + esta partida, do tipo certo', () => {
    expect(projectNextCamo('w', camos, index, { kills: 2, headshots: 1 })).toEqual({
      kind: 'measurable',
      camo: k10,
      saved: 6,
      session: 2,
      projected: 8,
      target: 10,
      unlocksOnFinish: false,
      savedFraction: 0.6,
      projectedFraction: 0.8,
    });
  });

  it('marca "desbloqueado ao terminar" quando a projeção atinge o objetivo', () => {
    expect(projectNextCamo('w', camos, index, { kills: 4, headshots: 0 })).toMatchObject({
      unlocksOnFinish: true,
      projectedFraction: 1,
    });
  });

  it('usa headshots para camos de headshots; por confirmar e mastery', () => {
    const doneK = indexProgress([{ weapon_id: 'w', camo_id: 'k', current_count: 10, unlocked_at: 'x' }]);
    expect(projectNextCamo('w', camos, doneK, { kills: 9, headshots: 3 })).toMatchObject({
      camo: h5,
      session: 3,
      projected: 3,
    });
    const doneKH = indexProgress([
      { weapon_id: 'w', camo_id: 'k', current_count: 10, unlocked_at: 'x' },
      { weapon_id: 'w', camo_id: 'h', current_count: 5, unlocked_at: 'x' },
    ]);
    expect(projectNextCamo('w', camos, doneKH, { kills: 0, headshots: 0 })).toEqual({ kind: 'unknown', camo: unknown, saved: 0 });
    expect(projectNextCamo('w', [gold], indexProgress([]), { kills: 0, headshots: 0 })).toEqual({ kind: 'mastery', camo: gold });
    expect(projectNextCamo('w', [], indexProgress([]), { kills: 0, headshots: 0 })).toEqual({ kind: 'complete' });
  });
});
