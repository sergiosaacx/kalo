// «Lo que evito»: alergias (Kalo avisa y nunca las recomienda), lo que no quiere que le recomienden y lo que prefiere.
// Cada grupo ya sabe qué alimentos de Kalo incluye; «+ Otro» suma alimentos puntuales.
import type { AlimentoDB, Anadido } from '../data/alimentos';
import { FRITOS } from './anadidos';

export type TipoGrupo = 'alergia' | 'evito' | 'prefiero';
export interface Grupo { id: string; nombre: string; tipo: TipoGrupo; incluye: (a: AlimentoDB) => boolean; info?: string }
export interface Evito { alergias: string[]; evito: string[]; prefiero: string[]; alergiaAlimentos: string[]; evitoAlimentos: string[] }
export const EVITO_VACIO: Evito = { alergias: [], evito: [], prefiero: [], alergiaAlimentos: [], evitoAlimentos: [] };

const ids = (...l: string[]) => { const s = new Set(l); return (a: AlimentoDB) => s.has(a.id); };
const empieza = (...l: string[]) => (a: AlimentoDB) => l.some(p => a.id.startsWith(p));
const o = (...fs: ((a: AlimentoDB) => boolean)[]) => (a: AlimentoDB) => fs.some(f => f(a));

export const GRUPOS: Grupo[] = [
  // Alergias
  { id: 'mani', nombre: 'Maní', tipo: 'alergia', incluye: ids('mani', 'mantequilla-mani', 'tamal-pipian') },
  { id: 'mariscos', nombre: 'Mariscos', tipo: 'alergia', incluye: ids('camaron', 'calamar', 'cangrejo', 'mejillon', 'pulpo') },
  { id: 'pescado', nombre: 'Pescado', tipo: 'alergia', incluye: o(ids('tilapia', 'trucha', 'salmon', 'merluza', 'robalo', 'bagre', 'bocachico', 'pescado-frito', 'sardina'), empieza('atun-')) },
  { id: 'huevo', nombre: 'Huevo', tipo: 'alergia', incluye: o(empieza('huevo'), ids('clara', 'yema', 'arepa-huevo', 'mayonesa', 'torta')) },
  { id: 'leche', nombre: 'Leche', tipo: 'alergia', incluye: o(empieza('queso', 'yogur', 'leche-entera', 'leche-descremada', 'leche-deslactosada', 'leche-semidescremada', 'leche-polvo', 'leche-condensada'),
    ids('quesillo', 'cuajada', 'kumis', 'kefir', 'crema-leche', 'crema-agria', 'suero-costeno', 'mantequilla', 'arequipe', 'cafe-con-leche', 'chocolate-caliente', 'batido-banano', 'avena-bebida', 'helado', 'almojabana', 'pandebono', 'bunuelo', 'arepa-queso')) },
  { id: 'gluten', nombre: 'Gluten', tipo: 'alergia', incluye: o(empieza('pan-', 'pasta', 'galleta-'), ids('fideos', 'harina-trigo', 'tortilla-trigo', 'cuscus', 'cebada', 'mogolla', 'torta', 'cerveza', 'pollo-apanado', 'pollo-frito')) },
  { id: 'nueces', nombre: 'Nueces', tipo: 'alergia', incluye: ids('almendras', 'nueces', 'nuez-brasil', 'avellana', 'macadamia', 'maranon', 'pistacho', 'leche-almendras') },
  // No me lo recomienden
  { id: 'jugos', nombre: 'Jugos de fruta', tipo: 'evito', incluye: o(empieza('jugo-'), ids('limonada', 'limonada-coco')),
    info: 'Al licuar y colar se pierde la fibra y queda el azúcar de la fruta, que la OMS cuenta como «azúcar libre». Mejor la fruta entera.' },
  { id: 'gaseosas', nombre: 'Gaseosas', tipo: 'evito', incluye: ids('gaseosa', 'gaseosa-cero'),
    info: 'Las gaseosas azucaradas son la mayor fuente de azúcar libre en la dieta según la OMS. Las «cero» no tienen azúcar, pero sí edulcorantes.' },
  { id: 'azucar', nombre: 'Azúcar añadida', tipo: 'evito', incluye: ids('azucar', 'panela', 'miel', 'aguapanela', 'bocadillo', 'banano-bocadillo', 'arequipe', 'mermelada', 'leche-condensada', 'gaseosa', 'helado', 'torta', 'pan-dulce'),
    info: 'La OMS recomienda que el azúcar libre (azúcar, panela, miel, jugos) sea menos del 10 % de las calorías del día, y mejor menos del 5 %.' },
  { id: 'fritos', nombre: 'Fritos', tipo: 'evito', incluye: (a: AlimentoDB) => FRITOS.has(a.id),
    info: 'Freír suma mucha grasa y calorías por el aceite que absorbe el alimento. Asado, al horno o cocido trae lo mismo con menos grasa.' },
  { id: 'embutidos', nombre: 'Embutidos', tipo: 'evito', incluye: ids('chorizo', 'salchicha', 'jamon', 'jamon-pavo', 'mortadela', 'morcilla', 'tocino'),
    info: 'La Agencia Internacional de Investigación sobre el Cáncer (OMS) clasifica las carnes procesadas en el grupo 1: comerlas a diario aumenta el riesgo de cáncer de colon.' },
  { id: 'harinas', nombre: 'Harinas blancas', tipo: 'evito', incluye: o(ids('pan-blanco', 'pan-frances', 'pan-aliado', 'pan-hamburguesa', 'pan-dulce', 'pasta', 'fideos', 'galleta-soda', 'mogolla', 'torta', 'tostada'), ids('harina-trigo')),
    info: 'Al refinar el grano se le quita la fibra: llena menos y sube más rápido el azúcar en la sangre. Las versiones integrales traen la fibra.' },
  { id: 'alcohol', nombre: 'Alcohol', tipo: 'evito', incluye: ids('cerveza', 'vino-tinto', 'aguardiente'),
    info: 'La OMS dice que no hay una cantidad de alcohol segura para la salud; además aporta calorías sin nutrientes.' },
  // Prefiero
  { id: 'fruta', nombre: 'Fruta entera', tipo: 'prefiero', incluye: (a: AlimentoDB) => a.categoria === 'frutas' && !a.id.startsWith('pulpa-'),
    info: 'La fruta entera trae fibra, que llena y hace que el azúcar suba más despacio.' },
  { id: 'verduras', nombre: 'Verduras', tipo: 'prefiero', incluye: (a: AlimentoDB) => a.categoria === 'verduras',
    info: 'La OMS recomienda al menos 400 g de frutas y verduras al día.' },
  { id: 'integrales', nombre: 'Integrales', tipo: 'prefiero', incluye: o(ids('arroz-integral', 'pan-integral', 'pasta-integral', 'galleta-integral', 'quinua', 'pan-centeno'), empieza('avena')) },
  { id: 'magra', nombre: 'Proteína magra', tipo: 'prefiero', incluye: ids('pechuga', 'pechuga-cocida', 'tilapia', 'trucha', 'merluza', 'atun-lata-agua', 'clara', 'pavo', 'lomo-res', 'lomo-cerdo', 'carne-molida-magra', 'huevo-cocido') },
  { id: 'legumbres', nombre: 'Legumbres', tipo: 'prefiero', incluye: o(empieza('frijol', 'lenteja', 'arveja'), ids('garbanzo', 'habas', 'hummus')) },
];
export const grupoDe = (id: string) => GRUPOS.find(g => g.id === id);

// ¿Qué le choca a este alimento? (para el aviso rojo y para no recomendarlo)
export function choques(a: AlimentoDB, ev: Evito | null | undefined) {
  if (!ev) return { alergia: [] as string[], evito: [] as string[] };
  const alergia = ev.alergias.map(grupoDe).filter((g): g is Grupo => !!g && g.incluye(a)).map(g => g.nombre);
  if (ev.alergiaAlimentos.includes(a.id)) alergia.push(a.nombre);
  const evito = ev.evito.map(grupoDe).filter((g): g is Grupo => !!g && g.incluye(a)).map(g => g.nombre);
  if (ev.evitoAlimentos.includes(a.id)) evito.push(a.nombre);
  return { alergia, evito };
}
export const loPrefiere = (a: AlimentoDB, ev: Evito | null | undefined) => !!ev && ev.prefiero.some(id => grupoDe(id)?.incluye(a));

// Una preparación (alimentos + sus añadidos): qué alimento choca, y cuántos de los que prefiere lleva
export function revisarItems(items: { alimento_id: string; anadidos?: Anadido[] | null }[], porId: Map<string, AlimentoDB>, ev: Evito | null | undefined) {
  const todos = items.flatMap(i => [i.alimento_id, ...(i.anadidos ?? []).map(x => x.alimento_id)]).map(id => porId.get(id)).filter((a): a is AlimentoDB => !!a);
  const conAlergia = todos.filter(a => choques(a, ev).alergia.length > 0);
  const conEvito = todos.filter(a => choques(a, ev).evito.length > 0);
  return { conAlergia, conEvito, prefiere: todos.filter(a => loPrefiere(a, ev)).length, bloquea: conAlergia.length + conEvito.length > 0 };
}
