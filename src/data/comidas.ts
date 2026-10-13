// «Mis comidas»: los momentos de comer del día, su hora y los recordatorios «¿Ya desayunaste?».
// La función del servidor (supabase/functions/recordatorios) usa el mismo horario por defecto.
import { supabase } from '../lib/supabase';
import type { ComidaId } from './plan';

export type Momento = 'des' | 'media' | 'alm' | 'snack' | 'cena';
export interface ComidaHora { id: Momento; hora: string; on: boolean } // hora 'HH:MM' de Colombia

export const MOMENTOS: Record<Momento, { nombre: string; comida: ComidaId; pregunta: string; no: string }> = {
  des: { nombre: 'Desayuno', comida: 'des', pregunta: '¿Ya desayunaste?', no: 'Hoy no desayuné' },
  media: { nombre: 'Media mañana', comida: 'snack', pregunta: '¿Ya comiste algo a media mañana?', no: 'Hoy no comí a media mañana' },
  alm: { nombre: 'Almuerzo', comida: 'alm', pregunta: '¿Ya almorzaste?', no: 'Hoy no almorcé' },
  snack: { nombre: 'Snack', comida: 'snack', pregunta: '¿Ya comiste tu snack?', no: 'Hoy no comí snack' },
  cena: { nombre: 'Cena', comida: 'cena', pregunta: '¿Ya cenaste?', no: 'Hoy no cené' },
};

export const HORARIO_DEFECTO: ComidaHora[] = [
  { id: 'des', hora: '07:00', on: true }, { id: 'media', hora: '10:00', on: false }, { id: 'alm', hora: '12:30', on: true },
  { id: 'snack', hora: '16:00', on: true }, { id: 'cena', hora: '19:30', on: true },
];

export const horarioDe = (comidas?: ComidaHora[] | null) =>
  HORARIO_DEFECTO.map(d => comidas?.find(c => c.id === d.id) ?? d);

// '19:30' → '7:30 p. m.'
export function horaTexto(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export const esMomento = (s: string | null | undefined): s is Momento => !!s && s in MOMENTOS;

// Responder el recordatorio: comió (respondido), «Hoy no…» (saltado) o «Recuérdame en 30 min» (pospuesto)
export async function responder(perfilId: string, fecha: string, momento: Momento, estado: 'respondido' | 'saltado' | 'pospuesto') {
  const pospuesto_hasta = estado === 'pospuesto' ? new Date(Date.now() + 30 * 60e3).toISOString() : null;
  await supabase.from('recordatorios').upsert({ perfil_id: perfilId, fecha, momento, estado, pospuesto_hasta, actualizado: new Date().toISOString() });
}

// Lo que Kalo le mandó hoy (para la campanita): comidas, pesarse y agua, con la hora y qué pasó
export interface Notificacion { momento: string; estado: string; hora: string }
export async function notificacionesDeHoy(perfilId: string, fecha: string): Promise<Notificacion[]> {
  const { data } = await supabase.from('recordatorios').select('momento, estado, actualizado')
    .eq('perfil_id', perfilId).eq('fecha', fecha).neq('estado', 'saltado').not('momento', 'like', 'exceso%').order('actualizado', { ascending: false });
  return (data ?? []).map(r => {
    const d = new Date(r.actualizado);
    return { momento: r.momento, estado: r.estado, hora: horaTexto(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`) };
  });
}

// La comida que se le preguntó hoy y aún no respondió (la más reciente), para preguntarle al abrir Kalo
export async function pendienteDeHoy(perfilId: string, fecha: string): Promise<Momento | null> {
  const { data } = await supabase.from('recordatorios').select('momento, actualizado')
    .eq('perfil_id', perfilId).eq('fecha', fecha).eq('estado', 'enviado').order('actualizado', { ascending: false }).limit(1);
  const m = data?.[0]?.momento;
  return esMomento(m) ? m : null;
}
