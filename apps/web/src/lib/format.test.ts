import { describe, expect, it } from 'vitest';
import { formatDateTime, formatPlayers } from './format';

describe('format', () => {
  it('formatPlayers usa singular e plural', () => {
    expect(formatPlayers(1)).toBe('1 jogador');
    expect(formatPlayers(4)).toBe('4 jogadores');
  });

  it('formatDateTime usa dia/mês/ano (pt-PT)', () => {
    const d = new Date(2026, 10, 11, 23, 5); // hora local
    expect(formatDateTime(d.toISOString())).toBe('11/11/2026, 23:05');
  });
});
