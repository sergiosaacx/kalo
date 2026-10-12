import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ComidaId } from './plan';
import type { Anadido } from './alimentos';

export interface ItemOpcion { alimento_id: string; cantidad: number; anadidos?: Anadido[] | null }
export interface Opcion {
  id: string;
  comida: ComidaId;
  nombre: string;
  fuente: 'kalo' | 'mia' | 'ia';
  descripcion: string | null;
  tiempo_min: number | null;
  dificultad: Dificultad | null;
  items: ItemOpcion[];
}
export type Dificultad = 'facil' | 'media' | 'dificil';
export const DIFICULTAD: Record<Dificultad, string> = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };
export const tiempoTexto = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);

// Opciones de Kalo (menús colombianos) + las de la cuenta. Se cargan una vez y se recargan al cambiar.
let cache: Opcion[] | null = null;
const oyentes = new Set<(o: Opcion[]) => void>();

async function cargar() {
  const { data, error } = await supabase.from('opciones')
    .select('id, comida, nombre, fuente, descripcion, tiempo_min, dificultad, creado, opcion_items(alimento_id, cantidad, orden, anadidos)')
    .order('fuente', { ascending: false }).order('creado', { ascending: false });
  if (error) return cache ?? [];
  cache = (data ?? []).map(o => ({
    id: o.id, comida: o.comida, nombre: o.nombre, fuente: o.fuente, descripcion: o.descripcion, tiempo_min: o.tiempo_min, dificultad: o.dificultad,
    items: [...(o.opcion_items ?? [])].sort((a, b) => a.orden - b.orden).map(i => ({ alimento_id: i.alimento_id, cantidad: Number(i.cantidad), anadidos: i.anadidos ?? null })),
  })) as Opcion[];
  oyentes.forEach(f => f(cache!));
  return cache;
}

export function useOpciones() {
  const [lista, setLista] = useState<Opcion[] | null>(cache);
  useEffect(() => {
    oyentes.add(setLista);
    if (!cache) cargar();
    return () => { oyentes.delete(setLista); };
  }, []);
  return { lista, recargar: cargar };
}

async function cuentaId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

const guardarItems = async (opcionId: string, items: ItemOpcion[]) => {
  await supabase.from('opcion_items').delete().eq('opcion_id', opcionId);
  if (!items.length) return null;
  const { error } = await supabase.from('opcion_items')
    .insert(items.map((i, k) => ({ opcion_id: opcionId, alimento_id: i.alimento_id, cantidad: i.cantidad, anadidos: i.anadidos ?? null, orden: k })));
  return error;
};

// Crea o actualiza una opción propia. Devuelve un mensaje de error o null.
export async function guardarOpcion(o: {
  id?: string; comida: ComidaId; nombre: string; items: ItemOpcion[]; fuente?: 'mia' | 'ia';
  tiempo_min: number | null; dificultad: Dificultad | null;
}) {
  const cuenta = await cuentaId();
  if (!cuenta) return 'Tu sesión se cerró. Vuelve a entrar.';
  let id = o.id;
  const campos = { comida: o.comida, nombre: o.nombre, tiempo_min: o.tiempo_min, dificultad: o.dificultad };
  if (id) {
    const { error } = await supabase.from('opciones').update(campos).eq('id', id);
    if (error) return 'No pudimos guardar la opción. Inténtalo de nuevo.';
  } else {
    const { data, error } = await supabase.from('opciones')
      .insert({ cuenta_id: cuenta, fuente: o.fuente ?? 'mia', ...campos }).select('id').single();
    if (error || !data) return 'No pudimos guardar la opción. Inténtalo de nuevo.';
    id = data.id;
  }
  const e2 = await guardarItems(id!, o.items);
  await cargar();
  return e2 ? 'Se guardó el nombre, pero no los alimentos. Inténtalo de nuevo.' : null;
}

export async function borrarOpcion(id: string) {
  const { error } = await supabase.from('opciones').delete().eq('id', id);
  await cargar();
  return error ? 'No pudimos borrarla. Inténtalo de nuevo.' : null;
}

// Reparte muchas comidas de una vez (calendario automático): 3 llamadas en total, no 3 por comida
export async function aplicarVarios(perfilId: string, entradas: { fecha: string; comida: ComidaId; items: ItemOpcion[]; nombre: string; opcionId: string | null }[]) {
  if (!entradas.length) return null;
  const { data: planes, error } = await supabase.from('plan')
    .upsert(entradas.map(e => ({ perfil_id: perfilId, fecha: e.fecha, comida: e.comida, opcion_id: e.opcionId, nombre: e.nombre })), { onConflict: 'perfil_id,fecha,comida' })
    .select('id, fecha, comida');
  if (error || !planes) return 'No pudimos repartir el menú. Revisa tu conexión.';
  const idDe = new Map(planes.map(p => [`${p.fecha}|${p.comida}`, p.id as string]));
  await supabase.from('plan_items').delete().in('plan_id', [...idDe.values()]);
  const filas = entradas.flatMap(e => e.items.map((i, k) => ({ plan_id: idDe.get(`${e.fecha}|${e.comida}`), alimento_id: i.alimento_id, cantidad: i.cantidad, anadidos: i.anadidos ?? null, orden: k })));
  const { error: e2 } = await supabase.from('plan_items').insert(filas);
  return e2 ? 'Se repartieron los días, pero no todos los alimentos. Inténtalo de nuevo.' : null;
}

// Pone una opción (o una lista de alimentos) en una comida de un día. Reemplaza lo que hubiera:
// los alimentos se COPIAN al plan, así editar el día no cambia la opción original.
export async function aplicarAlDia(perfilId: string, fecha: string, comida: ComidaId, items: ItemOpcion[], nombre: string | null, opcionId: string | null) {
  const { data: plan, error } = await supabase.from('plan')
    .upsert({ perfil_id: perfilId, fecha, comida, opcion_id: opcionId, nombre }, { onConflict: 'perfil_id,fecha,comida' })
    .select('id').single();
  if (error || !plan) return 'No pudimos ponerla en tu día. Revisa tu conexión.';
  await supabase.from('plan_items').delete().eq('plan_id', plan.id);
  if (items.length) {
    const { error: e2 } = await supabase.from('plan_items')
      .insert(items.map((i, k) => ({ plan_id: plan.id, alimento_id: i.alimento_id, cantidad: i.cantidad, anadidos: i.anadidos ?? null, orden: k })));
    if (e2) return 'No pudimos copiar los alimentos. Inténtalo de nuevo.';
  }
  return null;
}
