import type { SessionMode } from '@bo4/shared';

export const WEAPON_CLASS_LABELS: Record<string, string> = {
  smg: 'SMG',
  ar: 'Espingardas de assalto',
  tactical: 'Espingardas táticas',
  lmg: 'LMG',
  sniper: 'Snipers',
  pistol: 'Pistolas',
  shotgun: 'Caçadeiras',
  launcher: 'Lançadores',
  melee: 'Corpo a corpo',
  special: 'Especiais',
};

/** Nomes dos modos como aparecem no jogo. */
export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  casual: 'Casual',
  normal: 'Normal',
  hardcore: 'Hardcore',
  realistic: 'Realistic',
  rush: 'Rush',
  gauntlet: 'Gauntlet',
};

export function weaponClassLabel(weaponClass: string): string {
  return WEAPON_CLASS_LABELS[weaponClass] ?? weaponClass;
}
