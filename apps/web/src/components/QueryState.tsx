import { describeError } from '../lib/errors';

export function Loading({ label = 'A carregar…' }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-sm text-zinc-400">
      {label}
    </p>
  );
}

export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
      <p>Não foi possível carregar os dados: {describeError(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 underline underline-offset-2">
          Tentar de novo
        </button>
      )}
    </div>
  );
}
