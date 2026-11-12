import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './components/Layout';
import { Loading } from './components/QueryState';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import { isSupabaseConfigured } from './lib/supabase';
import Camos from './routes/Camos';
import Dashboard from './routes/Dashboard';
import EditSession from './routes/EditSession';
import EasterEggs from './routes/EasterEggs';
import Login from './routes/Login';
import NewSession from './routes/NewSession';
import NotFound from './routes/NotFound';
import Sessions from './routes/Sessions';
import Settings from './routes/Settings';
import Weapon from './routes/Weapon';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/camos', element: <Camos /> },
      { path: '/camos/:weaponId', element: <Weapon /> },
      { path: '/easter-eggs', element: <EasterEggs /> },
      { path: '/sessions/new', element: <NewSession /> },
      { path: '/sessions', element: <Sessions /> },
      { path: '/sessions/:sessionId/edit', element: <EditSession /> },
      { path: '/settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function AuthGate() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  // Sem sessão não há rotas: o RLS bloquearia todos os dados de qualquer forma.
  if (!session) return <Login />;
  return <RouterProvider router={router} />;
}

function ConfigMissing() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-sm">
      <h1 className="text-xl font-semibold">Supabase não configurado</h1>
      <p className="mt-2 text-zinc-400">
        Copia <code>apps/web/.env.example</code> para <code>apps/web/.env.local</code>, preenche{' '}
        <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> e reinicia o{' '}
        <code>pnpm dev</code>.
      </p>
    </div>
  );
}

export function App() {
  if (!isSupabaseConfigured) return <ConfigMissing />;
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
