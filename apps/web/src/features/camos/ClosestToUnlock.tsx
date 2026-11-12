import { Link } from 'react-router';
import { ProgressBar } from '../../components/ProgressBar';
import { closestToUnlock } from '../../lib/progress';
import { requirementUnit } from './pinned';
import type { CamoData } from './useCamoData';

/** Os 3 camos mais perto de desbloquear (só com requisito conhecido). */
export function ClosestToUnlock({ data }: { data: CamoData }) {
  const top = closestToUnlock(
    data.weapons.map((w) => w.id),
    data.camos,
    data.index,
    3,
  );

  if (top.length === 0) {
    return (
      <p className="card p-4 text-sm text-zinc-400">
        Ainda não há camos com requisito conhecido. Abre um camo "por confirmar" numa arma e preenche o desafio (tipo e
        objetivo) para veres aqui o que está mais perto.
      </p>
    );
  }

  return (
    <ol className="card divide-y divide-zinc-800">
      {top.map((c) => {
        const weapon = data.weaponsById.get(c.weaponId);
        return (
          <li key={`${c.weaponId}:${c.camo.id}`}>
            <Link to={`/camos/${c.weaponId}`} className="block space-y-1.5 px-4 py-3 hover:bg-zinc-800/50">
              <p className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{weapon?.name ?? c.weaponId}</span>
                  <span className="text-zinc-400"> · {c.camo.name}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-400 tabular-nums">
                  faltam {c.remaining} {requirementUnit(c.camo.requirement_type)}
                </span>
              </p>
              <ProgressBar value={c.fraction} label={`${weapon?.name ?? c.weaponId}, ${c.camo.name}`} className="h-1.5" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
