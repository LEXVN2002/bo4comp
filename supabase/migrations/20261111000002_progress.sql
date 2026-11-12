-- Progresso do utilizador. Só guarda ids (slugs) do catálogo, nunca texto.
-- user_id tem default auth.uid() para o cliente não ter de o enviar;
-- o RLS (migração seguinte) garante que só é possível escrever o próprio.

create table public.weapon_camo_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weapon_id text not null references public.weapons (id),
  camo_id text not null references public.camos (id),
  current_count int not null default 0 check (current_count >= 0),
  unlocked_at timestamptz,
  primary key (user_id, weapon_id, camo_id)
);

create table public.easter_egg_step_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- on delete cascade: quando o seed remove um passo, o progresso desse passo desaparece.
  step_id text not null references public.easter_egg_steps (id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (user_id, step_id)
);

create table public.easter_egg_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  easter_egg_id text not null references public.easter_eggs (id),
  completed_at timestamptz not null default now(),
  players int check (players between 1 and 4),
  notes text
);

create index easter_egg_completions_user_idx on public.easter_egg_completions (user_id, easter_egg_id);

create table public.challenge_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  challenge_id text not null references public.challenges (id),
  current_count int not null default 0 check (current_count >= 0),
  completed_at timestamptz,
  primary key (user_id, challenge_id)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  map_id text not null references public.maps (id),
  played_at timestamptz not null default now(),
  round_reached int not null check (round_reached >= 0),
  mode text not null default 'normal' check (mode in (
    'casual', 'normal', 'hardcore', 'realistic', 'rush', 'gauntlet'
  )),
  players int not null default 1 check (players between 1 and 4),
  source text not null default 'manual' check (source in ('manual', 'api', 'ocr')),
  notes text
);

create index sessions_user_played_idx on public.sessions (user_id, played_at desc);
create index sessions_user_map_idx on public.sessions (user_id, map_id);

create table public.session_weapon_stats (
  session_id uuid not null references public.sessions (id) on delete cascade,
  weapon_id text not null references public.weapons (id),
  kills int not null default 0 check (kills >= 0),
  headshots int not null default 0 check (headshots >= 0),
  primary key (session_id, weapon_id)
);
