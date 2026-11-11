import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true quando as variáveis do Supabase estão definidas em .env.local. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | undefined;

/**
 * Cliente Supabase do browser. Usa só a anon key: todo o acesso a dados
 * passa pelo RLS. A service_role key nunca pode ser usada aqui.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase não configurado: define VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em apps/web/.env.local',
    );
  }
  client ??= createClient(url, anonKey);
  return client;
}
