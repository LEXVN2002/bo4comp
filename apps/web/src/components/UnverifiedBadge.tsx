/** Selo "por confirmar" para dados de catálogo com verified: false. */
export function UnverifiedBadge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        title="Por confirmar"
        aria-label="Por confirmar"
        className="inline-block size-1.5 shrink-0 rounded-full bg-amber-400"
      />
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-amber-700/60 bg-amber-950/50 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      por confirmar
    </span>
  );
}
