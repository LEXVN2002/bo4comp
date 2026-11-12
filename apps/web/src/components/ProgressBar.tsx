interface Props {
  /** 0..1 */
  value: number;
  label: string;
  className?: string;
}

export function ProgressBar({ value, label, className = '' }: Props) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`h-2 overflow-hidden rounded-full bg-zinc-800 ${className}`}
    >
      <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
