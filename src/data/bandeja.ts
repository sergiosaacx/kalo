// Bandeja: los alimentos que se van agregando a una comida antes de tocar «Listo».
// Vive fuera de las pantallas para que la barra de abajo (en App) y el buscador la compartan.
import { useEffect, useState } from 'react';
import type { AlimentoDB } from './alimentos';

export interface ItemBandeja { alimento: AlimentoDB; cantidad: number; texto: string }

let items: ItemBandeja[] = [];
let ultimo: { texto: string; en: number } | null = null; // para el aviso «… en la bandeja»
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach(f => f());

export const bandeja = {
  agregar(it: ItemBandeja) { items = [...items, it]; ultimo = { texto: `${it.alimento.nombre} · ${it.texto} en la bandeja`, en: Date.now() }; avisar(); },
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
