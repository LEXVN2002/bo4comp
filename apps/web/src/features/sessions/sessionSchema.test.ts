import { describe, expect, it } from 'vitest';
import { parseSessionForm, type SessionFormValues } from './sessionSchema';

function values(overrides: Partial<SessionFormValues> = {}): SessionFormValues {
  return {
    mapId: 'ix',
    mode: 'normal',
    players: '1',
    round: '25',
    notes: '',
    weapons: [],
    ...overrides,
  };
}

describe('parseSessionForm', () => {
  it('converte um formulário válido no payload de record_session', () => {
    const result = parseSessionForm(
      values({
        notes: '  com amigos ',
        weapons: [
          { weaponId: 'saug-9mm', kills: '120', headshots: '30' },
          { weaponId: 'titan', kills: ' 15 ', headshots: '' },
        ],
      }),
    );
    expect(result).toEqual({
      ok: true,
      payload: {
        p_map_id: 'ix',
        p_round_reached: 25,
        p_mode: 'normal',
        p_players: 1,
        p_notes: 'com amigos',
        p_weapon_stats: [
          { weapon_id: 'saug-9mm', kills: 120, headshots: 30 },
          { weapon_id: 'titan', kills: 15, headshots: 0 },
        ],
      },
    });
  });

  it('notas vazias são omitidas e armas a zero são descartadas', () => {
    const result = parseSessionForm(
      values({ weapons: [{ weaponId: 'mx9', kills: '0', headshots: '' }] }),
    );
    expect(result.ok && 'p_notes' in result.payload).toBe(false);
    expect(result.ok && result.payload.p_weapon_stats).toEqual([]);
  });

  it('exige mapa e ronda', () => {
    const result = parseSessionForm(values({ mapId: '', round: ' ' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.mapId).toBe('Escolhe um mapa.');
      expect(result.errors.round).toBe('Indica a ronda.');
    }
  });

  it('rejeita números inválidos com a chave do campo certo', () => {
    const result = parseSessionForm(
      values({
        players: '5',
        round: '2.5',
        weapons: [{ weaponId: 'mx9', kills: '-1', headshots: 'abc' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.players).toMatch(/entre 1 e 4/);
      expect(result.errors.round).toMatch(/número inteiro/);
      expect(result.errors['weapons.0.kills']).toMatch(/Kills tem de ser/);
      expect(result.errors['weapons.0.headshots']).toMatch(/Headshots tem de ser/);
    }
  });

  it('rejeita armas repetidas', () => {
    const result = parseSessionForm(
      values({
        weapons: [
          { weaponId: 'mx9', kills: '1', headshots: '0' },
          { weaponId: 'mx9', kills: '2', headshots: '0' },
        ],
      }),
    );
    expect(!result.ok && result.errors['weapons.1.weaponId']).toBe('Arma repetida.');
  });

  it('rejeita modos desconhecidos', () => {
    const result = parseSessionForm(values({ mode: 'zen' as SessionFormValues['mode'] }));
    expect(!result.ok && result.errors.mode).toBe('Modo inválido.');
  });
});
