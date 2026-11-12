import { useId, useState, type KeyboardEvent } from 'react';
import { weaponClassLabel } from '../../lib/labels';
import type { WeaponRow } from '../catalog/queries';
import { searchWeapons } from '../camos/weapons';

interface Props {
  weapons: readonly WeaponRow[];
  exclude: ReadonlySet<string>;
  onPick: (weapon: WeaponRow) => void;
}

const MAX_RESULTS = 8;

/** Campo de pesquisa com autocompletar para acrescentar armas à sessão (teclado ou toque). */
export function WeaponPicker({ weapons, exclude, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = searchWeapons(weapons, query, exclude).slice(0, MAX_RESULTS);
  const showList = open && results.length > 0;
  const activeIndex = Math.min(active, results.length - 1);

  function pick(weapon: WeaponRow) {
    onPick(weapon);
    setQuery('');
    setActive(0);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      const weapon = results[activeIndex];
      if (showList && weapon) {
        event.preventDefault();
        pick(weapon);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${activeIndex}` : undefined}
        aria-label="Acrescentar arma"
        placeholder="Acrescentar arma (ex.: saug, titan)…"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="input"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg"
        >
          {results.map((weapon, i) => (
            <li
              key={weapon.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // onMouseDown em vez de onClick: corre antes do blur do input.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(weapon);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                i === activeIndex ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-300'
              }`}
            >
              <span>{weapon.name}</span>
              <span className="text-xs text-zinc-500">{weaponClassLabel(weapon.weapon_class)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
