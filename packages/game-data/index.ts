import { rawGameData } from './data.ts';
import { validateGameData } from './schemas.ts';

export * from './schemas.ts';

/** Catálogo do jogo validado. Lança erro ao importar se algum JSON for inválido. */
export const gameData = validateGameData(rawGameData);
