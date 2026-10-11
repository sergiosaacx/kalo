// Utilidades compartidas por las vistas del Menú (semana, calendario, opciones, recomendación)
import { nutrientes, type AlimentoDB } from '../data/alimentos';
import type { ItemOpcion } from '../data/opciones';
import { hoyISO } from '../data/plan';
import { conSigno } from './energia';
import { C } from '../theme';

export const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const fq = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');
export const desdeISO = (f: string) => { const [a, m, d] = f.split('-').map(Number); return new Date(a, m - 1, d); };
export const sumarDias = (f: string, n: number) => { const d = desdeISO(f); d.setDate(d.getDate() + n); return hoyISO(d); };
export const diaTexto = (f: string) => { const d = desdeISO(f); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()}`; };
export const diaCorto = (f: string) => { const d = desdeISO(f); return f === hoyISO() ? 'hoy' : `${DIAS_CORTO[d.getDay()].toLowerCase()} ${d.getDate()}`; };
export const fechaLarga = (f: string) => { const d = desdeISO(f); return `${d.getDate()} de ${MESES[d.getMonth()]}`; };

export type Mapa = Map<string, AlimentoDB>;
export function totales(items: ItemOpcion[], porId: Mapa) {
  return items.reduce((a, it) => {
    const f = porId.get(it.alimento_id);
    if (!f) return a;
    const n = nutrientes(f, it.cantidad);
    a.k += n.kcal; a.p += n.p; a.c += n.c; a.g += n.gr; a.fib += n.n('fibra_g');
    return a;
  }, { k: 0, p: 0, c: 0, g: 0, fib: 0 });
}

// «En tu meta» si queda a ±10 % de lo que le toca a esa comida
export function ajuste(k: number, presupuesto: number) {
  const d = k - presupuesto;
  return Math.abs(d) <= presupuesto * 0.1 ? { txt: 'En tu meta', color: C.success } : { txt: `${conSigno(d)} kcal`, color: d > 0 ? C.accentLight : C.muted };
}
