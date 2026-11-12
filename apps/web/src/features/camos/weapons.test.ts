import { describe, expect, it } from 'vitest';
import { searchWeapons, sortWeapons, weaponClassesOf } from './weapons';

const weapons = [
  { id: 'titan', name: 'Titan', weapon_class: 'lmg' },
  { id: 'saug-9mm', name: 'Saug 9mm', weapon_class: 'smg' },
  { id: 'icr-7', name: 'ICR-7', weapon_class: 'ar' },
  { id: 'mx9', name: 'MX9', weapon_class: 'smg' },
  { id: 'rk-7-garrison', name: 'RK 7 Garrison', weapon_class: 'pistol' },
];

describe('sortWeapons', () => {
  it('ordena por classe (ordem da spec) e depois por nome', () => {
    expect(sortWeapons(weapons).map((w) => w.id)).toEqual([
      'mx9',
      'saug-9mm',
      'icr-7',
      'titan',
      'rk-7-garrison',
    ]);
  });
});

describe('weaponClassesOf', () => {
  it('devolve as classes presentes pela ordem da spec', () => {
    expect(weaponClassesOf(weapons)).toEqual(['smg', 'ar', 'lmg', 'pistol']);
  });
});

describe('searchWeapons', () => {
  it('ignora maiúsculas, espaços e hífens', () => {
    expect(searchWeapons(weapons, 'saug9').map((w) => w.id)).toEqual(['saug-9mm']);
    expect(searchWeapons(weapons, 'SAUG-9').map((w) => w.id)).toEqual(['saug-9mm']);
    expect(searchWeapons(weapons, 'icr7').map((w) => w.id)).toEqual(['icr-7']);
  });

  it('põe primeiro os nomes que começam pela pesquisa', () => {
    // "RK 7 Garrison" começa por "r"; "ICR-7" só contém "r".
    expect(searchWeapons(weapons, 'r').map((w) => w.id)).toEqual(['rk-7-garrison', 'icr-7']);
  });

  it('exclui armas já escolhidas e devolve todas com pesquisa vazia', () => {
    expect(searchWeapons(weapons, '', new Set(['titan']))).toHaveLength(4);
    expect(searchWeapons(weapons, 'titan', new Set(['titan']))).toEqual([]);
  });
});
