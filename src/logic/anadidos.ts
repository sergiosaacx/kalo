// «Añadidos»: lo que en la casa casi siempre se le pone a un alimento y no se anota.
// Cada sugerencia va en unidades de cocina (cucharadita, cucharada) y se guarda en porciones base del añadido.
import type { AlimentoDB } from '../data/alimentos';

export interface Unidad { gramos: number; una: string; varias: string }
export interface Sugerencia { alimento_id: string; nombre: string; unidad: Unidad; inicial: number; casa?: boolean }

const CDTA = (g: number): Unidad => ({ gramos: g, una: 'cucharadita', varias: 'cucharaditas' });
const CDA = (g: number): Unidad => ({ gramos: g, una: 'cucharada', varias: 'cucharadas' });

// Bebidas que se endulzan
const DULCE = new Set(['cafe', 'cafe-con-leche', 'te', 'chocolate-agua', 'chocolate-caliente', 'jugo-lulo-agua', 'jugo-maracuya-agua',
  'jugo-mora-agua', 'jugo-naranja', 'limonada', 'limonada-coco', 'avena-bebida', 'colada', 'avena-cocida']);
const CON_LECHE = new Set(['cafe', 'te']);
// Lo que en la casa se prepara con aceite y en Kalo está «al natural»
const ACEITE = new Set(['arroz-blanco', 'arroz-integral', 'arroz-parbolizado', 'papa-criolla', 'papa-pastusa', 'papa-sabanera', 'yuca', 'arracacha',
  'arepa-maiz-blanco', 'arepa-maiz-amarillo', 'arepa-queso', 'pasta', 'pasta-integral', 'fideos', 'quinua', 'pechuga', 'pollo-sudado', 'bistec', 'lomo-res',
  'lomo-cerdo', 'punta-anca', 'chuleta-cerdo', 'carne-molida', 'carne-molida-magra', 'tilapia', 'trucha', 'salmon', 'merluza', 'robalo', 'bagre', 'huevo']);
// Lo que Kalo ya tiene frito: el aceite viene incluido
export const FRITOS = new Set(['platano-maduro-frito', 'patacon', 'papa-frita', 'yuca-frita', 'huevo-frito', 'pescado-frito', 'pollo-apanado', 'pollo-frito',
  'chicharron', 'empanada', 'bunuelo', 'huevo-pericos', 'arepa-huevo']);

// «Como en la casa»: unos 4,5 g de aceite (40 kcal) por porción del alimento (p. ej. 1 taza de arroz)
export const ACEITE_CASA_G = 4.5;

export function sugerencias(a: AlimentoDB): Sugerencia[] {
  if (DULCE.has(a.id)) {
    const s: Sugerencia[] = [
      { alimento_id: 'azucar', nombre: 'Azúcar', unidad: CDTA(4), inicial: 2 },
      { alimento_id: 'panela', nombre: 'Panela', unidad: CDTA(5), inicial: 2 },
      { alimento_id: 'miel', nombre: 'Miel', unidad: CDTA(7), inicial: 1 },
    ];
    if (CON_LECHE.has(a.id)) s.push({ alimento_id: 'leche-entera', nombre: 'Leche', unidad: { gramos: 60, una: 'chorrito (¼ taza)', varias: 'chorritos (¼ taza)' }, inicial: 1 });
    return s;
  }
  if (ACEITE.has(a.id)) return [
    { alimento_id: 'aceite-girasol', nombre: 'Aceite como en la casa', unidad: CDA(13.6), inicial: 1, casa: true },
    { alimento_id: 'mantequilla', nombre: 'Mantequilla', unidad: CDTA(5), inicial: 1 },
    { alimento_id: 'hogao', nombre: 'Hogao', unidad: CDA(15), inicial: 2 },
  ];
  return [];
}
