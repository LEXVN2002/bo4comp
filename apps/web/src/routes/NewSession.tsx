import { SESSION_MODES } from '@bo4/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorMessage, Loading } from '../components/QueryState';
import { useCatalog } from '../features/catalog/queries';
import { useLastSession, useRecordSession } from '../features/sessions/queries';
import { emptySessionValues, SessionForm } from '../features/sessions/SessionForm';

export default function NewSession() {
  const catalog = useCatalog();
  const last = useLastSession();
  const record = useRecordSession();
  const [saved, setSaved] = useState<{ map: string; round: number } | null>(null);

  if (catalog.isPending || last.isPending) return <Loading />;
  if (catalog.isError) return <ErrorMessage error={catalog.error} onRetry={() => catalog.refetch()} />;
  if (last.isError) return <ErrorMessage error={last.error} onRetry={() => last.refetch()} />;

  // O SessionForm só lê os valores iniciais ao montar; refetches da última sessão não o afetam.
  const initialValues = emptySessionValues({
    mapId: last.data?.map_id ?? catalog.data.maps[0]?.id ?? '',
    mode: SESSION_MODES.find((m) => m === last.data?.mode) ?? 'normal',
    players: String(last.data?.players ?? 1),
  });

  const mapName = (id: string) => catalog.data.maps.find((m) => m.id === id)?.name ?? id;

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Registar sessão</h1>

      {saved && (
        <div role="status" className="rounded-md border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-100">
          Sessão gravada: {saved.map}, ronda {saved.round}. Os contadores de camos foram atualizados.{' '}
          <Link to="/camos" className="text-emerald-300 underline underline-offset-2">
            Ver camos
          </Link>
        </div>
      )}

      <SessionForm
        catalog={catalog.data}
        initialValues={initialValues}
        submitLabel="Gravar sessão"
        pendingLabel="A gravar…"
        resetOnSuccess
        onEdit={() => setSaved(null)}
        onSubmit={async (payload) => {
          await record.mutateAsync(payload);
          setSaved({ map: mapName(payload.p_map_id), round: payload.p_round_reached });
        }}
      />
    </section>
  );
}
