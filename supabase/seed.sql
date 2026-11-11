-- Gerado por `pnpm seed` a partir de packages/game-data. NÃO EDITAR À MÃO.
begin;
insert into public.maps (id, name, storyline, release_order, is_dlc) values
  ('ix', 'IX', 'chaos', 1, false),
  ('voyage-of-despair', 'Voyage of Despair', 'chaos', 2, false),
  ('blood-of-the-dead', 'Blood of the Dead', 'aether', 3, false),
  ('classified', 'Classified', 'aether', 4, false),
  ('dead-of-the-night', 'Dead of the Night', 'chaos', 5, true),
  ('ancient-evil', 'Ancient Evil', 'chaos', 6, true),
  ('alpha-omega', 'Alpha Omega', 'aether', 7, true),
  ('tag-der-toten', 'Tag der Toten', 'aether', 8, true)
on conflict (id) do update set
  name = excluded.name,
  storyline = excluded.storyline,
  release_order = excluded.release_order,
  is_dlc = excluded.is_dlc;

insert into public.weapons (id, name, weapon_class, source) values
  ('mx9', 'MX9', 'smg', 'base'),
  ('saug-9mm', 'Saug 9mm', 'smg', 'base'),
  ('spitfire', 'Spitfire', 'smg', 'base'),
  ('cordite', 'Cordite', 'smg', 'base'),
  ('gks', 'GKS', 'smg', 'base'),
  ('icr-7', 'ICR-7', 'ar', 'base'),
  ('kn-57', 'KN-57', 'ar', 'base'),
  ('maddox-rfb', 'Maddox RFB', 'ar', 'base'),
  ('rampart-17', 'Rampart 17', 'ar', 'base'),
  ('vapr-xkg', 'Vapr-XKG', 'ar', 'base'),
  ('abr-223', 'ABR 223', 'tactical', 'base'),
  ('auger-dmr', 'Auger DMR', 'tactical', 'base'),
  ('swordfish', 'Swordfish', 'tactical', 'base'),
  ('titan', 'Titan', 'lmg', 'base'),
  ('vkm-750', 'VKM 750', 'lmg', 'base'),
  ('hades', 'Hades', 'lmg', 'base'),
  ('paladin-hb50', 'Paladin HB50', 'sniper', 'base'),
  ('outlaw', 'Outlaw', 'sniper', 'base'),
  ('sdm', 'SDM', 'sniper', 'base'),
  ('koshka', 'Koshka', 'sniper', 'base'),
  ('rk-7-garrison', 'RK 7 Garrison', 'pistol', 'base'),
  ('mozu', 'Mozu', 'pistol', 'base'),
  ('strife', 'Strife', 'pistol', 'base'),
  ('mog-12', 'MOG 12', 'shotgun', 'base'),
  ('sg12', 'SG12', 'shotgun', 'base'),
  ('hellion-salvo', 'Hellion Salvo', 'launcher', 'base')
on conflict (id) do update set
  name = excluded.name,
  weapon_class = excluded.weapon_class,
  source = excluded.source;

insert into public.camos (id, name, tier, kind, requirement_type, requirement_value, requirement_text, verified) values
  ('overgrowth', 'Overgrowth', 1, 'zombies', 'kills', null, 'Por confirmar no jogo', false),
  ('tundra', 'Tundra', 2, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('rend', 'Rend', 3, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('tropic', 'Tropic', 4, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('roil', 'Roil', 5, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('mangrove', 'Mangrove', 6, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('clash', 'Clash', 7, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('dune', 'Dune', 8, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('green-tiger', 'Green Tiger', 9, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('gutter-ball', 'Gutter Ball', 10, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('spore', 'Spore', 11, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('red-hex-redux', 'Red Hex Redux', 12, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('emerald-ug', 'Emerald UG', 13, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('silverfish', 'Silverfish', 14, 'zombies', 'unknown', null, 'Por confirmar no jogo', false),
  ('gold', 'Gold', 15, 'mastery', 'prereq_all', null, 'Desbloquear todos os camos anteriores da arma (confirmar)', false),
  ('diamond', 'Diamond', 16, 'mastery', 'prereq_all', null, 'Desbloquear todos os camos anteriores da arma (confirmar)', false),
  ('dark-matter', 'Dark Matter', 17, 'mastery', 'prereq_all', null, 'Desbloquear todos os camos anteriores da arma (confirmar)', false)
on conflict (id) do update set
  name = excluded.name,
  tier = excluded.tier,
  kind = excluded.kind,
  requirement_type = excluded.requirement_type,
  requirement_value = excluded.requirement_value,
  requirement_text = excluded.requirement_text,
  verified = excluded.verified;

insert into public.easter_eggs (id, map_id, name, type, min_players, max_players, verified) values
  ('ix-main', 'ix', 'IX — Main Quest', 'main', null, null, false),
  ('voyage-of-despair-main', 'voyage-of-despair', 'Voyage of Despair — Main Quest', 'main', null, null, false),
  ('blood-of-the-dead-main', 'blood-of-the-dead', 'Blood of the Dead — Main Quest', 'main', null, null, false),
  ('dead-of-the-night-main', 'dead-of-the-night', 'Dead of the Night — Main Quest', 'main', null, null, false),
  ('ancient-evil-main', 'ancient-evil', 'Ancient Evil — Main Quest', 'main', null, null, false),
  ('alpha-omega-main', 'alpha-omega', 'Alpha Omega — Main Quest', 'main', null, null, false),
  ('tag-der-toten-main', 'tag-der-toten', 'Tag der Toten — Main Quest', 'main', null, null, false)
on conflict (id) do update set
  map_id = excluded.map_id,
  name = excluded.name,
  type = excluded.type,
  min_players = excluded.min_players,
  max_players = excluded.max_players,
  verified = excluded.verified;

-- Passos que deixaram de existir no JSON (o progresso desses passos é apagado em cascata).
delete from public.easter_egg_steps
where easter_egg_id = any(array['ix-main', 'voyage-of-despair-main', 'blood-of-the-dead-main', 'dead-of-the-night-main', 'ancient-evil-main', 'alpha-omega-main', 'tag-der-toten-main'])
  and not (id = any('{}'::text[]));

-- easter_egg_steps: sem linhas

-- challenges: sem linhas

commit;
