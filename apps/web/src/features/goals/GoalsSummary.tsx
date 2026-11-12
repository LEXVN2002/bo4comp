import { Link } from 'react-router';
import { GoalCard } from './GoalCard';
import { useGoalBoard } from './useGoalBoard';

/** Cartão do painel: até 3 objetivos ativos. */
export function GoalsSummary() {
  const { board, isPending, error } = useGoalBoard();

  return (
    <section aria-labelledby="goals-summary" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 id="goals-summary" className="text-sm font-medium text-zinc-400">
          Objetivos
        </h2>
        <Link to="/objetivos" className="text-xs text-zinc-400 hover:text-emerald-400">
          Ver todos
        </Link>
      </div>
      {isPending ? (
        <p className="card p-4 text-sm text-zinc-500">A carregar…</p>
      ) : error || !board ? (
        <p className="card p-4 text-sm text-red-400">Não foi possível carregar os objetivos.</p>
      ) : board.active.length === 0 ? (
        <p className="card p-4 text-sm text-zinc-400">
          Sem objetivos ativos.{' '}
          <Link to="/objetivos" className="text-emerald-400 hover:underline">
            Criar um
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {board.active.slice(0, 3).map((item) => (
            <GoalCard key={item.goal.id} item={item} data={board.data} compact />
          ))}
        </ul>
      )}
    </section>
  );
}
