-- Guias passo a passo: secções nos passos e links para as fontes de cada easter egg.
alter table public.easter_egg_steps
  add column section text check (section is null or length(trim(section)) > 0);

alter table public.easter_eggs
  add column sources text[] not null default '{}'
    check (array_position(sources, null) is null);
