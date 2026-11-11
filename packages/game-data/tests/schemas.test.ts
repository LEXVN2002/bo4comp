import { describe, expect, it } from 'vitest';
import { rawGameData } from '../data.ts';
import { GameDataValidationError, validateGameData, type GameData } from '../schemas.ts';

function base(): Record<keyof GameData, unknown> {
  return {
    maps: [{ id: 'ix', name: 'IX', storyline: 'chaos', release_order: 1, is_dlc: false }],
    weapons: [{ id: 'saug-9mm', name: 'Saug 9mm', weapon_class: 'smg', source: 'base' }],
    camos: [
      {
        id: 'overgrowth',
        name: 'Overgrowth',
        tier: 1,
        kind: 'zombies',
        requirement_type: 'kills',
        requirement_value: null,
        requirement_text: 'Por confirmar no jogo',
        verified: false,
      },
    ],
    easterEggs: [
      {
        id: 'ix-main',
        map_id: 'ix',
        name: 'IX — Main Quest',
        type: 'main',
        min_players: null,
        max_players: null,
        verified: false,
        steps: [],
      },
    ],
    challenges: [],
  };
}

function issuesOf(raw: Record<keyof GameData, unknown>): string[] {
  try {
    validateGameData(raw);
  } catch (error) {
    if (error instanceof GameDataValidationError) return error.issues;
    throw error;
  }
  return [];
}

describe('game-data real', () => {
  it('os JSON do repositório são válidos', () => {
    const data = validateGameData(rawGameData);
    expect(data.maps).toHaveLength(8);
    expect(data.weapons).toHaveLength(26);
    expect(data.camos).toHaveLength(17);
  });

  it('nenhum requisito de camo por confirmar tem valor inventado', () => {
    const data = validateGameData(rawGameData);
    for (const camo of data.camos) {
      if (!camo.verified) expect(camo.requirement_value).toBeNull();
    }
  });
});

describe('validateGameData', () => {
  it('aceita um conjunto mínimo válido, incluindo easter eggs sem passos', () => {
    expect(issuesOf(base())).toEqual([]);
  });

  it('rejeita slugs inválidos', () => {
    const raw = base();
    (raw.weapons as { id: string }[])[0]!.id = 'Saug 9mm';
    expect(issuesOf(raw).join('\n')).toMatch(/weapons\.json \[0\.id\]/);
  });

  it('rejeita campos desconhecidos', () => {
    const raw = base();
    (raw.maps as Record<string, unknown>[])[0]!.extra = 1;
    expect(issuesOf(raw)).not.toEqual([]);
  });

  it("rejeita requirement_value com tipo 'unknown' ou 'prereq_all'", () => {
    for (const requirement_type of ['unknown', 'prereq_all']) {
      const raw = base();
      Object.assign((raw.camos as object[])[0]!, { requirement_type, requirement_value: 100 });
      expect(issuesOf(raw).join('\n')).toMatch(/requirement_value tem de ser null/);
    }
  });

  it("rejeita camo 'unknown' marcado como verified", () => {
    const raw = base();
    Object.assign((raw.camos as object[])[0]!, { requirement_type: 'unknown', verified: true });
    expect(issuesOf(raw).join('\n')).toMatch(/não pode estar verified/);
  });

  it('rejeita camo verified de kills sem valor', () => {
    const raw = base();
    Object.assign((raw.camos as object[])[0]!, { verified: true });
    expect(issuesOf(raw).join('\n')).toMatch(/precisa de requirement_value/);
  });

  it('rejeita ids e tiers repetidos', () => {
    const raw = base();
    const camos = raw.camos as object[];
    camos.push({ ...camos[0]! });
    const issues = issuesOf(raw).join('\n');
    expect(issues).toMatch(/id repetido: overgrowth/);
    expect(issues).toMatch(/tier repetido: 1/);
  });

  it('rejeita referências a mapas inexistentes', () => {
    const raw = base();
    Object.assign((raw.easterEggs as object[])[0]!, { map_id: 'nao-existe' });
    raw.challenges = [
      { id: 'c1', map_id: 'outro', name: 'Desafio', description: 'Descrição', target: 1 },
    ];
    const issues = issuesOf(raw).join('\n');
    expect(issues).toMatch(/mapa inexistente 'nao-existe'/);
    expect(issues).toMatch(/mapa inexistente 'outro'/);
  });

  it('rejeita passos com ordem repetida e jogadores incoerentes', () => {
    const raw = base();
    Object.assign((raw.easterEggs as object[])[0]!, {
      min_players: 4,
      max_players: 2,
      steps: [
        { order: 1, title: 'A', details: null },
        { order: 1, title: 'B', details: null },
      ],
    });
    const issues = issuesOf(raw).join('\n');
    expect(issues).toMatch(/ordem de passo repetida: 1/);
    expect(issues).toMatch(/max_players tem de ser >= min_players/);
  });

  it('reporta problemas de vários ficheiros de uma vez', () => {
    const raw = base();
    raw.maps = 'não é um array';
    raw.weapons = [{}];
    const issues = issuesOf(raw);
    expect(issues.some((i) => i.startsWith('maps.json'))).toBe(true);
    expect(issues.some((i) => i.startsWith('weapons.json'))).toBe(true);
  });
});
