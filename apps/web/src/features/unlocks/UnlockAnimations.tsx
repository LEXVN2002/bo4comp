// Animação de desbloqueio em ecrã cheio, com fila (docs/CAMOS.md, secção 5).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { camoPattern } from '../camos/camoPattern';
import { DEFAULT_SETTINGS, useUserSettings } from '../grind/queries';

export interface UnlockItem {
  /** Define o padrão em CSS (o mesmo do camo). */
  camoId: string;
  title: string;
  subtitle: string;
  /** Texto grande; por defeito "CAMO DESBLOQUEADO" (os selos de classe usam "MASTERY DE CLASSE"). */
  label?: string;
}

interface UnlockContextValue {
  enqueue: (items: UnlockItem[]) => void;
}

const UnlockContext = createContext<UnlockContextValue>({ enqueue: () => {} });

export function useUnlockAnimations() {
  return useContext(UnlockContext);
}

export const UNLOCK_DURATION_MS = 2500;
const SOUND_URL = '/sounds/unlock.mp3';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Toca o som fornecido pelo utilizador; se o ficheiro não existir ou o browser recusar, fica em silêncio. */
function playUnlockSound(volume: number) {
  try {
    const audio = new Audio(SOUND_URL);
    audio.volume = Math.min(Math.max(volume, 0), 1);
    audio.addEventListener('error', () => {}, { once: true });
    void audio.play().catch(() => {});
  } catch {
    // Sem suporte de áudio: sem som e sem erro.
  }
}

export function UnlockAnimationsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<UnlockItem[]>([]);
  const settings = useUserSettings();
  const sound = settings.data ?? DEFAULT_SETTINGS;
  const current = queue[0];
  const [reduced] = useState(prefersReducedMotion);
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  });

  const enqueue = useCallback((items: UnlockItem[]) => {
    if (items.length > 0) setQueue((q) => [...q, ...items]);
  }, []);
  const next = useCallback(() => setQueue((q) => q.slice(1)), []);

  // Um de cada vez: som ao aparecer e avanço automático ao fim de ~2,5 s.
  useEffect(() => {
    if (!current) return;
    if (soundRef.current.sound_enabled) playUnlockSound(soundRef.current.sound_volume);
    const t = setTimeout(next, UNLOCK_DURATION_MS);
    return () => clearTimeout(t);
  }, [current, next]);

  const value = useMemo(() => ({ enqueue }), [enqueue]);

  return (
    <UnlockContext.Provider value={value}>
      {children}
      {current &&
        (reduced ? (
          <UnlockToast key={`${current.camoId}:${queue.length}`} item={current} onClose={next} />
        ) : (
          <UnlockOverlay key={`${current.camoId}:${queue.length}`} item={current} onClose={next} remaining={queue.length - 1} />
        ))}
    </UnlockContext.Provider>
  );
}

function UnlockOverlay({ item, onClose, remaining }: { item: UnlockItem; onClose: () => void; remaining: number }) {
  const pattern = camoPattern(item.camoId);
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={`${item.label ?? 'Camo desbloqueado'}: ${item.title}, ${item.subtitle}`}
      onClick={onClose}
      className="unlock-backdrop fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-6 bg-black/85 p-6 text-center"
    >
      <div className="unlock-swatch relative size-44 overflow-hidden rounded-2xl ring-4 ring-emerald-400 sm:size-56">
        <span className="absolute inset-0" style={pattern.style} />
      </div>
      <div className="unlock-text space-y-2">
        <p className="text-sm font-bold tracking-[0.3em] text-emerald-300">{item.label ?? 'CAMO DESBLOQUEADO'}</p>
        <p className="text-3xl font-bold text-white sm:text-4xl">{item.title}</p>
        <p className="text-lg text-zinc-300">{item.subtitle}</p>
      </div>
      <p className="text-xs text-zinc-500">
        Toca para fechar{remaining > 0 ? ` · mais ${remaining}` : ''}
      </p>
    </div>
  );
}

/** Com prefers-reduced-motion: só um aviso discreto, sem animação. */
function UnlockToast({ item, onClose }: { item: UnlockItem; onClose: () => void }) {
  return (
    <button
      type="button"
      role="status"
      onClick={onClose}
      className="fixed top-4 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-emerald-500/60 bg-zinc-900 px-4 py-2 text-sm font-semibold text-emerald-300"
    >
      {item.label ?? 'Camo desbloqueado'}: {item.title} · {item.subtitle}
    </button>
  );
}
