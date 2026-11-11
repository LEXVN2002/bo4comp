import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rawGameData } from '../data.ts';
import { validateGameData, type GameData } from '../schemas.ts';
import { SEED_SQL_PATH } from '../scripts/paths.ts';
import { generateSeedSql, sqlLiteral, upsertSql } from '../sql.ts';

const sample: GameData = {
  maps: [{ id: 'ix', name: "IX's", storyline: 'chaos', release_order: 1, is_dlc: false }],
  weapons: [],
  camos: [],
  easterEggs: [
    {
      id: 'ix-main',
      map_id: 'ix',
      name: 'IX — Main Quest',
      type: 'main',
      min_players: 1,
      max_players: 4,
      verified: false,
      steps: [
        { order: 2, title: 'Segundo', details: null },
        { order: 1, title: "Abrir a porta d'arena", details: 'linha 1\nlinha 2' },
      ],
    },
  ],
  challenges: [],
};

describe('sqlLiteral', () => {
  it('escapa plicas e trata null, booleanos e inteiros', () => {
    expect(sqlLiteral("O'Brien")).toBe("'O''Brien'");
    expect(sqlLiteral("'; drop table maps; --")).toBe("'''; drop table maps; --'");
    expect(sqlLiteral(null)).toBe('null');
    expect(sqlLiteral(true)).toBe('true');
    expect(sqlLiteral(42)).toBe('42');
  });

  it('recusa números não inteiros', () => {
    expect(() => sqlLiteral(1.5)).toThrow();
    expect(() => sqlLiteral(Number.NaN)).toThrow();
  });
});

describe('upsertSql', () => {
  it('gera insert ... on conflict (id) do update sem atualizar o id', () => {
    const sql = upsertSql('maps', ['id', 'name'], [['ix', 'IX']]);
    expect(sql).toContain("insert into public.maps (id, name) values\n  ('ix', 'IX')");
    expect(sql).toContain('on conflict (id) do update set\n  name = excluded.name;');
    expect(sql).not.toContain('id = excluded.id');
  });

  it('não gera insert para listas vazias', () => {
    expect(upsertSql('challenges', ['id'], [])).toBe('-- challenges: sem linhas\n');
  });

  it('recusa linhas com o número errado de valores', () => {
    expect(() => upsertSql('maps', ['id', 'name'], [['ix']])).toThrow();
  });
});

describe('generateSeedSql', () => {
  it('é determinístico e corre numa transação', () => {
    const sql = generateSeedSql(sample);
    expect(generateSeedSql(sample)).toBe(sql);
    expect(sql).toMatch(/^-- Gerado/);
    expect(sql).toContain('\nbegin;\n');
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
  });

  it('gera passos com id estável, ordenados, e apaga passos órfãos', () => {
    const sql = generateSeedSql(sample);
    expect(sql.indexOf("'ix-main-1'")).toBeLessThan(sql.indexOf("'ix-main-2'"));
    expect(sql).toContain(
      "('ix-main-1', 'ix-main', 1, 'Abrir a porta d''arena', 'linha 1\nlinha 2')",
    );
    expect(sql).toContain(
      "delete from public.easter_egg_steps\nwhere easter_egg_id = any(array['ix-main'])\n" +
        "  and not (id = any(array['ix-main-1', 'ix-main-2']));",
    );
  });

  it('apaga todos os passos de um easter egg que ficou sem passos', () => {
    const sql = generateSeedSql({
      ...sample,
      easterEggs: [{ ...sample.easterEggs[0]!, steps: [] }],
    });
    expect(sql).toContain("and not (id = any('{}'::text[]));");
    expect(sql).toContain('-- easter_egg_steps: sem linhas');
  });

  it('insere as tabelas pela ordem das chaves estrangeiras', () => {
    const sql = generateSeedSql(validateGameData(rawGameData));
    const order = ['maps', 'weapons', 'camos', 'easter_eggs', 'easter_egg_steps', 'challenges'];
    const positions = order.map((t) => sql.search(new RegExp(`(public\\.${t} |-- ${t}:)`)));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('supabase/seed.sql está atualizado (correr `pnpm seed` se falhar)', () => {
    const expected = generateSeedSql(validateGameData(rawGameData));
    const actual = readFileSync(SEED_SQL_PATH, 'utf8').replace(/\r\n/g, '\n');
    expect(actual).toBe(expected);
  });
});
