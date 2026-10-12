// «¿Qué como para completar?» (tocar «Restante» en Hoy): reparte lo que falta entre las comidas que quedan
// y propone opciones en la porción que toca. Aprende de lo que la persona anota.
import { nutrientesItem, type AlimentoDB } from '../data/alimentos';
import { MOMENTOS, horarioDe } from '../data/comidas';
import type { ItemOpcion, Opcion } from '../data/opciones';
import type { ComidaId, ItemPlan } from '../data/plan';
import { PRESUPUESTO, type Perfil } from './energia';
import { revisarItems } from './evito';

export type Etiqueta = 'frecuente' | 'tuya' | 'nuevo';
export interface Sugerencia { opcion: Opcion; factor: number; items: ItemOpcion[]; kcal: number; proteina: number; etiqueta: Etiqueta }
export interface Bloque { comida: ComidaId; hora: string | null; meta: number; sugerencias: Sugerencia[] }

const ORDEN: ComidaId[] = ['des', 'alm', 'snack', 'cena'];
// Porciones de ¼ en ¼, entre ½ y 2½ (platos que se ven reales)
const porcionDe = (f: number) => Math.min(2.5, Math.max(0.5, Math.round(f * 4) / 4));

export function porcionTexto(f: number) {
  const ent = Math.floor(f), fr = f - ent;
  const s = `${ent > 0 ? ent : ''}${fr === 0.25 ? '¼' : fr === 0.5 ? '½' : fr === 0.75 ? '¾' : ''}` || '0';
  return `${s} ${f === 1 ? 'porción' : 'porciones'}`;
}

// Comidas de «Mis comidas» que hoy no tienen nada marcado como comido (media mañana y snack cuentan como «snack»)
export function comidasPendientes(p: Perfil, items: ItemPlan[]) {
  const comidas = new Set(items.filter(i => i.comido).map(i => i.comida));
  const horario = horarioDe(p.comidas).filter(c => c.on);
  const vistas = new Map<ComidaId, string>();
  for (const c of horario) {
    const comida = MOMENTOS[c.id].comida;
    if (!comidas.has(comida) && !vistas.has(comida)) vistas.set(comida, c.hora);
  }
  return ORDEN.filter(c => vistas.has(c)).map(c => ({ comida: c, hora: vistas.get(c)! }));
}

export function armarBloques(args: {
  p: Perfil; items: ItemPlan[]; restante: number; faltaProteina: number;
  opciones: Opcion[]; porId: Map<string, AlimentoDB>; frecuencia: Map<string, number>; // clave `${comida}|${alimento}`
}): { bloques: Bloque[]; todasHechas: boolean } {
  const { p, items, restante, faltaProteina, opciones, porId, frecuencia } = args;
  let pendientes: { comida: ComidaId; hora: string | null }[] = comidasPendientes(p, items);
  const todasHechas = pendientes.length === 0;
  if (todasHechas) pendientes = [{ comida: 'snack', hora: null }];
  const peso = pendientes.reduce((t, c) => t + PRESUPUESTO[c.comida], 0) || 1;

  const bloques = pendientes.map(({ comida, hora }) => {
    const meta = Math.round((restante * PRESUPUESTO[comida]) / peso / 10) * 10;
    const candidatas: Sugerencia[] = [];
    for (const o of opciones) {
      if (o.comida !== comida || !o.items.length || !o.items.every(i => porId.has(i.alimento_id))) continue;
      const rev = revisarItems(o.items, porId, p.evito);
      if (rev.bloquea) continue; // alergias y lo que no quiere que le recomienden
      const base = o.items.reduce((t, i) => { const n = nutrientesItem(i, porId); return { k: t.k + n.kcal, p: t.p + n.p }; }, { k: 0, p: 0 });
      if (base.k <= 0) continue;
      const factor = porcionDe(meta / base.k);
      const veces = o.items.reduce((t, i) => t + (frecuencia.get(`${comida}|${i.alimento_id}`) ?? 0), 0);
      candidatas.push({
        opcion: o, factor, items: o.items.map(i => ({ alimento_id: i.alimento_id, cantidad: Math.round(i.cantidad * factor * 100) / 100 })),
        kcal: base.k * factor, proteina: base.p * factor,
        etiqueta: veces > 0 ? 'frecuente' : o.fuente !== 'kalo' ? 'tuya' : 'nuevo',
        // para ordenar: lo frecuente primero; si falta proteína, las que más traen; y que la porción quede cerca de la meta
        ...{ _veces: veces, _ajuste: Math.abs(base.k * factor - meta) / (meta || 1), _prefiere: rev.prefiere },
      } as Sugerencia);
    }
    const nota = (s: Sugerencia) => {
      const x = s as Sugerencia & { _veces: number; _ajuste: number; _prefiere: number };
      return -x._prefiere * 3 - x._veces * 10 - (s.etiqueta === 'tuya' ? 5 : 0) + x._ajuste * 8 - (faltaProteina > 20 ? (s.proteina / (s.kcal || 1)) * 40 : 0);
    };
    const conocidas = candidatas.filter(s => s.etiqueta !== 'nuevo').sort((a, b) => nota(a) - nota(b));
    const nuevas = candidatas.filter(s => s.etiqueta === 'nuevo').sort((a, b) => nota(a) - nota(b));
    // Intercaladas: una conocida, una nueva, y así (el «↻» va pasando por esta lista)
    const sugerencias: Sugerencia[] = [];
    for (let k = 0; k < Math.max(conocidas.length, nuevas.length); k++) {
      if (conocidas[k]) sugerencias.push(conocidas[k]);
      if (nuevas[k]) sugerencias.push(nuevas[k]);
    }
    return { comida, hora, meta, sugerencias };
  });
  return { bloques, todasHechas };
}
