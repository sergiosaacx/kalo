import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type ComidaId = 'des' | 'alm' | 'cena' | 'snack';
export const COMIDAS: [ComidaId, string][] = [['des', 'Desayuno'], ['alm', 'Almuerzo'], ['cena', 'Cena'], ['snack', 'Snacks']];
export const nombreComida = (c: ComidaId) => COMIDAS.find(x => x[0] === c)?.[1] ?? '';

// Comida que toca según la hora
export function comidaDeAhora(d = new Date()): ComidaId {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 10.5) return 'des';
  if (h < 15) return 'alm';
  if (h < 17.5) return 'snack';
  return 'cena';
}

// Fecha local (Colombia) en YYYY-MM-DD
export const hoyISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface ItemPlan { id: string; alimento_id: string; cantidad: number; comido: boolean; comida: ComidaId }

// Plan de un día para un perfil: ítems por comida, con cambios guardados al instante
export function usePlanDia(perfilId: string | undefined, fecha = hoyISO()) {
  const [items, setItems] = useState<ItemPlan[] | null>(null);

  const cargar = useCallback(async () => {
    if (!perfilId) return;
    const { data } = await supabase.from('plan')
      .select('comida, plan_items(id, alimento_id, cantidad, comido, orden)')
      .eq('perfil_id', perfilId).eq('fecha', fecha);
    const lista: ItemPlan[] = [];
    for (const p of (data ?? []) as { comida: ComidaId; plan_items: (Omit<ItemPlan, 'comida'> & { orden: number })[] }[]) {
      for (const it of [...p.plan_items].sort((a, b) => a.orden - b.orden)) lista.push({ ...it, cantidad: Number(it.cantidad), comida: p.comida });
    }
    setItems(lista);
  }, [perfilId, fecha]);

  useEffect(() => { setItems(null); cargar(); }, [cargar]);

  const alternar = useCallback(async (id: string) => {
    let nuevo = false;
    setItems(xs => xs?.map(x => (x.id === id ? ((nuevo = !x.comido), { ...x, comido: nuevo }) : x)) ?? null);
    await supabase.from('plan_items').update({ comido: nuevo, comido_en: nuevo ? new Date().toISOString() : null }).eq('id', id);
  }, []);

  const quitar = useCallback(async (id: string) => {
    setItems(xs => xs?.filter(x => x.id !== id) ?? null);
    await supabase.from('plan_items').delete().eq('id', id);
  }, []);

  return { items, alternar, quitar, recargar: cargar };
}

// Agrega un alimento a una comida del día (crea la comida del plan si no existe)
export async function agregarAlPlan(perfilId: string, comida: ComidaId, alimentoId: string, cantidad: number, fecha = hoyISO()) {
  const { data: plan, error } = await supabase.from('plan')
    .upsert({ perfil_id: perfilId, fecha, comida }, { onConflict: 'perfil_id,fecha,comida' })
    .select('id').single();
  if (error || !plan) return 'No pudimos agregarlo. Revisa tu conexión e inténtalo de nuevo.';
  const { error: e2 } = await supabase.from('plan_items').insert({ plan_id: plan.id, alimento_id: alimentoId, cantidad, orden: Date.now() % 100000 });
  return e2 ? 'No pudimos agregarlo. Inténtalo de nuevo.' : null;
}
