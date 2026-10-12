// La salud de lo que se come: sellos de advertencia por alimento (criterios de la Resolución 2492 de 2022, Minsalud)
// y límites del día (OMS): azúcar libre y grasa saturada < 10 % de las calorías, sodio < 2.000 mg, fibra ≥ 25 g, frutas y verduras ≥ 400 g.
import { nutrientes, type AlimentoDB, type Anadido } from '../data/alimentos';

// Los sellos no aplican a lo natural o mínimamente procesado (como dice la norma)
const NATURALES = new Set(['huevo', 'huevo-cocido', 'huevo-codorniz', 'clara', 'yema', 'leche-entera', 'leche-descremada', 'leche-semidescremada', 'leche-deslactosada',
  'yogur-natural', 'agua', 'agua-coco', 'cafe', 'te', 'aguacate', 'aguacate-hass', 'pechuga', 'pechuga-cocida', 'pechuga-cruda', 'muslo-pollo', 'contramuslo', 'alas-pollo',
  'lomo-res', 'lomo-cerdo', 'punta-anca', 'bistec', 'carne-molida', 'carne-molida-magra', 'costilla-res', 'costilla-cerdo', 'chuleta-cerdo', 'sobrebarriga', 'lengua',
  'higado-pollo', 'higado-res', 'conejo', 'cordero', 'pato', 'pavo', 'cuy', 'salmon', 'tilapia', 'trucha', 'merluza', 'robalo', 'bagre', 'bocachico', 'camaron', 'calamar',
  'cangrejo', 'mejillon', 'pulpo', 'molleja']);
const NATURAL_RE = /^(aceite-|frijol|lenteja|garbanzo|arveja|habas|arroz-|papa-pastusa|papa-criolla|papa-sabanera|yuca$|quinua|avena-hojuelas|almendras|nueces|nuez|avellana|macadamia|maranon|pistacho|mani$|semillas|chia|linaza|ajonjoli|tahini)/;
export const esNatural = (a: AlimentoDB) => a.categoria === 'frutas' || a.categoria === 'verduras' || NATURALES.has(a.id) || NATURAL_RE.test(a.id);

// Alimentos cuyo azúcar es «azúcar libre» (añadida, jugos, miel); la de la fruta entera y la leche no cuenta
const LIBRES = new Set(['azucar', 'panela', 'miel', 'aguapanela', 'bocadillo', 'banano-bocadillo', 'arequipe', 'mermelada', 'leche-condensada', 'gaseosa', 'helado', 'torta',
  'pan-dulce', 'limonada', 'limonada-coco', 'chocolate-mesa', 'chocolate-agua', 'chocolate-caliente', 'cereal-arroz', 'corn-flakes', 'granola', 'galleta-integral',
  'yogur-fruta', 'batido-banano', 'avena-bebida', 'colada', 'mazamorra']);
export const azucarLibre = (a: AlimentoDB) => LIBRES.has(a.id) || a.id.startsWith('jugo-');
const EDULCORANTES = new Set(['gaseosa-cero']);

export type Sello = 'sodio' | 'azucares' | 'grasas' | 'edulcorantes';
export const SELLO_TXT: Record<Sello, [string, string]> = {
  sodio: ['EXCESO EN SODIO', 'SODIO'], azucares: ['EXCESO EN AZÚCARES', 'AZÚCARES'],
  grasas: ['EXCESO EN GRASAS SATURADAS', 'GRASAS SAT.'], edulcorantes: ['CONTIENE EDULCORANTES', 'EDULCORANTES'],
};

export function sellos(a: AlimentoDB): Sello[] {
  if (esNatural(a)) return [];
  const p = a.por_100g, k = p.kcal ?? 0, na = p.sodio_mg ?? 0, out: Sello[] = [];
  if (k < 5 ? na >= 40 : (na >= 300 || na / k >= 1)) out.push('sodio');
  if (azucarLibre(a) && k > 0 && ((p.azucar_g ?? 0) * 4) / k >= 0.1) out.push('azucares');
  if (k > 0 && ((p.grasa_sat_g ?? 0) * 9) / k >= 0.1) out.push('grasas');
  if (EDULCORANTES.has(a.id)) out.push('edulcorantes');
  return out;
}

// Advertencias fijas: lo que tiene evidencia fuerte de daño cuando se consume seguido
const EMBUTIDOS = new Set(['chorizo', 'salchicha', 'jamon', 'jamon-pavo', 'mortadela', 'morcilla', 'tocino']);
export function advertencia(a: AlimentoDB): { titulo: string; texto: string } | null {
  if (a.id === 'gaseosa') return { titulo: 'Gaseosa', texto: 'Las bebidas azucaradas son la mayor fuente de azúcar libre según la OMS y se asocian con diabetes, sobrepeso y caries. Un vaso trae unas 6 cucharaditas de azúcar.' };
  if (a.id === 'gaseosa-cero') return { titulo: 'Gaseosa cero', texto: 'No tiene azúcar, pero sí edulcorantes. La OMS recomienda no usarlos para bajar de peso: el agua es la mejor opción.' };
  if (['cerveza', 'vino-tinto', 'aguardiente'].includes(a.id)) return { titulo: 'Alcohol', texto: 'La agencia de cáncer de la OMS lo clasifica en el grupo 1 y la OMS dice que no hay una cantidad segura. Además aporta calorías sin nutrientes.' };
  if (EMBUTIDOS.has(a.id)) return { titulo: 'Embutido', texto: 'La agencia de cáncer de la OMS clasifica las carnes procesadas en el grupo 1: comer 50 g al día sube 18 % el riesgo de cáncer de colon. Mejor de vez en cuando.' };
  if (sellos(a).includes('sodio')) return { titulo: 'Mucho sodio', texto: `100 g traen ${Math.round(a.por_100g.sodio_mg ?? 0)} mg. La OMS recomienda menos de 2.000 mg de sodio al día (unos 5 g de sal); el exceso sube la presión arterial.` };
  return null;
}

// ---- El día ----
export interface Limites { azucar: number; sodio: number; grasaSat: number; fibra: number; frutasVerduras: number }
export const limitesDe = (objetivoKcal: number): Limites => ({
  azucar: Math.round((objetivoKcal * 0.1) / 4), grasaSat: Math.round((objetivoKcal * 0.1) / 9), sodio: 2000, fibra: 25, frutasVerduras: 400,
});

export interface Aporte { nombre: string; valor: number }
export interface Dia { azucar: number; sodio: number; grasaSat: number; fibra: number; frutasVerduras: number; de: Record<'azucar' | 'sodio' | 'grasaSat', Aporte[]> }

// Suma lo comido (con añadidos) y guarda qué alimento aportó cuánto
export function saludDelDia(items: { alimento_id: string; cantidad: number; anadidos?: Anadido[] | null }[], porId: Map<string, AlimentoDB>): Dia {
  const d: Dia = { azucar: 0, sodio: 0, grasaSat: 0, fibra: 0, frutasVerduras: 0, de: { azucar: [], sodio: [], grasaSat: [] } };
  const sumar = (m: 'azucar' | 'sodio' | 'grasaSat', nombre: string, v: number) => {
    if (v <= 0) return;
    d[m] += v;
    const x = d.de[m].find(y => y.nombre === nombre);
    if (x) x.valor += v; else d.de[m].push({ nombre, valor: v });
  };
  for (const it of items) for (const x of [it, ...(it.anadidos ?? [])]) {
    const a = porId.get(x.alimento_id);
    if (!a) continue;
    const n = nutrientes(a, x.cantidad);
    sumar('sodio', a.nombre, n.n('sodio_mg'));
    sumar('grasaSat', a.nombre, n.n('grasa_sat_g'));
    if (azucarLibre(a)) sumar('azucar', a.nombre, n.n('azucar_g'));
    d.fibra += n.n('fibra_g');
    if ((a.categoria === 'frutas' && !a.id.startsWith('pulpa-')) || a.categoria === 'verduras') d.frutasVerduras += n.g;
  }
  for (const m of ['azucar', 'sodio', 'grasaSat'] as const) d.de[m].sort((x, y) => y.valor - x.valor);
  return d;
}

export const NOMBRE: Record<'azucar' | 'sodio' | 'grasaSat', string> = { azucar: 'azúcar libre', sodio: 'sodio', grasaSat: 'grasa saturada' };
export const UNIDAD: Record<'azucar' | 'sodio' | 'grasaSat', string> = { azucar: 'g', sodio: 'mg', grasaSat: 'g' };

// Avisos del día para la campanita: pasado (≥ 100 %) o cerca (≥ 85 %) de un límite
export interface Aviso { nivel: 'pasado' | 'cerca'; titulo: string; texto: string }
export function avisosDelDia(d: Dia, l: Limites): Aviso[] {
  const out: Aviso[] = [];
  const f = (n: number) => Math.round(n).toLocaleString('es-CO');
  for (const m of ['sodio', 'azucar', 'grasaSat'] as const) {
    const v = d[m], lim = l[m];
    if (v < lim * 0.85) continue;
    const top = d.de[m].slice(0, 2).map(x => `${x.nombre.toLowerCase()} (${f(x.valor)} ${UNIDAD[m]})`).join(' y ');
    out.push(v >= lim
      ? { nivel: 'pasado', titulo: `Te pasaste de ${NOMBRE[m]}: ${f(v)} de ${f(lim)} ${UNIDAD[m]}`, texto: `Lo que más aportó: ${top}. Para lo que queda del día, mejor evitarlo.` }
      : { nivel: 'cerca', titulo: `Vas cerca del límite de ${NOMBRE[m]}: ${f(v)} de ${f(lim)} ${UNIDAD[m]}`, texto: `Lo que más aportó: ${top}.` });
  }
  return out;
}

// ¿Lo que va a anotar hace pasar algún límite? (aviso en la bandeja antes de «Listo»)
export function cruzaLimite(antes: Dia, despues: Dia, l: Limites) {
  return (['azucar', 'sodio', 'grasaSat'] as const).filter(m => antes[m] < l[m] && despues[m] >= l[m])
    .map(m => ({ m, valor: despues[m], limite: l[m] }));
}
