// Agua del día: cada toque guarda un registro (un vaso = 250 ml; quitar un vaso guarda −250)
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Perfil } from '../logic/energia';

export const VASO = 250;
// Meta: la que escogió, o 35 ml por kilo redondeado a vasos
export const metaAgua = (p: Pick<Perfil, 'aguaMeta' | 'peso'>) => p.aguaMeta ?? Math.round((35 * p.peso) / VASO) * VASO;
export const litros = (ml: number) => (Math.round(ml / 100) / 10).toLocaleString('es-CO');

export function useAgua(perfilId: string | undefined, fecha: string) {
  const [ml, setMl] = useState<number | null>(null);
  const cargar = useCallback(async () => {
    if (!perfilId) return;
    const { data } = await supabase.from('agua').select('ml').eq('perfil_id', perfilId).eq('fecha', fecha);
    setMl(Math.max(0, (data ?? []).reduce((t, r) => t + r.ml, 0)));
  }, [perfilId, fecha]);
  useEffect(() => { setMl(null); cargar(); }, [cargar]);
  const sumar = useCallback(async (cuanto: number) => {
    if (!perfilId) return;
    setMl(v => Math.max(0, (v ?? 0) + cuanto)); // se ve al instante
    const { error } = await supabase.from('agua').insert({ perfil_id: perfilId, fecha, ml: cuanto });
    if (error) cargar();
  }, [perfilId, fecha, cargar]);
  return { ml, sumar };
}

// Agua por día en un rango (Semana y Personalizado)
export async function aguaPorDia(perfilId: string, desde: string, hasta: string) {
  const { data } = await supabase.from('agua').select('fecha, ml').eq('perfil_id', perfilId).gte('fecha', desde).lte('fecha', hasta);
  const m = new Map<string, number>();
  for (const r of data ?? []) m.set(r.fecha, (m.get(r.fecha) ?? 0) + r.ml);
  return m;
}
