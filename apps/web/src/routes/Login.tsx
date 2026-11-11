import { useState, type FormEvent } from 'react';
import { describeError } from '../lib/errors';
import { getSupabase } from '../lib/supabase';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus({ kind: 'sending' });
    const { error } = await getSupabase().auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setStatus(error ? { kind: 'error', message: describeError(error) } : { kind: 'sent', email: trimmed });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        <span className="text-emerald-400">BO4 Zombies</span> Companion
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Entra com o teu email. Enviamos-te um link de acesso, sem password.
      </p>

      {status.kind === 'sent' ? (
        <div className="mt-6 rounded-md border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-100">
          <p>
            Enviámos um link de acesso para <strong>{status.email}</strong>. Abre-o neste
            dispositivo para entrar.
          </p>
          {import.meta.env.DEV && (
            <p className="mt-2 text-emerald-300/80">
              Em desenvolvimento, os emails ficam no Mailpit:{' '}
              <a className="underline" href="http://127.0.0.1:55424" target="_blank" rel="noreferrer">
                127.0.0.1:55424
              </a>
            </p>
          )}
          <button
            type="button"
            onClick={() => setStatus({ kind: 'idle' })}
            className="mt-3 text-emerald-300 underline-offset-2 hover:underline"
          >
            Usar outro email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="text-zinc-300">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
              placeholder="nome@exemplo.com"
            />
          </label>
          <button type="submit" disabled={status.kind === 'sending'} className="btn-primary w-full">
            {status.kind === 'sending' ? 'A enviar…' : 'Enviar link de acesso'}
          </button>
          {status.kind === 'error' && (
            <p role="alert" className="text-sm text-red-400">
              {status.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
