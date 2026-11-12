import { describe, expect, it } from 'vitest';
import { indexProgress, type CamoLike, type CamoProgressLike } from '../../lib/progress';
import { camoPattern, hashString, PATTERN_KINDS } from './camoPattern';
import { DEFAULT_FILTERS, filterWeapons, filtersToParams, parseFilters } from './listFilters';
import { isTypingTarget, moveIndex, shortcutFor } from './shortcuts';

const classes = ['smg', 'ar'];

describe('parseFilters / filtersToParams', () => {
  it('lê o URL e ignora valores inválidos', () => {
    expect(parseFilters(new URLSearchParams('classe=smg&ordem=perto&q=saug%20&incompletas=1'), classes)).toEqual({
      weaponClass: 'smg',
      sort: 'perto',
      // Mantém o espaço: o campo de pesquisa tem de deixar escrever "saug 9".
      query: 'saug ',
      onlyIncomplete: true,
    });
    expect(parseFilters(new URLSearchParams('classe=rpg&ordem=xpto&incompletas=sim'), classes)).toEqual(
      DEFAULT_FILTERS,
    );
  });

  it('escreve só o que difere do defeito e faz ida e volta', () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('');
    const filters = { weaponClass: 'ar', sort: 'progresso' as const, query: 'kn', onlyIncomplete: true };
    const params = filtersToParams(filters);
    expect(params.toString()).toBe('classe=ar&ordem=progresso&q=kn&incompletas=1');
    expect(parseFilters(params, classes)).toEqual(filters);
  });
});

describe('filterWeapons', () => {
  const weapons = [
    { id: 'saug', name: 'Saug 9mm', weapon_class: 'smg' },
    { id: 'mx9', name: 'MX9', weapon_class: 'smg' },
    { id: 'kn57', name: 'KN-57', weapon_class: 'ar' },
  ];
  const k10: CamoLike = { id: 'k', tier: 1, requirement_type: 'kills', requirement_value: 10 };
  const h4: CamoLike = { id: 'h', tier: 2, requirement_type: 'headshots', requirement_value: 4 };
  const row = (weapon_id: string, camo_id: string, count: number, unlocked = false): CamoProgressLike => ({
    weapon_id,
    camo_id,
    current_count: count,
    unlocked_at: unlocked ? '2026-11-12T00:00:00Z' : null,
  });
  // saug: tudo feito; mx9: k a 9/10; kn57: k feito, h a 1/4.
  const index = indexProgress([
    row('saug', 'k', 10, true),
    row('saug', 'h', 4, true),
    row('mx9', 'k', 9),
    row('kn57', 'k', 10, true),
    row('kn57', 'h', 1),
  ]);
  const ids = (filters: Partial<typeof DEFAULT_FILTERS>) =>
    filterWeapons(weapons, [k10, h4], index, { ...DEFAULT_FILTERS, ...filters }).map((i) => i.weapon.id);

  it('por defeito ordena por classe e nome', () => {
    expect(ids({})).toEqual(['mx9', 'saug', 'kn57']);
  });

  it('filtra por classe, pesquisa e só incompletas', () => {
    expect(ids({ weaponClass: 'ar' })).toEqual(['kn57']);
    expect(ids({ query: 'saug 9' })).toEqual(['saug']);
    expect(ids({ onlyIncomplete: true })).toEqual(['mx9', 'kn57']);
  });

  it('ordena por % de progresso e por mais perto de desbloquear', () => {
    expect(ids({ sort: 'progresso' })).toEqual(['saug', 'kn57', 'mx9']);
    // mx9 está a 90% do próximo; kn57 a 25%; saug não tem nada por desbloquear (fim).
    expect(ids({ sort: 'perto' })).toEqual(['mx9', 'kn57', 'saug']);
  });

  it('marca armas completas', () => {
    const items = filterWeapons(weapons, [k10, h4], index, DEFAULT_FILTERS);
    expect(items.find((i) => i.weapon.id === 'saug')).toMatchObject({ complete: true, unlocked: 2, total: 2 });
  });
});

describe('camoPattern', () => {
  it('é determinístico', () => {
    expect(hashString('gold')).toBe(hashString('gold'));
    expect(camoPattern('dark-matter')).toEqual(camoPattern('dark-matter'));
  });

  it('dá padrões variados ao catálogo e usa só gradientes CSS', () => {
    const ids = ['overgrowth', 'tundra', 'rend', 'tropic', 'roil', 'mangrove', 'clash', 'dune', 'gold', 'diamond'];
    const patterns = ids.map(camoPattern);
    expect(new Set(patterns.map((p) => p.kind)).size).toBeGreaterThan(2);
    expect(new Set(patterns.map((p) => p.hueA)).size).toBeGreaterThan(5);
    for (const p of patterns) {
      expect(PATTERN_KINDS).toContain(p.kind);
      expect(String(p.style.backgroundImage)).toMatch(/gradient\(/);
      expect(String(p.style.backgroundImage)).not.toMatch(/url\(/);
    }
  });
});

describe('shortcutFor', () => {
  it('mapeia as teclas da spec', () => {
    expect(shortcutFor({ key: 'ArrowRight' })).toEqual({ type: 'move', dx: 1, dy: 0 });
    expect(shortcutFor({ key: 'ArrowUp' })).toEqual({ type: 'move', dx: 0, dy: -1 });
    expect(shortcutFor({ key: 'Enter' })).toEqual({ type: 'toggle-panel' });
    expect(shortcutFor({ key: '+' })).toEqual({ type: 'count', delta: 1 });
    expect(shortcutFor({ key: '-' })).toEqual({ type: 'count', delta: -1 });
    expect(shortcutFor({ key: 'c' })).toEqual({ type: 'toggle-done' });
    expect(shortcutFor({ key: 'P' })).toEqual({ type: 'toggle-pin' });
    expect(shortcutFor({ key: '?' })).toEqual({ type: 'help' });
    expect(shortcutFor({ key: 'Escape' })).toEqual({ type: 'close' });
    expect(shortcutFor({ key: 'x' })).toBeNull();
  });

  it('Shift + + soma 10, também no teclado português (Shift + + = *)', () => {
    expect(shortcutFor({ key: '+', shiftKey: true })).toEqual({ type: 'count', delta: 10 });
    expect(shortcutFor({ key: '*', code: 'BracketRight', shiftKey: true })).toEqual({ type: 'count', delta: 10 });
    expect(shortcutFor({ key: '*', code: 'NumpadMultiply' })).toBeNull();
  });

  it('desliga-se em campos de texto e com Ctrl/Cmd/Alt, exceto Esc', () => {
    const textarea = { tagName: 'TEXTAREA' };
    expect(shortcutFor({ key: 'c', target: textarea })).toBeNull();
    expect(shortcutFor({ key: '+', target: { tagName: 'INPUT', type: 'number' } })).toBeNull();
    expect(shortcutFor({ key: 'Escape', target: textarea })).toEqual({ type: 'close' });
    expect(shortcutFor({ key: 'c', ctrlKey: true })).toBeNull();
    expect(shortcutFor({ key: 'c', target: { tagName: 'INPUT', type: 'checkbox' } })).toEqual({ type: 'toggle-done' });
  });

  it('isTypingTarget reconhece campos editáveis', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('moveIndex', () => {
  it('anda na grelha e fica dentro dos limites', () => {
    expect(moveIndex(0, 1, 0, 17, 6)).toBe(1);
    expect(moveIndex(1, 0, 1, 17, 6)).toBe(7);
    expect(moveIndex(14, 0, 1, 17, 6)).toBe(16);
    expect(moveIndex(0, -1, 0, 17, 6)).toBe(0);
    expect(moveIndex(3, 0, -1, 17, 6)).toBe(0);
    expect(moveIndex(0, 1, 0, 0, 6)).toBe(0);
  });
});
