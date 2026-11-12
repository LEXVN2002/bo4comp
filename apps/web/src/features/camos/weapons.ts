import { WEAPON_CLASSES } from '@bo4/game-data/schemas';

const CLASS_ORDER = new Map<string, number>(WEAPON_CLASSES.map((c, i) => [c, i]));

/** Ordena armas por classe (ordem da spec) e depois por nome. */
export function sortWeapons<T extends { weapon_class: string; name: string }>(weapons: readonly T[]): T[] {
  return [...weapons].sort(
    (a, b) =>
      (CLASS_ORDER.get(a.weapon_class) ?? 99) - (CLASS_ORDER.get(b.weapon_class) ?? 99) ||
      a.name.localeCompare(b.name, 'pt-PT'),
  );
}

/** Classes presentes na lista, pela ordem da spec. */
export function weaponClassesOf(weapons: readonly { weapon_class: string }[]): string[] {
  const present = new Set(weapons.map((w) => w.weapon_class));
  return [...present].sort((a, b) => (CLASS_ORDER.get(a) ?? 99) - (CLASS_ORDER.get(b) ?? 99));
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Pesquisa de armas para autocompletar: ignora maiúsculas, espaços, hífens e acentos
 * ("saug9", "Saug 9mm" e "SAUG-9" encontram a mesma arma). Prefixos primeiro.
 */
export function searchWeapons<T extends { id: string; name: string }>(
  weapons: readonly T[],
  query: string,
  exclude: ReadonlySet<string> = new Set(),
): T[] {
  const q = normalize(query);
  const candidates = weapons.filter((w) => !exclude.has(w.id));
  if (!q) return candidates;
  const starts: T[] = [];
  const contains: T[] = [];
  for (const weapon of candidates) {
    const name = normalize(weapon.name);
    if (name.startsWith(q)) starts.push(weapon);
    else if (name.includes(q)) contains.push(weapon);
  }
  return [...starts, ...contains];
}
