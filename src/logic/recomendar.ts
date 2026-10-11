// Recomendador de combinaciones (handoff › Recomendador de opciones): un alimento por grupo, escogido de
// forma determinista con una semilla; después se ajusta la porción del alimento base en pasos de 0,5
// hasta quedar a ±8 % de lo que le toca a esa comida. «Otra combinación» = semilla + 1.
import { nutrientes, type AlimentoDB } from '../data/alimentos';
import type { ItemOpcion } from '../data/opciones';
import type { ComidaId } from '../data/plan';

// Grupos por comida; el último de cada lista es opcional (entra según la semilla)
const GRUPOS: Record<ComidaId, { opciones: string[]; opcional?: boolean }[]> = {
  des: [
    { opciones: ['arepa-maiz-blanco', 'pan-integral', 'avena-hojuelas', 'calado', 'arepa-boyacense', 'almojabana'] },
    { opciones: ['huevo-pericos', 'huevo-cocido', 'queso-campesino', 'yogur-griego', 'cuajada'] },
    { opciones: ['banano', 'papaya', 'mango', 'fresa', 'pina'] },
    { opciones: ['cafe-con-leche', 'chocolate-caliente', 'jugo-naranja'], opcional: true },
  ],
  alm: [
    { opciones: ['pechuga', 'carne-desmechada', 'tilapia', 'lomo-cerdo', 'frijol-rojo', 'lenteja', 'muslo-pollo', 'trucha'] },
    { opciones: ['arroz-blanco', 'arroz-integral', 'papa-criolla', 'yuca', 'platano-maduro-asado', 'quinua'] },
    { opciones: ['ensalada-mixta', 'brocoli-cocido', 'habichuela', 'zanahoria-cocida', 'ahuyama-cocida'] },
    { opciones: ['aguacate'], opcional: true },
  ],
  cena: [
    { opciones: ['pechuga', 'huevo-cocido', 'tilapia', 'atun-lata-agua', 'queso-campesino', 'salmon'] },
    { opciones: ['ensalada-mixta', 'espinaca', 'brocoli-cocido', 'calabacin', 'tomate'] },
    { opciones: ['arepa-maiz-blanco', 'pan-integral', 'papa-criolla', 'aguacate'] },
  ],
  snack: [
    { opciones: ['yogur-griego', 'kumis', 'banano', 'manzana-roja', 'mango', 'almendras', 'mani'] },
    { opciones: ['fresa', 'arandano', 'granola', 'avena-hojuelas'], opcional: true },
  ],
};
// Alimento cuya porción se ajusta: el carbohidrato en desayuno y almuerzo; la proteína en cena; el primero en snack
const BASE: Record<ComidaId, number> = { des: 0, alm: 1, cena: 0, snack: 0 };

// Minutos de preparación estimados por categoría (lo crudo o listo casi no toma tiempo)
const MINUTOS: Record<string, number> = { proteinas: 20, carbohidratos: 15, verduras: 10, frutas: 5, lacteos: 2, grasas: 2, bebidas: 5 };

export interface Recomendacion { items: ItemOpcion[]; nombre: string; kcal: number; tiempo_min: number }

// Porciones que se ven en un plato real: ningún alimento baja de ½ ni pasa de 2½ porciones
const MIN_Q = 0.5, MAX_Q = 2.5;
const medio = (n: number) => Math.min(MAX_Q, Math.max(MIN_Q, Math.round(n * 2) / 2));

export function recomendar(comida: ComidaId, semilla: number, presupuesto: number, porId: Map<string, AlimentoDB>): Recomendacion | null {
  const elegir = (conOpcionales: boolean) => {
    const ids: string[] = [];
    GRUPOS[comida].forEach((g, gi) => {
      if (g.opcional && !conOpcionales) return;
      const disponibles = g.opciones.filter(id => porId.has(id));
      if (!disponibles.length) return;
      const id = disponibles[(semilla * (gi + 3) + gi * 5 + Math.floor(semilla / 3)) % disponibles.length];
      if (!ids.includes(id)) ids.push(id);
    });
    return ids;
  };
  const kcalDe = (items: ItemOpcion[]) => items.reduce((a, it) => a + nutrientes(porId.get(it.alimento_id)!, it.cantidad).kcal, 0);

  // 1) Escala juntos los alimentos que llenan (proteína, carbohidrato, fruta…) hacia el presupuesto,
  //    dentro de porciones reales. Verduras y bebidas se quedan en 1 porción.
  const fija = (id: string) => ['verduras', 'bebidas'].includes(porId.get(id)!.categoria);
  const armar = (ids: string[]) => {
    const items: ItemOpcion[] = ids.map(id => ({ alimento_id: id, cantidad: 1 }));
    const kFija = kcalDe(items.filter(it => fija(it.alimento_id)));
    const kEscala = kcalDe(items.filter(it => !fija(it.alimento_id)));
    const f = Math.max(0, presupuesto - kFija) / (kEscala || 1);
    items.forEach(it => { if (!fija(it.alimento_id)) it.cantidad = medio(f); });
    return items;
  };
  let items = armar(elegir(semilla % 2 === 0));
  if (!items.length) return null;
  // 2) Si todavía falta mucho, se suma el acompañante opcional
  if (kcalDe(items) < presupuesto * 0.85) {
    const conTodo = armar(elegir(true));
    if (conTodo.length > items.length) items = conTodo;
  }
  // 3) Ajuste fino con el alimento base, sin salirse de las porciones reales
  const b = Math.min(BASE[comida], items.length - 1);
  for (let k = 0; k < 6; k++) {
    const t = kcalDe(items);
    if (t < presupuesto * 0.92 && items[b].cantidad < MAX_Q) items[b].cantidad += 0.5;
    else if (t > presupuesto * 1.08 && items[b].cantidad > MIN_Q) items[b].cantidad -= 0.5;
    else break;
  }
  const kcal = () => kcalDe(items);
  const nombres = items.map(i => porId.get(i.alimento_id)!.nombre);
  const resto = nombres.slice(1).map(x => x.toLowerCase());
  const nombre = nombres.length === 1 ? nombres[0]
    : `${nombres[0]} con ${resto.length === 1 ? resto[0] : resto.slice(0, -1).join(', ') + ' y ' + resto[resto.length - 1]}`;
  const tiempos = items.map(i => MINUTOS[porId.get(i.alimento_id)!.categoria] ?? 5);
  const tiempo_min = Math.max(...tiempos) + (items.length > 2 ? 5 : 0);
  return { items, nombre, kcal: Math.round(kcal()), tiempo_min };
}
