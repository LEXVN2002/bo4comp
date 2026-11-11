import { SESSION_MODES, type SessionMode } from '@bo4/shared';
import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ErrorMessage, Loading } from '../components/QueryState';
import { useCatalog, type Catalog } from '../features/catalog/queries';
import { useDeleteSession, useSessions, type SessionWithStats } from '../features/sessions/queries';
import { describeError } from '../lib/errors';
import { formatDateTime, formatPlayers } from '../lib/format';
import { SESSION_MODE_LABELS } from '../lib/labels';

export default function Sessions() {
  const catalog = useCatalog();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [searchParams, setSearchParams] = useSearchParams();
  const mapId = searchParams.get('mapa');
  const modeParam = searchParams.get('modo');
  const mode = SESSION_MODES.find((m) => m === modeParam) ?? null;
  const sessions = useSessions({ mapId, mode });

  function setFilter(key: 'mapa' | 'modo', value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  const filtered = Boolean(mapId || mode);
  const rows = sessions.data?.pages.flat() ?? [];

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
        <Link to="/sessions/new" className="btn-primary px-3 py-1.5">
          Registar sessão
        </Link>
      </header>

      {flash && (
        <p role="status" className="rounded-md border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-100">
          {flash}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        <label className="text-sm">
          <span className="sr-only">Filtrar por mapa</span>
          <select value={mapId ?? ''} onChange={(e) => setFilter('mapa', e.target.value)} className="input">
            <option value="">Todos os mapas</option>
            {catalog.data?.maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Filtrar por modo</span>
          <select value={mode ?? ''} onChange={(e) => setFilter('modo', e.target.value)} className="input">
            <option value="">Todos os modos</option>
            {SESSION_MODES.map((m) => (
              <option key={m} value={m}>
                {SESSION_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {catalog.isPending || sessions.isPending ? (
        <Loading />
      ) : catalog.isError ? (
        <ErrorMessage error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : sessions.isError ? (
        <ErrorMessage error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">
          {filtered ? (
            'Nenhuma sessão com estes filtros.'
          ) : (
            <>
              Ainda não registaste nenhuma sessão.{' '}
              <Link to="/sessions/new" className="text-emerald-400 hover:underline">
                Registar a primeira
              </Link>
            </>
          )}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((session) => (
              <SessionItem key={session.id} session={session} catalog={catalog.data} />
            ))}
          </ul>
          {sessions.hasNextPage && (
            <button
              type="button"
              onClick={() => sessions.fetchNextPage()}
              disabled={sessions.isFetchingNextPage}
              className="btn-secondary w-full"
            >
              {sessions.isFetchingNextPage ? 'A carregar…' : 'Mostrar mais'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function SessionItem({ session, catalog }: { session: SessionWithStats; catalog: Catalog }) {
  const remove = useDeleteSession();
  const [confirming, setConfirming] = useState(false);
  const mapName = catalog.maps.find((m) => m.id === session.map_id)?.name ?? session.map_id;
  const modeLabel = SESSION_MODE_LABELS[session.mode as SessionMode] ?? session.mode;
  const totalKills = session.session_weapon_stats.reduce((sum, s) => sum + s.kills, 0);

  return (
    <li className="card p-4">
      <div className="flex items-start gap-4">
        <div className="w-16 shrink-0 text-center">
          <p className="text-2xl leading-none font-semibold tabular-nums">{session.round_reached}</p>
          <p className="mt-1 text-[11px] tracking-wide text-zinc-500 uppercase">ronda</p>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">{mapName}</p>
          <p className="text-xs text-zinc-400">
            {formatDateTime(session.played_at)} · {modeLabel} · {formatPlayers(session.players)}
            {session.source !== 'manual' && ` · ${session.source.toUpperCase()}`}
          </p>
          {session.session_weapon_stats.length > 0 && (
            <p className="text-xs text-zinc-400">
              <span className="text-zinc-300 tabular-nums">{totalKills} kills</span>:{' '}
              {session.session_weapon_stats
                .map((s) => {
                  const name = catalog.weaponsById.get(s.weapon_id)?.name ?? s.weapon_id;
                  return `${name} ${s.kills} (${s.headshots} HS)`;
                })
                .join(', ')}
            </p>
          )}
          {session.notes && <p className="text-sm text-zinc-300">{session.notes}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-sm">
        {confirming ? (
          <>
            <span className="mr-auto text-xs text-zinc-400">
              Apagar? As kills desta sessão são descontadas dos camos ainda bloqueados.
            </span>
            <button type="button" onClick={() => setConfirming(false)} className="btn-secondary px-3 py-1.5">
              Cancelar
            </button>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate(session.id)}
              className="btn-primary bg-red-700 px-3 py-1.5 hover:bg-red-600 focus-visible:ring-red-400"
            >
              {remove.isPending ? 'A apagar…' : 'Apagar'}
            </button>
          </>
        ) : (
          <>
            <Link to={`/sessions/${session.id}/edit`} className="btn-secondary px-3 py-1.5">
              Editar
            </Link>
            <button type="button" onClick={() => setConfirming(true)} className="btn-secondary px-3 py-1.5">
              Apagar
            </button>
          </>
        )}
      </div>
      {remove.isError && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          Não foi possível apagar: {describeError(remove.error)}
        </p>
      )}
    </li>
  );
}
