import { useState, type FormEvent } from 'react';
import { ErrorMessage, Loading } from '../components/QueryState';
import type { CamoData } from '../features/camos/useCamoData';
import { sortWeapons, weaponClassesOf } from '../features/camos/weapons';
import { GoalCard } from '../features/goals/GoalCard';
import {
  GOAL_PERIOD_LABELS,
  GOAL_PERIODS,
  GOAL_TYPE_LABELS,
  GOAL_TYPES,
  type GoalPeriod,
  type GoalType,
} from '../features/goals/goalProgress';
import { useCreateGoal } from '../features/goals/queries';
import { useGoalBoard } from '../features/goals/useGoalBoard';
import { describeError } from '../lib/errors';
import { weaponClassLabel } from '../lib/labels';
import { sortByTier } from '../lib/progress';

export default function Goals() {
  const { board, isPending, error, retry } = useGoalBoard();
  if (isPending) return <Loading />;
  if (error || !board) return <ErrorMessage error={error} onRetry={retry} />;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Objetivos</h1>

      <NewGoalForm data={board.data} />

      <section aria-labelledby="active-goals" className="space-y-2">
        <h2 id="active-goals" className="text-sm font-medium tracking-wide text-zinc-400 uppercase">
          Ativos
        </h2>
        {board.active.length === 0 ? (
          <p className="text-sm text-zinc-500">Ainda não tens objetivos ativos. Cria um acima.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {board.active.map((item) => (
              <GoalCard key={item.goal.id} item={item} data={board.data} />
            ))}
          </ul>
        )}
      </section>

      {board.history.length > 0 && (
        <section aria-labelledby="goal-history" className="space-y-2">
          <h2 id="goal-history" className="text-sm font-medium tracking-wide text-zinc-400 uppercase">
            Histórico
          </h2>
          <p className="text-xs text-zinc-500">
            Objetivos sem prazo já cumpridos e objetivos arquivados. Os diários e semanais renovam-se sozinhos.
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {board.history.map((item) => (
              <GoalCard key={item.goal.id} item={item} data={board.data} />
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

type Scope = 'all' | 'class' | 'weapon';

function NewGoalForm({ data }: { data: CamoData }) {
  const create = useCreateGoal();
  const weapons = sortWeapons(data.weapons);
  const classes = weaponClassesOf(weapons);
  const camos = sortByTier(data.catalogCamos);

  const [type, setType] = useState<GoalType>('camo_count');
  const [target, setTarget] = useState('10');
  const [scope, setScope] = useState<Scope>('all');
  const [weaponClass, setWeaponClass] = useState(classes[0] ?? 'smg');
  const [weaponId, setWeaponId] = useState(weapons[0]?.id ?? '');
  const [camoId, setCamoId] = useState(camos[0]?.id ?? '');
  const [period, setPeriod] = useState<GoalPeriod>('weekly');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  // weapon_camo exige arma; kills/headshots não têm âmbito por classe.
  const effectiveScope: Scope = type === 'weapon_camo' ? 'weapon' : type !== 'camo_count' && scope === 'class' ? 'all' : scope;

  function autoTitle(n: number): string {
    const weaponName = data.weaponsById.get(weaponId)?.name ?? weaponId;
    const where =
      effectiveScope === 'weapon' ? ` com a ${weaponName}` : effectiveScope === 'class' ? ` (${weaponClassLabel(weaponClass)})` : '';
    if (type === 'weapon_camo') return `${camos.find((c) => c.id === camoId)?.name ?? camoId} na ${weaponName}`;
    if (type === 'camo_count') return `Concluir ${n} camos${where}`;
    return `${n} ${type === 'kills' ? 'kills' : 'headshots'}${where}`;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const n = type === 'weapon_camo' ? 1 : Number(target);
    if (!Number.isInteger(n) || n < 1) {
      setError('O alvo tem de ser um número inteiro maior que 0.');
      return;
    }
    setError(null);
    create.mutate(
      {
        title: title.trim() || autoTitle(n),
        type,
        target: n,
        weaponId: effectiveScope === 'weapon' ? weaponId : null,
        weaponClass: effectiveScope === 'class' ? weaponClass : null,
        camoId: type === 'weapon_camo' ? camoId : null,
        period,
      },
      {
        onSuccess: () => setTitle(''),
        onError: (e) => setError(describeError(e)),
      },
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h2 className="font-semibold">Novo objetivo</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-zinc-300">
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as GoalType)} className="input mt-1">
            {GOAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {GOAL_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        {type !== 'weapon_camo' && (
          <label className="text-sm text-zinc-300">
            Alvo
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="input mt-1"
            />
          </label>
        )}
        <label className="text-sm text-zinc-300">
          Período
          <select value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)} className="input mt-1">
            {GOAL_PERIODS.map((p) => (
              <option key={p} value={p}>
                {GOAL_PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {type !== 'weapon_camo' && (
          <label className="text-sm text-zinc-300">
            Âmbito
            <select value={effectiveScope} onChange={(e) => setScope(e.target.value as Scope)} className="input mt-1">
              <option value="all">Todas as armas</option>
              {type === 'camo_count' && <option value="class">Uma classe</option>}
              <option value="weapon">Uma arma</option>
            </select>
          </label>
        )}
        {effectiveScope === 'class' && (
          <label className="text-sm text-zinc-300">
            Classe
            <select value={weaponClass} onChange={(e) => setWeaponClass(e.target.value)} className="input mt-1">
              {classes.map((c) => (
                <option key={c} value={c}>
                  {weaponClassLabel(c)}
                </option>
              ))}
            </select>
          </label>
        )}
        {effectiveScope === 'weapon' && (
          <label className="text-sm text-zinc-300">
            Arma
            <select value={weaponId} onChange={(e) => setWeaponId(e.target.value)} className="input mt-1">
              {classes.map((c) => (
                <optgroup key={c} label={weaponClassLabel(c)}>
                  {weapons
                    .filter((w) => w.weapon_class === c)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        {type === 'weapon_camo' && (
          <label className="text-sm text-zinc-300">
            Camo
            <select value={camoId} onChange={(e) => setCamoId(e.target.value)} className="input mt-1">
              {camos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="block text-sm text-zinc-300">
        Título <span className="text-zinc-500">(opcional)</span>
        <input
          type="text"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={autoTitle(Number(target) || 1)}
          className="input mt-1"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={create.isPending} className="btn-primary">
          {create.isPending ? 'A criar…' : 'Criar objetivo'}
        </button>
      </div>
    </form>
  );
}
