import { rawGameData } from '../data.ts';
import { GameDataValidationError, validateGameData } from '../schemas.ts';

try {
  const data = validateGameData(rawGameData);
  console.log(
    `game-data válido: ${data.maps.length} mapas, ${data.weapons.length} armas, ` +
      `${data.camos.length} camos, ${data.easterEggs.length} easter eggs, ` +
      `${data.challenges.length} desafios.`,
  );
} catch (error) {
  if (error instanceof GameDataValidationError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
