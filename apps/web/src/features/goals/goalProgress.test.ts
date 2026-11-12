import { describe, expect, it } from 'vitest';
import {
  currentWindow,
  earliestNeeded,
  goalProgress,
  goalProgressIn,
  previousWindow,
  startOfWeek,
  type GoalContext,
  type GoalLike,
} from './goalProgress';

// Quinta-feira, 12 de novembro de 2026, 15:30 (hora local).
const now = new Date(2026, 10, 12, 15, 30);

const goal = (g: Partial<GoalLike>): GoalLike => ({
  type: 'kills',
  target: 100,
  weapon_id: null,
  weapon_class: null,
  camo_id: null,
  period: 'none',
  created_at: new Date(2026, 10, 1).toISOString(),
  ...g,
});

const iso = (...args: [number, number, number, number?]) => new Date(...(args as [number, number, number, number])).toISOString();

const ctx: GoalContext = {
  weapons: [
    { id: 'saug', weapon_class: 'smg' },
    { id: 'kn57', weapon_class: 'ar' },
  ],
  progress: [
    { weapon_id: 'saug', camo_id: 'a', unlocked_at: iso(2026, 10, 12, 10) }, // hoje
    { weapon_id: 'saug', camo_id: 'b', unlocked_at: iso(2026, 10, 10, 10) }, // terça desta semana
    { weapon_id: 'kn57', camo_id: 'a', unlocked_at: iso(2026, 10, 5, 10) }, // semana passada
    { weapon_id: 'kn57', camo_id: 'b', unlocked_at: null },
  ],
  sessions: [
    { played_at: iso(2026, 10, 12, 9), stats: [{ weapon_id: 'saug', kills: 40, headshots: 10 }] },
    { played_at: iso(2026, 10, 11, 20), stats: [{ weapon_id: 'kn57', kills: 30, headshots: 5 }] },
    { played_at: iso(2026, 10, 3, 20), stats: [{ weapon_id: 'saug', kills: 500, headshots: 100 }] },
  ],
};

describe('períodos', () => {
  it('a semana começa à segunda às 00:00 (hora local)', () => {
    expect(startOfWeek(now)).toEqual(new Date(2026, 10, 9));
    expect(startOfWeek(new Date(2026, 10, 15, 23))).toEqual(new Date(2026, 10, 9)); // domingo
    expect(startOfWeek(new Date(2026, 10, 9, 0, 5))).toEqual(new Date(2026, 10, 9)); // segunda
  });

  it('janela atual: diário, semanal e sem prazo (desde a criação)', () => {
    expect(currentWindow({ period: 'daily', created_at: '' }, now).start).toEqual(new Date(2026, 10, 12));
    expect(currentWindow({ period: 'weekly', created_at: '' }, now).start).toEqual(new Date(2026, 10, 9));
    const created = new Date(2026, 9, 1).toISOString();
    expect(currentWindow({ period: 'none', created_at: created }, now).start).toEqual(new Date(created));
  });

  it('período anterior', () => {
    expect(previousWindow({ period: 'daily' }, now)).toEqual({
      start: new Date(2026, 10, 11),
      end: new Date(2026, 10, 12),
    });
    expect(previousWindow({ period: 'weekly' }, now)).toEqual({
      start: new Date(2026, 10, 2),
      end: new Date(2026, 10, 9),
    });
    expect(previousWindow({ period: 'none' }, now)).toBeNull();
  });
});

describe('goalProgress', () => {
  it('camo_count conta desbloqueios no período, por arma ou classe', () => {
    expect(goalProgress(goal({ type: 'camo_count', target: 3, period: 'daily' }), ctx, now)).toMatchObject({ current: 1 });
    expect(goalProgress(goal({ type: 'camo_count', target: 3, period: 'weekly' }), ctx, now)).toMatchObject({ current: 2 });
    expect(goalProgress(goal({ type: 'camo_count', target: 2, period: 'none' }), ctx, now)).toMatchObject({
      current: 3,
      done: true,
      fraction: 1,
    });
    expect(goalProgress(goal({ type: 'camo_count', target: 5, weapon_class: 'ar' }), ctx, now)).toMatchObject({ current: 1 });
    expect(goalProgress(goal({ type: 'camo_count', target: 5, weapon_id: 'saug' }), ctx, now)).toMatchObject({ current: 2 });
  });

  it('sem prazo conta desde a criação (os camos antigos não contam)', () => {
    const recent = goal({ type: 'camo_count', target: 5, created_at: iso(2026, 10, 11) });
    expect(goalProgress(recent, ctx, now).current).toBe(1);
  });

  it('weapon_camo: cumprido se o camo estiver concluído, seja quando for', () => {
    expect(goalProgress(goal({ type: 'weapon_camo', weapon_id: 'kn57', camo_id: 'a', target: 1 }), ctx, now)).toEqual({
      current: 1,
      target: 1,
      fraction: 1,
      done: true,
    });
    expect(goalProgress(goal({ type: 'weapon_camo', weapon_id: 'kn57', camo_id: 'b', target: 1 }), ctx, now).done).toBe(false);
  });

  it('kills e headshots somam as sessões do período, por arma ou no total', () => {
    expect(goalProgress(goal({ type: 'kills', period: 'weekly' }), ctx, now).current).toBe(70);
    expect(goalProgress(goal({ type: 'kills', period: 'daily', weapon_id: 'saug' }), ctx, now).current).toBe(40);
    expect(goalProgress(goal({ type: 'headshots', period: 'none' }), ctx, now).current).toBe(115);
    expect(goalProgress(goal({ type: 'kills', period: 'none', target: 500 }), ctx, now)).toMatchObject({
      current: 570,
      done: true,
    });
  });

  it('período anterior de um objetivo semanal', () => {
    const g = goal({ type: 'kills', period: 'weekly', target: 400 });
    expect(goalProgressIn(g, ctx, previousWindow(g, now)!)).toMatchObject({ current: 500, done: true });
  });

  it('earliestNeeded: semana anterior ou a criação mais antiga de um objetivo sem prazo', () => {
    expect(earliestNeeded([], now)).toEqual(new Date(2026, 10, 2));
    expect(earliestNeeded([goal({ created_at: iso(2026, 9, 1) })], now)).toEqual(new Date(2026, 9, 1));
  });
});
