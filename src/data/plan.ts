import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Anadido } from './alimentos';

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

export interface ItemPlan { id: string; alimento_id: string; cantidad: number; comido: boolean; comida: ComidaId; anadidos?: Anadido[] | null }

// Plan de un día para un perfil: ítems por comida, con cambios guardados al instante
export function usePlanDia(perfilId: string | undefined, fecha = hoyISO()) {
  const [items, setItems] = useState<ItemPlan[] | null>(null);
  const [nombres, setNombres] = useState<Partial<Record<ComidaId, string>>>({}); // opción puesta en cada comida

  const cargar = useCallback(async () => {
    if (!perfilId) return;
    const { data } = await supabase.from('plan')
      .select('comida, nombre, plan_items(id, alimento_id, cantidad, comido, orden, anadidos)')
      .eq('perfil_id', perfilId).eq('fecha', fecha);
    const lista: ItemPlan[] = [];
    const n: Partial<Record<ComidaId, string>> = {};
    for (const p of (data ?? []) as { comida: ComidaId; nombre: string | null; plan_items: (Omit<ItemPlan, 'comida'> & { orden: number })[] }[]) {
      if (p.nombre) n[p.comida] = p.nombre;
      for (const it of [...p.plan_items].sort((a, b) => a.orden - b.orden)) lista.push({ ...it, cantidad: Number(it.cantidad), comida: p.comida });
    }
    setItems(lista);
    setNombres(n);
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

  return { items, nombres, alternar, quitar, recargar: cargar };
}

// Agrega varios alimentos juntos a una comida del día (lo que había en la bandeja)
// comido: lo que se anota respondiendo «¿Ya desayunaste?» queda marcado como comido
export async function agregarVariosAlPlan(perfilId: string, comida: ComidaId, lista: { alimento_id: string; cantidad: number; anadidos?: Anadido[] | null }[], fecha = hoyISO(), comido = false) {
  const { data: plan, error } = await supabase.from('plan')
    .upsert({ perfil_id: perfilId, fecha, comida }, { onConflict: 'perfil_id,fecha,comida' })
    .select('id').single();
  if (error || !plan) return 'No pudimos agregarlos. Revisa tu conexión e inténtalo de nuevo.';
  const base = Date.now() % 100000;
  const { error: e2 } = await supabase.from('plan_items')
    .insert(lista.map((it, k) => ({ plan_id: plan.id, alimento_id: it.alimento_id, cantidad: it.cantidad, anadidos: it.anadidos?.length ? it.anadidos : null, orden: base + k, comido, comido_en: comido ? new Date().toISOString() : null })));
  return e2 ? 'No pudimos agregarlos. Inténtalo de nuevo.' : null;
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

// Cuántas veces anotó (como comido) cada alimento en cada comida el último mes: clave `${comida}|${alimento_id}`
export async function frecuenciaComidas(perfilId: string, dias = 30) {
  const desde = hoyISO(new Date(Date.now() - dias * 864e5));
  const { data } = await supabase.from('plan')
    .select('comida, plan_items(alimento_id, comido)').eq('perfil_id', perfilId).gte('fecha', desde);
  const m = new Map<string, number>();
  for (const p of (data ?? []) as { comida: ComidaId; plan_items: { alimento_id: string; comido: boolean }[] }[])
    for (const i of p.plan_items) if (i.comido) m.set(`${p.comida}|${i.alimento_id}`, (m.get(`${p.comida}|${i.alimento_id}`) ?? 0) + 1);
  return m;
}
