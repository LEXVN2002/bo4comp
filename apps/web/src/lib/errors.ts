interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

/** Mensagem legível (pt-PT) para erros do Supabase/Postgres ou de rede. */
export function describeError(error: unknown): string {
  if (!error) return 'Erro desconhecido.';
  const e = error as ErrorLike;
  const code = typeof e.code === 'string' ? e.code : undefined;
  const message = typeof e.message === 'string' ? e.message : String(error);

  if (code === '42501') return 'Sem permissão. A tua sessão pode ter expirado: volta a entrar.';
  if (code === '23503') return 'Referência inválida (mapa ou arma inexistente no catálogo).';
  if (code === '23514') return 'Valor fora dos limites permitidos.';
  if (code === 'over_email_send_rate_limit' || e.status === 429) {
    return 'Demasiados pedidos. Espera um pouco antes de tentar de novo.';
  }
  if (message === 'Failed to fetch' || message.includes('NetworkError')) {
    return 'Sem ligação ao servidor. Verifica a tua ligação à internet.';
  }
  return message;
}
