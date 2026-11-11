import { NavLink, Outlet } from 'react-router';
import { isSupabaseConfigured } from '../lib/supabase';

const NAV = [
  { to: '/', label: 'Painel', end: true },
  { to: '/camos', label: 'Camos', end: false },
  { to: '/easter-eggs', label: 'Easter eggs', end: false },
  { to: '/sessions/new', label: 'Registar sessão', end: true },
  { to: '/sessions', label: 'Histórico', end: true },
];

export function Layout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-3">
          <span className="mr-3 shrink-0 font-semibold text-emerald-400">BO4 Zombies</span>
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
        {!isSupabaseConfigured && (
          <p className="mb-6 rounded-md border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-200">
            Supabase não configurado. Copia <code>apps/web/.env.example</code> para{' '}
            <code>apps/web/.env.local</code> e preenche os valores.
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
