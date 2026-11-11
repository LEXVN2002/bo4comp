import { useQuery } from '@tanstack/react-query';
import type { Tables } from '../../lib/database.types';
import { getSupabase } from '../../lib/supabase';

export type MapRow = Tables<'maps'>;
export type WeaponRow = Tables<'weapons'>;
export type CamoRow = Tables<'camos'>;

export interface Catalog {
  maps: MapRow[];
  weapons: WeaponRow[];
  camos: CamoRow[];
  weaponsById: Map<string, WeaponRow>;
}

async function fetchCatalog(): Promise<Catalog> {
  const supabase = getSupabase();
  const [maps, weapons, camos] = await Promise.all([
    supabase.from('maps').select('*').order('release_order'),
    supabase.from('weapons').select('*').order('name'),
    supabase.from('camos').select('*').order('tier'),
  ]);
  if (maps.error) throw maps.error;
  if (weapons.error) throw weapons.error;
  if (camos.error) throw camos.error;
  return {
    maps: maps.data,
    weapons: weapons.data,
    camos: camos.data,
    weaponsById: new Map(weapons.data.map((w) => [w.id, w])),
  };
}

/** Catálogo do jogo (mapas, armas, camos). Muda só quando o seed é reaplicado. */
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: Infinity,
  });
}
