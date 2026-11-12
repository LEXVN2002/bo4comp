import { describe, expect, it } from 'vitest';
import { backupFileName, parseBackup, type BackupInput, type CatalogIds } from './backup';

const catalog: CatalogIds = {
  maps: new Set(['ix']),
  weapons: new Set(['saug-9mm', 'titan']),
  camos: new Set(['overgrowth', 'gold']),
  easterEggs: new Set(['ix-main']),
  steps: new Set(['ix-main-1']),
  challenges: new Set(['ch-1']),
};

function backup(overrides: Partial<BackupInput> = {}): BackupInput {
  return {
    format: 'bo4-zombies-companion',
    version: 2,
    exported_at: '2026-11-12T10:00:00.123456+00:00',
    weapon_camo_progress: [
      { weapon_id: 'saug-9mm', camo_id: 'overgrowth', current_count: 40, unlocked_at: null },
      { weapon_id: 'saug-9mm', camo_id: 'gold', current_count: 0, unlocked_at: '2026-11-11T20:00:00+00:00' },
    ],
    easter_egg_step_progress: [{ step_id: 'ix-main-1', done_at: '2026-11-11T20:00:00+00:00' }],
    easter_egg_completions: [
      { easter_egg_id: 'ix-main', completed_at: '2026-11-11T21:00:00+00:00', players: 2, notes: null },
    ],
    challenge_progress: [{ challenge_id: 'ch-1', current_count: 1, completed_at: null }],
    sessions: [
      {
        map_id: 'ix',
        played_at: '2026-11-11T19:00:00+00:00',
        round_reached: 20,
        mode: 'normal',
        players: 1,
        source: 'manual',
        notes: null,
        status: 'done',
        weapon_stats: [{ weapon_id: 'titan', kills: 30, headshots: 5 }],
      },
      {
        map_id: 'ix',
        played_at: '2026-11-12T19:00:00+00:00',
        round_reached: null,
        mode: 'normal',
        players: 1,
        source: 'manual',
        notes: null,
        status: 'live',
        weapon_stats: [],
      },
    ],
    user_camo_overrides: [
      {
        camo_id: 'overgrowth',
        requirement_type: 'kills',
        requirement_text: null,
        requirement_value: 100,
        updated_at: '2026-11-11T20:00:00+00:00',
      },
    ],
    pinned_weapons: [{ weapon_id: 'titan', sort_order: 0, pinned_at: '2026-11-11T20:00:00+00:00' }],
    camo_notes: [{ weapon_id: 'titan', camo_id: 'gold', body: 'x', updated_at: '2026-11-11T20:00:00+00:00' }],
    weapon_notes: [{ weapon_id: 'titan', body: 'y', updated_at: '2026-11-11T20:00:00+00:00' }],
    goals: [
      {
        title: '10 camos',
        type: 'camo_count',
        target: 10,
        weapon_id: null,
        weapon_class: 'smg',
        camo_id: null,
        period: 'weekly',
        created_at: '2026-11-11T20:00:00+00:00',
        archived_at: null,
      },
    ],
    user_settings: { player_name: 'Jogador', sound_enabled: true, sound_volume: 0.6 },
    ...overrides,
  };
}

describe('parseBackup', () => {
  it('aceita um backup válido e resume o conteúdo', () => {
    const result = parseBackup(JSON.stringify(backup()), catalog);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toEqual({
        exportedAt: '2026-11-12T10:00:00.123456+00:00',
        sessions: 2,
        camoRows: 2,
        unlockedCamos: 1,
        steps: 1,
        completions: 1,
        challenges: 1,
        overrides: 1,
        pinnedWeapons: 1,
        notes: 2,
        goals: 1,
      });
    }
  });

  it('aceita um backup vazio', () => {
    const empty = backup({
      weapon_camo_progress: [],
      easter_egg_step_progress: [],
      easter_egg_completions: [],
      challenge_progress: [],
      sessions: [],
    });
    expect(parseBackup(JSON.stringify(empty), catalog).ok).toBe(true);
  });

  it('recusa texto que não é JSON', () => {
    expect(parseBackup('não é json', catalog)).toEqual({ ok: false, errors: ['O ficheiro não é JSON válido.'] });
  });

  it('recusa outro formato ou outra versão', () => {
    const other = parseBackup(JSON.stringify({ ...backup(), format: 'outro' }), catalog);
    expect(!other.ok && other.errors.join()).toMatch(/não é um backup/);
    const v3 = parseBackup(JSON.stringify({ ...backup(), version: 3 }), catalog);
    expect(!v3.ok && v3.errors.join()).toMatch(/versão não suportada/);
  });

  it('aceita backups da versão 1, sem as coleções novas', () => {
    const v1 = {
      format: 'bo4-zombies-companion',
      version: 1,
      exported_at: '2026-11-12T10:00:00+00:00',
      weapon_camo_progress: [],
      easter_egg_step_progress: [],
      easter_egg_completions: [],
      challenge_progress: [],
      sessions: [
        {
          map_id: 'ix',
          played_at: '2026-11-11T19:00:00+00:00',
          round_reached: 20,
          mode: 'normal',
          players: 1,
          source: 'manual',
          notes: null,
          weapon_stats: [],
        },
      ],
    };
    const result = parseBackup(JSON.stringify(v1), catalog);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.sessions[0]!.status).toBe('done');
      expect(result.backup.goals).toEqual([]);
      expect(result.backup.user_settings).toBeNull();
    }
  });

  it('recusa sessões terminadas sem ronda', () => {
    const bad = backup();
    bad.sessions[0]!.round_reached = null;
    const result = parseBackup(JSON.stringify(bad), catalog);
    expect(!result.ok && result.errors.join()).toMatch(/sessão terminada sem ronda/);
  });

  it('verifica no catálogo as referências das coleções novas', () => {
    const pinned = [{ weapon_id: 'nao-existe', sort_order: 0, pinned_at: '2026-11-11T20:00:00+00:00' }];
    const result = parseBackup(JSON.stringify(backup({ pinned_weapons: pinned })), catalog);
    expect(!result.ok && result.errors.join()).toMatch(/armas que não existem no catálogo atual: nao-existe/);
  });

  it('recusa valores inválidos com o caminho do campo', () => {
    const bad = backup();
    (bad.sessions[0] as { round_reached: number }).round_reached = -1;
    const result = parseBackup(JSON.stringify(bad), catalog);
    expect(!result.ok && result.errors.join()).toMatch(/^sessions\.0\.round_reached/);
  });

  it('lista referências que não existem no catálogo atual', () => {
    const stale = backup({
      easter_egg_step_progress: [{ step_id: 'ix-main-9', done_at: '2026-11-11T20:00:00+00:00' }],
    });
    stale.sessions[0]!.weapon_stats.push({ weapon_id: 'arma-removida', kills: 1, headshots: 0 });
    const result = parseBackup(JSON.stringify(stale), catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'O backup refere passos de easter eggs que não existem no catálogo atual: ix-main-9.',
      );
      expect(result.errors).toContain('O backup refere armas que não existem no catálogo atual: arma-removida.');
    }
  });
});

describe('backupFileName', () => {
  it('usa a data local com zeros à esquerda', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('bo4-progresso-2026-01-05.json');
  });
});
