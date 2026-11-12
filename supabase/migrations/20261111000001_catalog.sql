-- Catálogo do jogo: só leitura para a app, preenchido por supabase/seed.sql
-- (gerado por `pnpm seed` a partir de packages/game-data).
-- Os check constraints espelham os enums de packages/game-data/schemas.ts.

create table public.maps (
  id text primary key,             -- slug: 'ix', 'voyage-of-despair'
  name text not null,
  storyline text not null check (storyline in ('chaos', 'aether')),
  release_order int not null unique check (release_order > 0),
  is_dlc boolean not null default false
);

create table public.weapons (
  id text primary key,             -- slug: 'saug-9mm'
  name text not null,
  weapon_class text not null check (weapon_class in (
    'smg', 'ar', 'tactical', 'lmg', 'sniper', 'pistol', 'shotgun', 'launcher', 'melee', 'special'
  )),
  source text not null default 'base' check (source in ('base', 'dlc', 'reserves'))
);

create table public.camos (
  id text primary key,             -- slug: 'overgrowth'
  name text not null,
  tier int not null unique check (tier > 0),  -- ordem de desbloqueio
  kind text not null check (kind in ('zombies', 'mastery', 'reactive')),
  -- 'unknown' = requisito por confirmar; nunca desbloqueia sozinho.
  requirement_type text not null check (requirement_type in ('kills', 'headshots', 'prereq_all', 'unknown')),
  requirement_value int check (requirement_value > 0),  -- null quando ainda não confirmado
  requirement_text text not null,
  verified boolean not null default false,
  constraint camos_value_only_for_counters check (
    requirement_value is null or requirement_type in ('kills', 'headshots')
  )
);

create table public.easter_eggs (
  id text primary key,
  map_id text not null references public.maps (id),
  name text not null,
  type text not null check (type in ('main', 'side', 'song', 'music', 'other')),
  min_players int check (min_players between 1 and 4),
  max_players int check (max_players between 1 and 4),
  verified boolean not null default false,
  constraint easter_eggs_players_range check (
    min_players is null or max_players is null or min_players <= max_players
  )
);

create index easter_eggs_map_id_idx on public.easter_eggs (map_id);

create table public.easter_egg_steps (
  id text primary key,             -- '<easter_egg_id>-<step_order>'
  easter_egg_id text not null references public.easter_eggs (id) on delete cascade,
  step_order int not null check (step_order > 0),
  title text not null,
  details text,
  unique (easter_egg_id, step_order)
);

create table public.challenges (
  id text primary key,
  map_id text references public.maps (id), -- null = desafio global
  name text not null,
  description text not null,
  target int not null default 1 check (target > 0)
);

create index challenges_map_id_idx on public.challenges (map_id);
