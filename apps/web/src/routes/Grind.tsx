import { SESSION_MODES, type SessionMode } from '@bo4/shared';
import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErrorMessage, Loading } from '../components/QueryState';
import { requirementUnit } from '../features/camos/pinned';
import { useCamoData, type CamoData } from '../features/camos/useCamoData';
import type { MapRow, WeaponRow } from '../features/catalog/queries';
import { useCatalog } from '../features/catalog/queries';
import {
  saveLiveStats,
  useDiscardLiveSession,
  useFinishLiveSession,
  useLiveSession,
  useStartLiveSession,
  type LiveSession,
  type UnlockedCamo,
} from '../features/grind/queries';
import { EMPTY_TALLY, projectNextCamo, tallyReducer, tallyToStats, totalKills, type TallyState } from '../features/grind/tally';
import { useLastSession } from '../features/sessions/queries';
import { WeaponPicker } from '../features/sessions/WeaponPicker';
import { useUnlockAnimations } from '../features/unlocks/UnlockAnimations';
import { describeError } from '../lib/errors';
import { SESSION_MODE_LABELS } from '../lib/labels';
import { useWakeLock } from '../lib/useWakeLock';

type Phase =
  | { kind: 'setup' }
  | { kind: 'playing'; session: Pick<LiveSession, 'id' | 'map_id' | 'mode' | 'players'> }
  | { kind: 'done'; mapName: string; round: number; kills: number; unlocked: UnlockedCamo[] };

export default function Grind() {
  const catalog = useCatalog();
  const camoData = useCamoData();
  const live = useLiveSession();
  const last = useLastSession();
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [initialTally, setInitialTally] = useState<TallyState>(EMPTY_TALLY);

  // Ecrã sempre ligado durante a partida.
  useWakeLock(phase.kind === 'playing');

  if (catalog.isPending || camoData.isPending || live.isPending || last.isPending) return <Loading />;
  if (catalog.isError) return <ErrorMessage error={catalog.error} onRetry={() => catalog.refetch()} />;
  if (camoData.error || !camoData.data) return <ErrorMessage error={camoData.error} onRetry={camoData.retry} />;
  if (live.isError) return <ErrorMessage error={live.error} onRetry={() => live.refetch()} />;

  const maps = catalog.data.maps;
  const mapName = (id: string) => maps.find((m) => m.id === id)?.name ?? id;

  if (phase.kind === 'playing') {
    return (
      <LivePlay
        key={phase.session.id}
        session={phase.session}
        mapName={mapName(phase.session.map_id)}
        data={camoData.data}
        initialTally={initialTally}
        onFinished={(result) => setPhase({ kind: 'done', mapName: mapName(phase.session.map_id), ...result })}
        onDiscarded={() => setPhase({ kind: 'setup' })}
      />
    );
  }

  if (phase.kind === 'done') {
    return <DoneScreen phase={phase} data={camoData.data} onNew={() => setPhase({ kind: 'setup' })} />;
  }

  // Há uma sessão ao vivo por terminar: retomar ou descartar.
  if (live.data) {
    return (
      <ResumeCard
        live={live.data}
        mapName={mapName(live.data.map_id)}
        weaponsById={camoData.data.weaponsById}
        onResume={() => {
          const used = Object.keys(live.data!.counts);
          setInitialTally({ activeWeaponId: used[0] ?? null, counts: live.data!.counts, history: [] });
          setPhase({ kind: 'playing', session: live.data! });
        }}
      />
    );
  }

  return (
    <SetupForm
      maps={maps}
      data={camoData.data}
      defaults={{
        mapId: last.data?.map_id ?? maps[0]?.id ?? '',
        mode: (SESSION_MODES as readonly string[]).includes(last.data?.mode ?? '')
          ? (last.data!.mode as SessionMode)
          : 'normal',
        players: last.data?.players ?? 1,
      }}
      onStarted={(session, weaponId) => {
        setInitialTally({ activeWeaponId: weaponId, counts: { [weaponId]: { kills: 0, headshots: 0 } }, history: [] });
        setPhase({ kind: 'playing', session });
      }}
    />
  );
}

// ---------------------------------------------------------------- Início

function SetupForm({
  maps,
  data,
  defaults,
  onStarted,
}: {
  maps: MapRow[];
  data: CamoData;
  defaults: { mapId: string; mode: SessionMode; players: number };
  onStarted: (session: Pick<LiveSession, 'id' | 'map_id' | 'mode' | 'players'>, weaponId: string) => void;
}) {
  const start = useStartLiveSession();
  const [mapId, setMapId] = useState(defaults.mapId);
  const [mode, setMode] = useState<SessionMode>(defaults.mode);
  const [players, setPlayers] = useState(defaults.players);
  const [weaponId, setWeaponId] = useState<string | null>(data.pinned[0] ?? null);
  const weapon = weaponId ? data.weaponsById.get(weaponId) : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!weaponId) return;
    start.mutate(
      { mapId, mode, players },
      { onSuccess: (id) => onStarted({ id, map_id: mapId, mode, players }, weaponId) },
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Modo grind</h1>
        <p className="text-sm text-zinc-400">
          Conta kills e headshots enquanto jogas. Só grava no progresso quando terminares a partida.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block text-sm text-zinc-300 sm:col-span-1">
          Mapa
          <select value={mapId} onChange={(e) => setMapId(e.target.value)} className="input mt-1">
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block text-sm text-zinc-300 sm:col-span-1">
          Modo
          <select value={mode} onChange={(e) => setMode(e.target.value as SessionMode)} className="input mt-1">
            {SESSION_MODES.map((m) => (
              <option key={m} value={m}>
                {SESSION_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm text-zinc-300">Jogadores</legend>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={players === n}
              onClick={() => setPlayers(n)}
              className={`rounded-md border py-2 text-sm ${
                players === n ? 'border-emerald-600 bg-emerald-600/20 text-emerald-200' : 'border-zinc-700 text-zinc-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm text-zinc-300">
          Arma ativa: <span className="font-semibold text-zinc-100">{weapon?.name ?? 'escolhe uma'}</span>
        </p>
        <WeaponChooser data={data} activeId={weaponId} onPick={setWeaponId} />
      </div>

      {start.isError && (
        <p role="alert" className="text-sm text-red-400">
          Não foi possível começar: {describeError(start.error)}
        </p>
      )}
      <button type="submit" disabled={!weaponId || start.isPending} className="btn-primary w-full py-3 text-base">
        {start.isPending ? 'A começar…' : 'Começar partida'}
      </button>
    </form>
  );
}

/** Armas afixadas em destaque + pesquisa para as outras. */
function WeaponChooser({
  data,
  activeId,
  onPick,
  extraIds = [],
}: {
  data: CamoData;
  activeId: string | null;
  onPick: (weaponId: string) => void;
  /** Armas já usadas nesta partida (aparecem junto às afixadas). */
  extraIds?: string[];
}) {
  const quickIds = [...new Set([...data.pinned, ...extraIds])];
  return (
    <div className="space-y-2">
      {quickIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickIds.map((id) => {
            const w = data.weaponsById.get(id);
            if (!w) return null;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={activeId === id}
                onClick={() => onPick(id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  activeId === id
                    ? 'border-emerald-500 bg-emerald-600/20 text-emerald-200'
                    : 'border-zinc-700 text-zinc-300 hover:text-zinc-100'
                }`}
              >
                {data.pinned.includes(id) ? '📌 ' : ''}
                {w.name}
              </button>
            );
          })}
        </div>
      )}
      <WeaponPicker weapons={data.weapons} exclude={new Set()} onPick={(w: WeaponRow) => onPick(w.id)} />
    </div>
  );
}

// ---------------------------------------------------------------- Retomar

function ResumeCard({
  live,
  mapName,
  weaponsById,
  onResume,
}: {
  live: LiveSession;
  mapName: string;
  weaponsById: Map<string, WeaponRow>;
  onResume: () => void;
}) {
  const discard = useDiscardLiveSession();
  const [confirming, setConfirming] = useState(false);
  const used = Object.entries(live.counts);
  return (
    <section className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Modo grind</h1>
      <div className="card space-y-3 p-4">
        <p className="font-medium">Tens uma partida por terminar</p>
        <p className="text-sm text-zinc-400">
          {mapName} · {SESSION_MODE_LABELS[live.mode as SessionMode] ?? live.mode} · começada em{' '}
          {new Date(live.played_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
        {used.length > 0 ? (
          <ul className="text-sm text-zinc-300">
            {used.map(([id, t]) => (
              <li key={id}>
                {weaponsById.get(id)?.name ?? id}: {t.kills} kills ({t.headshots} headshots)
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Ainda sem kills registadas.</p>
        )}
        {discard.isError && (
          <p role="alert" className="text-sm text-red-400">
            Não foi possível descartar: {describeError(discard.error)}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onResume} className="btn-primary flex-1 py-3">
            Retomar
          </button>
          {confirming ? (
            <button
              type="button"
              disabled={discard.isPending}
              onClick={() => discard.mutate(live.id)}
              className="btn-secondary flex-1 border-red-800 py-3 text-red-300"
            >
              {discard.isPending ? 'A descartar…' : 'Confirmar: descartar'}
            </button>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="btn-secondary flex-1 py-3">
              Descartar
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Partida

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

function LivePlay({
  session,
  mapName,
  data,
  initialTally,
  onFinished,
  onDiscarded,
}: {
  session: Pick<LiveSession, 'id' | 'map_id' | 'mode' | 'players'>;
  mapName: string;
  data: CamoData;
  initialTally: TallyState;
  onFinished: (result: { round: number; kills: number; unlocked: UnlockedCamo[] }) => void;
  onDiscarded: () => void;
}) {
  const [tally, dispatch] = useReducer(tallyReducer, initialTally);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [choosing, setChoosing] = useState(initialTally.activeWeaponId === null);
  const [finishing, setFinishing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  const latestCounts = useRef(tally.counts);
  const discard = useDiscardLiveSession();

  const persist = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSaveStatus('saving');
    try {
      await saveLiveStats(session.id, tallyToStats(latestCounts.current));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
      throw new Error('Não foi possível guardar as contagens. Verifica a ligação e tenta outra vez.');
    }
  }, [session.id]);

  // Guarda cada toque com 1 s de espera, para não perder nada se o browser fechar.
  useEffect(() => {
    latestCounts.current = tally.counts;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist().catch(() => {}), 1000);
  }, [tally.counts, persist]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const active = tally.activeWeaponId ? data.weaponsById.get(tally.activeWeaponId) : undefined;
  const activeCounts = (tally.activeWeaponId && tally.counts[tally.activeWeaponId]) || { kills: 0, headshots: 0 };
  const usedIds = Object.keys(tally.counts);

  if (finishing) {
    return (
      <FinishForm
        mapName={mapName}
        tally={tally}
        data={data}
        persist={persist}
        sessionId={session.id}
        onBack={() => setFinishing(false)}
        onFinished={onFinished}
      />
    );
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{mapName}</h1>
          <p className="text-xs text-zinc-400">
            {SESSION_MODE_LABELS[session.mode as SessionMode] ?? session.mode} · {session.players}{' '}
            {session.players === 1 ? 'jogador' : 'jogadores'} · {totalKills(tally.counts)} kills nesta partida
          </p>
        </div>
        <span aria-live="polite" className={`text-xs ${saveStatus === 'error' ? 'text-red-400' : 'text-zinc-500'}`}>
          {saveStatus === 'pending' || saveStatus === 'saving'
            ? 'A guardar…'
            : saveStatus === 'saved'
              ? 'Guardado'
              : saveStatus === 'error'
                ? 'Erro ao guardar'
                : ''}
        </span>
      </header>

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-zinc-500 uppercase">Arma ativa</p>
            <p className="truncate text-xl font-semibold">{active?.name ?? 'Nenhuma'}</p>
          </div>
          <button type="button" onClick={() => setChoosing((c) => !c)} className="btn-secondary shrink-0 px-3 py-2">
            {choosing ? 'Fechar' : 'Trocar arma'}
          </button>
        </div>
        {choosing && (
          <WeaponChooser
            data={data}
            activeId={tally.activeWeaponId}
            extraIds={usedIds}
            onPick={(id) => {
              dispatch({ type: 'switch', weaponId: id });
              setChoosing(false);
            }}
          />
        )}
        {active && <ProjectionView weaponId={active.id} data={data} session={activeCounts} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!active}
          onClick={() => dispatch({ type: 'tap', kind: 'kill' })}
          className="flex h-36 flex-col items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg transition-transform select-none active:scale-95 active:bg-emerald-500 disabled:opacity-40 sm:h-44"
        >
          <span className="text-2xl font-black sm:text-3xl">+1 KILL</span>
          <span className="mt-1 text-sm text-emerald-100 tabular-nums">{activeCounts.kills} nesta partida</span>
        </button>
        <button
          type="button"
          disabled={!active}
          onClick={() => dispatch({ type: 'tap', kind: 'headshot' })}
          className="flex h-36 flex-col items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg transition-transform select-none active:scale-95 active:bg-sky-500 disabled:opacity-40 sm:h-44"
        >
          <span className="px-2 text-center text-2xl leading-tight font-black sm:text-3xl">+1 HEADSHOT</span>
          <span className="mt-1 text-sm text-sky-100 tabular-nums">{activeCounts.headshots} nesta partida</span>
        </button>
      </div>
      <p className="text-center text-xs text-zinc-500">Um headshot conta também como kill.</p>

      <button
        type="button"
        disabled={tally.history.length === 0}
        onClick={() => dispatch({ type: 'undo' })}
        className="btn-secondary w-full py-3"
      >
        Desfazer último toque
      </button>

      {usedIds.length > 1 && (
        <ul className="card divide-y divide-zinc-800 text-sm">
          {usedIds.map((id) => (
            <li key={id} className="flex justify-between px-4 py-2">
              <span className={id === tally.activeWeaponId ? 'font-medium text-emerald-300' : ''}>
                {data.weaponsById.get(id)?.name ?? id}
              </span>
              <span className="text-zinc-400 tabular-nums">
                {tally.counts[id]!.kills} kills · {tally.counts[id]!.headshots} HS
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={() => setFinishing(true)} className="btn-primary flex-1 py-3 text-base">
          Terminar partida
        </button>
      </div>
      <details className="text-xs text-zinc-500">
        <summary className="cursor-pointer">Descartar esta partida</summary>
        <div className="mt-2 space-y-2">
          <p>Apaga a partida e as contagens; o progresso de camos não muda.</p>
          <button
            type="button"
            disabled={discard.isPending}
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              discard.mutate(session.id, { onSuccess: onDiscarded });
            }}
            className="btn-secondary border-red-800 px-3 py-1.5 text-red-300"
          >
            {discard.isPending ? 'A descartar…' : 'Descartar partida'}
          </button>
        </div>
      </details>
    </section>
  );
}

function ProjectionView({
  weaponId,
  data,
  session,
}: {
  weaponId: string;
  data: CamoData;
  session: { kills: number; headshots: number };
}) {
  const p = projectNextCamo(weaponId, data.camos, data.index, session);
  switch (p.kind) {
    case 'complete':
      return <p className="text-sm text-emerald-400">Esta arma já tem todos os camos.</p>;
    case 'mastery':
      return <p className="text-sm text-zinc-400">Próximo: {p.camo.name} (mastery, desbloqueia sozinho).</p>;
    case 'unknown':
      return (
        <p className="text-sm text-zinc-400">
          Próximo: {p.camo.name} · <span className="text-amber-300">requisito por confirmar</span>.{' '}
          <Link to={`/camos/${weaponId}`} className="underline hover:text-zinc-200">
            Preencher
          </Link>
        </p>
      );
    case 'measurable':
      return (
        <div className="space-y-1.5">
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span>
              Próximo: <span className="font-medium">{p.camo.name}</span>
            </span>
            <span className="text-zinc-400 tabular-nums">
              {p.projected} / {p.target} {requirementUnit(p.camo.requirement_type)}
            </span>
          </p>
          {/* Duas camadas: o gravado (escuro) e a projeção com esta partida (claro). */}
          <div
            role="progressbar"
            aria-label={`Progresso projetado de ${p.camo.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(p.projectedFraction * 100)}
            className="relative h-3 overflow-hidden rounded-full bg-zinc-800"
          >
            <div className="absolute inset-y-0 left-0 bg-emerald-400/50" style={{ width: `${p.projectedFraction * 100}%` }} />
            <div className="absolute inset-y-0 left-0 bg-emerald-600" style={{ width: `${p.savedFraction * 100}%` }} />
          </div>
          {p.unlocksOnFinish ? (
            <p className="text-sm font-semibold text-emerald-300">Desbloqueado ao terminar a partida</p>
          ) : (
            <p className="text-xs text-zinc-500">
              Faltam {p.target - p.projected} · {p.session} nesta partida
            </p>
          )}
        </div>
      );
  }
}

// ---------------------------------------------------------------- Terminar

function FinishForm({
  mapName,
  tally,
  data,
  persist,
  sessionId,
  onBack,
  onFinished,
}: {
  mapName: string;
  tally: TallyState;
  data: CamoData;
  persist: () => Promise<void>;
  sessionId: string;
  onBack: () => void;
  onFinished: (result: { round: number; kills: number; unlocked: UnlockedCamo[] }) => void;
}) {
  const finish = useFinishLiveSession();
  const [round, setRound] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stats = tallyToStats(tally.counts).filter((s) => s.kills > 0 || s.headshots > 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(round);
    if (!round.trim() || !Number.isInteger(parsed) || parsed < 0) {
      setError('Indica a ronda alcançada (número inteiro).');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await persist(); // garantir que as últimas contagens estão gravadas antes de terminar
      const unlocked = await finish.mutateAsync({ sessionId, round: parsed });
      onFinished({ round: parsed, kills: totalKills(tally.counts), unlocked });
    } catch (e) {
      setError(describeError(e));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Terminar partida</h1>
      <p className="text-sm text-zinc-400">{mapName}</p>
      <label className="block text-sm text-zinc-300">
        Ronda alcançada
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          autoFocus
          value={round}
          onChange={(e) => setRound(e.target.value)}
          className="input mt-1 py-3 text-lg"
        />
      </label>
      <div className="card p-4">
        <p className="mb-2 text-sm font-medium text-zinc-300">Resumo</p>
        {stats.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem kills registadas nesta partida.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {stats.map((s) => (
              <li key={s.weapon_id} className="flex justify-between">
                <span>{data.weaponsById.get(s.weapon_id)?.name ?? s.weapon_id}</span>
                <span className="text-zinc-400 tabular-nums">
                  {s.kills} kills · {s.headshots} HS
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onBack} disabled={saving} className="btn-secondary flex-1 py-3">
          Voltar
        </button>
        <button type="submit" disabled={saving} className="btn-primary flex-1 py-3 text-base">
          {saving ? 'A gravar…' : 'Gravar partida'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Fim

function DoneScreen({
  phase,
  data,
  onNew,
}: {
  phase: Extract<Phase, { kind: 'done' }>;
  data: CamoData;
  onNew: () => void;
}) {
  const { enqueue } = useUnlockAnimations();
  const shown = useRef(false);
  const camoName = (id: string) => data.catalogCamos.find((c) => c.id === id)?.name ?? id;

  // As animações só correm depois de gravar, uma vez.
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    enqueue(
      phase.unlocked.map((u) => ({
        camoId: u.camo_id,
        title: camoName(u.camo_id),
        subtitle: data.weaponsById.get(u.weapon_id)?.name ?? u.weapon_id,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre uma vez, ao mostrar o resultado
  }, []);

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Partida gravada</h1>
      <div className="card space-y-2 p-4">
        <p>
          {phase.mapName} · ronda {phase.round} · {phase.kills} kills
        </p>
        {phase.unlocked.length > 0 ? (
          <>
            <p className="text-sm font-medium text-emerald-300">Camos desbloqueados:</p>
            <ul className="text-sm text-zinc-300">
              {phase.unlocked.map((u) => (
                <li key={`${u.weapon_id}:${u.camo_id}`}>
                  {data.weaponsById.get(u.weapon_id)?.name ?? u.weapon_id} · {camoName(u.camo_id)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-zinc-400">Nenhum camo novo desta vez.</p>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onNew} className="btn-primary flex-1 py-3">
          Nova partida
        </button>
        <Link to="/sessions" className="btn-secondary flex-1 py-3">
          Ver histórico
        </Link>
      </div>
    </section>
  );
}
