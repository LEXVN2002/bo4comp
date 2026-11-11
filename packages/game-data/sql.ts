import { stepId, type GameData } from './schemas.ts';

type SqlValue = string | number | boolean | null;

/** Converte um valor JS num literal SQL seguro (standard_conforming_strings = on). */
export function sqlLiteral(value: SqlValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error(`número não suportado no seed: ${value}`);
    return String(value);
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function textArray(values: string[]): string {
  return values.length === 0 ? "'{}'::text[]" : `array[${values.map(sqlLiteral).join(', ')}]`;
}

/** insert ... on conflict (id) do update, para o seed poder correr várias vezes. */
export function upsertSql(
  table: string,
  columns: readonly string[],
  rows: readonly SqlValue[][],
): string {
  if (rows.length === 0) return `-- ${table}: sem linhas\n`;
  const values = rows.map((row) => {
    if (row.length !== columns.length) {
      throw new Error(`${table}: linha com ${row.length} valores para ${columns.length} colunas`);
    }
    return `  (${row.map(sqlLiteral).join(', ')})`;
  });
  const updates = columns
    .filter((c) => c !== 'id')
    .map((c) => `  ${c} = excluded.${c}`)
    .join(',\n');
  return (
    `insert into public.${table} (${columns.join(', ')}) values\n` +
    `${values.join(',\n')}\n` +
    `on conflict (id) do update set\n${updates};\n`
  );
}

/** Gera supabase/seed.sql (idempotente e determinístico) a partir do game-data validado. */
export function generateSeedSql(data: GameData): string {
  const steps = data.easterEggs.flatMap((egg) =>
    [...egg.steps]
      .sort((a, b) => a.order - b.order)
      .map((s) => [stepId(egg.id, s.order), egg.id, s.order, s.title, s.details] as SqlValue[]),
  );
  const eggIds = data.easterEggs.map((e) => e.id);
  const stepIds = steps.map((s) => s[0] as string);

  const parts = [
    '-- Gerado por `pnpm seed` a partir de packages/game-data. NÃO EDITAR À MÃO.',
    'begin;',
    upsertSql(
      'maps',
      ['id', 'name', 'storyline', 'release_order', 'is_dlc'],
      data.maps.map((m) => [m.id, m.name, m.storyline, m.release_order, m.is_dlc]),
    ),
    upsertSql(
      'weapons',
      ['id', 'name', 'weapon_class', 'source'],
      data.weapons.map((w) => [w.id, w.name, w.weapon_class, w.source]),
    ),
    upsertSql(
      'camos',
      [
        'id',
        'name',
        'tier',
        'kind',
        'requirement_type',
        'requirement_value',
        'requirement_text',
        'verified',
      ],
      data.camos.map((c) => [
        c.id,
        c.name,
        c.tier,
        c.kind,
        c.requirement_type,
        c.requirement_value,
        c.requirement_text,
        c.verified,
      ]),
    ),
    upsertSql(
      'easter_eggs',
      ['id', 'map_id', 'name', 'type', 'min_players', 'max_players', 'verified'],
      data.easterEggs.map((e) => [
        e.id,
        e.map_id,
        e.name,
        e.type,
        e.min_players,
        e.max_players,
        e.verified,
      ]),
    ),
    '-- Passos que deixaram de existir no JSON (o progresso desses passos é apagado em cascata).',
    eggIds.length === 0
      ? '-- easter_egg_steps: sem easter eggs\n'
      : `delete from public.easter_egg_steps\n` +
        `where easter_egg_id = any(${textArray(eggIds)})\n` +
        `  and not (id = any(${textArray(stepIds)}));\n`,
    upsertSql('easter_egg_steps', ['id', 'easter_egg_id', 'step_order', 'title', 'details'], steps),
    upsertSql(
      'challenges',
      ['id', 'map_id', 'name', 'description', 'target'],
      data.challenges.map((c) => [c.id, c.map_id, c.name, c.description, c.target]),
    ),
    'commit;',
  ];
  return parts.join('\n') + '\n';
}
