// Lo anotado en un rango de días (para Semana, Personalizado y el gasto real)
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { nutrientesItem, type AlimentoDB, type Anadido } from './alimentos';
import type { ComidaId } from './plan';

export interface ItemDia { fecha: string; comida: ComidaId; alimento_id: string; cantidad: number; comido: boolean; anadidos?: Anadido[] | null }
export interface Dia { fecha: string; kcal: number; p: number; comidas: number } // solo lo marcado como comido

export function usePlanRango(perfilId: string | undefined, desde: string, hasta: string) {
  const [items, setItems] = useState<ItemDia[] | null>(null);
  const cargar = useCallback(async () => {
    if (!perfilId) return;
    const { data } = await supabase.from('plan')
      .select('fecha, comida, plan_items(alimento_id, cantidad, comido, anadidos)')
      .eq('perfil_id', perfilId).gte('fecha', desde).lte('fecha', hasta);
    const lista: ItemDia[] = [];
    for (const p of (data ?? []) as { fecha: string; comida: ComidaId; plan_items: Omit<ItemDia, 'fecha' | 'comida'>[] }[])
      for (const i of p.plan_items) lista.push({ ...i, cantidad: Number(i.cantidad), fecha: p.fecha, comida: p.comida });
    setItems(lista);
  }, [perfilId, desde, hasta]);
  useEffect(() => { setItems(null); cargar(); }, [cargar]);
  return { items, recargar: cargar };
}

// Totales por día de lo comido (y cuántas comidas distintas tienen algo comido)
export function porDia(items: ItemDia[], porId: Map<string, AlimentoDB>): Map<string, Dia> {
  const m = new Map<string, Dia & { _c: Set<string> }>();
  for (const it of items) {
    if (!it.comido || !porId.has(it.alimento_id)) continue;
    const n = nutrientesItem(it, porId);
    const d = m.get(it.fecha) ?? { fecha: it.fecha, kcal: 0, p: 0, comidas: 0, _c: new Set<string>() };
    d.kcal += n.kcal; d.p += n.p; d._c.add(it.comida); d.comidas = d._c.size;
    m.set(it.fecha, d);
  }
  return m as Map<string, Dia>;
}
