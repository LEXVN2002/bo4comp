import { fileURLToPath } from 'node:url';

export const SEED_SQL_PATH = fileURLToPath(new URL('../../../supabase/seed.sql', import.meta.url));
