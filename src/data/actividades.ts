// Reconoce lo que la gente escribe en «Otro»: primero el catálogo (gratis, al instante),
// si no aparece, la IA en el servidor (respuesta guardada para la próxima vez).
import { supabase } from '../lib/supabase';

interface Actividad { id: string; tipo: 'trabajo' | 'ejercicio'; nombre: string; met: number; sinonimos: string[] }
export interface Reconocida { met: number; nombre: string; fuente: 'catalogo' | 'ia' }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

let catalogo: Promise<Actividad[]> | null = null;
const cargar = () => (catalogo ??= (async () => {
  const { data, error } = await supabase.from('actividades').select('*');
  if (error) { catalogo = null; return []; }
  return (data as Actividad[]).map(a => ({ ...a, met: Number(a.met) }));
})());

// Coincidencia por sinónimo: gana el sinónimo más largo que aparezca en el texto (o que contenga al texto)
function buscar(lista: Actividad[], texto: string, tipo: Actividad['tipo']) {
  const t = norm(texto);
  let mejor: { a: Actividad; largo: number } | null = null;
  for (const a of lista) {
    if (a.tipo !== tipo) continue;
    for (const s of [a.nombre, ...a.sinonimos].map(norm)) {
      const coincide = t === s || (s.length >= 4 && ` ${t} `.includes(` ${s} `)) || (t.length >= 5 && s.startsWith(t));
      if (coincide && (!mejor || s.length > mejor.largo)) mejor = { a, largo: s.length };
    }
  }
  return mejor?.a ?? null;
}

export async function reconocer(texto: string, tipo: Actividad['tipo']): Promise<Reconocida | null> {
  if (!texto.trim()) return null;
  const local = buscar(await cargar(), texto, tipo);
  if (local) {
    supabase.functions.invoke('clasificar-actividad', { body: { texto, tipo, registrar: 'catalogo' } }).catch(() => {});
    return { met: local.met, nombre: local.nombre, fuente: 'catalogo' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('clasificar-actividad', { body: { texto, tipo } });
    if (error || !data?.met) return null;
    return { met: Number(data.met), nombre: String(data.nombre), fuente: 'ia' };
  } catch {
    return null;
  }
}
