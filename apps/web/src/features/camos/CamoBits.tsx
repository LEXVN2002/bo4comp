// Peças visuais pequenas da aba de camos: padrão do camo, alfinete, selo e notas.
import type { CamoDisplayState } from '../../lib/progress';
import { autosaveLabel, useAutosave } from '../../lib/useAutosave';
import { camoPattern } from './camoPattern';

export function CamoSwatch({
  camoId,
  state,
  fraction,
  className = '',
}: {
  camoId: string;
  state: CamoDisplayState;
  /** 0..1 quando o requisito é conhecido. */
  fraction: number | null;
  className?: string;
}) {
  const pattern = camoPattern(camoId);
  return (
    <span
      aria-hidden
      className={`relative block overflow-hidden rounded-md ${
        state === 'done'
          ? 'shadow-[0_0_14px_rgba(52,211,153,0.55)] ring-2 ring-emerald-400'
          : 'ring-1 ring-zinc-700'
      } ${className}`}
    >
      <span
        className={`absolute inset-0 ${state === 'locked' ? 'opacity-25 grayscale' : state === 'in_progress' ? 'opacity-70' : ''}`}
        style={pattern.style}
      />
      {state === 'locked' && (
        <span className="absolute inset-0 flex items-center justify-center text-zinc-300">
          <LockIcon className="size-5" />
        </span>
      )}
      {state === 'done' && (
        <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-zinc-950">
          ✓
        </span>
      )}
      {state === 'in_progress' && fraction !== null && fraction > 0 && (
        <span className="absolute inset-x-0 bottom-0 h-1.5 bg-zinc-950/70">
          <span className="block h-full bg-emerald-400" style={{ width: `${Math.min(fraction, 1) * 100}%` }} />
        </span>
      )}
    </span>
  );
}

export function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 1.5a4 4 0 0 0-4 4V8H5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-1V5.5a4 4 0 0 0-4-4Zm2.5 6.5V5.5a2.5 2.5 0 0 0-5 0V8h5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PinIcon({ filled, className = '' }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 3h6l-1 6 4 4v2h-5v6l-1 1-1-1v-6H6v-2l4-4-1-6Z" />
    </svg>
  );
}

export function PinButton({
  pinned,
  weaponName,
  onToggle,
  className = '',
}: {
  pinned: boolean;
  weaponName: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pinned}
      aria-label={pinned ? `Desafixar ${weaponName}` : `Afixar ${weaponName}`}
      title={pinned ? 'Desafixar' : 'Afixar'}
      className={`rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
        pinned ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-500 hover:text-zinc-200'
      } ${className}`}
    >
      <PinIcon filled={pinned} className="size-5" />
    </button>
  );
}

export function CompleteSeal({ label = 'Todos os camos' }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)]">
      ★ {label}
    </span>
  );
}

/** Caixa de notas com gravação automática (800 ms depois de parar de escrever). */
export function NotesField({
  id,
  label,
  initial,
  onSave,
  placeholder,
}: {
  id: string;
  label: string;
  initial: string;
  onSave: (body: string) => Promise<unknown>;
  placeholder?: string;
}) {
  const notes = useAutosave(initial, onSave, 800);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-zinc-300">
          {label}
        </label>
        <span
          aria-live="polite"
          className={`text-xs ${notes.status === 'error' ? 'text-red-400' : 'text-zinc-500'}`}
        >
          {autosaveLabel(notes.status)}
        </span>
      </div>
      <textarea
        id={id}
        value={notes.value}
        onChange={(e) => notes.onChange(e.target.value)}
        onBlur={notes.flush}
        rows={3}
        maxLength={5000}
        placeholder={placeholder}
        className="input resize-y"
      />
    </div>
  );
}
