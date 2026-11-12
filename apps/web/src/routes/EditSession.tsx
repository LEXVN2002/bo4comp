import { Link, useNavigate, useParams } from 'react-router';
import { ErrorMessage, Loading } from '../components/QueryState';
import { useCatalog } from '../features/catalog/queries';
import { useSession, useUpdateSession } from '../features/sessions/queries';
import { SessionForm, sessionToFormValues } from '../features/sessions/SessionForm';
import { formatDateTime } from '../lib/format';

export default function EditSession() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const session = useSession(sessionId);
  const update = useUpdateSession();

  if (catalog.isPending || session.isPending) return <Loading />;
  if (catalog.isError) return <ErrorMessage error={catalog.error} onRetry={() => catalog.refetch()} />;
  if (session.isError) return <ErrorMessage error={session.error} onRetry={() => session.refetch()} />;

  if (!session.data) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Sessão não encontrada</h1>
        <Link to="/sessions" className="text-emerald-400 hover:underline">
          Voltar ao histórico
        </Link>
      </section>
    );
  }

  const current = session.data;

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <header>
        <Link to="/sessions" className="text-sm text-zinc-400 hover:text-emerald-400">
          ← Histórico
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Editar sessão</h1>
        <p className="text-sm text-zinc-400">
          Jogada em {formatDateTime(current.played_at)}. Ao gravar, as kills e headshots antigas
          são descontadas dos camos ainda bloqueados e as novas são somadas.
        </p>
      </header>

      <SessionForm
        key={current.id}
        catalog={catalog.data}
        initialValues={sessionToFormValues(current)}
        submitLabel="Gravar alterações"
        pendingLabel="A gravar…"
        onSubmit={async (payload) => {
          await update.mutateAsync({ sessionId: current.id, payload });
          navigate('/sessions', { state: { flash: 'Sessão atualizada.' } });
        }}
        footer={
          <Link to="/sessions" className="text-sm text-zinc-400 hover:text-zinc-100">
            Cancelar
          </Link>
        }
      />
    </section>
  );
}
