import camos from './camos.json' with { type: 'json' };
import challenges from './challenges.json' with { type: 'json' };
import easterEggs from './easter-eggs.json' with { type: 'json' };
import maps from './maps.json' with { type: 'json' };
import weapons from './weapons.json' with { type: 'json' };
import type { GameData } from './schemas.ts';

/** Conteúdo cru dos JSON, ainda por validar. */
export const rawGameData: Record<keyof GameData, unknown> = {
  maps,
  weapons,
  camos,
  easterEggs,
  challenges,
};
