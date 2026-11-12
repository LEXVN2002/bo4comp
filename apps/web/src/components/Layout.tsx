import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';
import { ClassSealWatcher } from '../features/camos/ClassSeals';
import { UnlockAnimationsProvider } from '../features/unlocks/UnlockAnimations';

const NAV = [
  { to: '/', label: 'Painel', end: true },
  { to: '/grind', label: 'Grind', end: true },
  { to: '/camos', label: 'Camos', end: false },
  { to: '/easter-eggs', label: 'Easter eggs', end: false },
  { to: '/sessions/new', label: 'Registar sessão', end: true },
  { to: '/sessions', label: 'Histórico', end: true },
];

export function Layout() {
  const { session, signOut } = useAuth();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3">
          <span className="font-semibold text-emerald-400">BO4 Zombies</span>
          <span className="ml-auto truncate text-xs text-zinc-500" title={session?.user.email}>
            {session?.user.email}
          </span>
          <Link to="/settings" className="shrink-0 text-xs text-zinc-400 hover:text-zinc-100">
            Definições
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="shrink-0 text-xs text-zinc-400 hover:text-zinc-100"
          >
            Sair
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <UnlockAnimationsProvider>
          <ClassSealWatcher />
          <Outlet />
        </UnlockAnimationsProvider>
      </main>
    </div>
  );
}
