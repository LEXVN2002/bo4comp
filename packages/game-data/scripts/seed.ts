import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { rawGameData } from '../data.ts';
import { GameDataValidationError, validateGameData } from '../schemas.ts';
import { generateSeedSql } from '../sql.ts';
import { SEED_SQL_PATH } from './paths.ts';

try {
  const data = validateGameData(rawGameData);
  writeFileSync(SEED_SQL_PATH, generateSeedSql(data), 'utf8');
  const unverified = data.camos.filter((c) => !c.verified).length;
  console.log(
    `seed.sql gerado em ${relative(process.cwd(), SEED_SQL_PATH)}: ` +
      `${data.maps.length} mapas, ${data.weapons.length} armas, ${data.camos.length} camos ` +
      `(${unverified} por confirmar), ${data.easterEggs.length} easter eggs, ` +
      `${data.challenges.length} desafios.`,
  );
} catch (error) {
  if (error instanceof GameDataValidationError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
