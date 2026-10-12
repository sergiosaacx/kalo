// Bandeja: los alimentos que se van agregando a una comida antes de tocar «Listo».
// Vive fuera de las pantallas para que la barra de abajo (en App) y el buscador la compartan.
import { useEffect, useState } from 'react';
import { nutrientes, type AlimentoDB } from './alimentos';

export interface AnadidoBandeja { alimento: AlimentoDB; cantidad: number; texto: string }
export interface ItemBandeja { alimento: AlimentoDB; cantidad: number; texto: string; anadidos?: AnadidoBandeja[] }

// Calorías de un ítem de la bandeja con sus añadidos
export const kcalBandeja = (it: ItemBandeja) =>
  nutrientes(it.alimento, it.cantidad).kcal + (it.anadidos ?? []).reduce((t, x) => t + nutrientes(x.alimento, x.cantidad).kcal, 0);
// Para guardar: los añadidos van como { alimento_id, cantidad }
export const anadidosParaGuardar = (it: ItemBandeja) =>
  it.anadidos?.length ? it.anadidos.map(x => ({ alimento_id: x.alimento.id, cantidad: x.cantidad })) : null;

let items: ItemBandeja[] = [];
let ultimo: { texto: string; en: number } | null = null; // para el aviso «… en la bandeja»
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach(f => f());

export const bandeja = {
  agregar(it: ItemBandeja) { items = [...items, it]; ultimo = { texto: `${it.alimento.nombre} · ${it.texto} en la bandeja`, en: Date.now() }; avisar(); },
  // Una opción completa: todos sus alimentos de una vez
  agregarVarios(lista: ItemBandeja[], aviso: string) { items = [...items, ...lista]; ultimo = { texto: aviso, en: Date.now() }; avisar(); },
  quitar(k: number) { items = items.filter((_, j) => j !== k); ultimo = null; avisar(); },
  vaciar() { items = []; ultimo = null; avisar(); },
};

export function useBandeja() {
  const [, setV] = useState(0);
  useEffect(() => {
    const f = () => setV(v => v + 1);
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);
  return { items, ultimo };
}
