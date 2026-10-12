import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Porcion { texto: string; gramos: number }
export interface AlimentoDB {
  id: string;
  nombre: string;
  sinonimos: string[];
  categoria: string;
  fuente: string;
  por_100g: Record<string, number>;
  porciones: Porcion[];
  porcion_base: Porcion;
  foto_url: string | null;
  busqueda: string;
}

export const CATEGORIAS: Record<string, string> = {
  frutas: 'Frutas', verduras: 'Verduras', carbohidratos: 'Cereales y harinas', proteinas: 'Proteínas',
  lacteos: 'Lácteos', grasas: 'Grasas y frutos secos', bebidas: 'Bebidas',
};

// Valores diarios de referencia (FDA) para calcular el % de cada vitamina y mineral
export const VITAMINAS: [string, string, number][] = [
  ['vit_a_ug', 'Vitamina A', 900], ['vit_c_mg', 'Vitamina C', 90], ['vit_d_ug', 'Vitamina D', 20], ['vit_e_mg', 'Vitamina E', 15],
  ['vit_k_ug', 'Vitamina K', 120], ['b1_mg', 'Tiamina (B1)', 1.2], ['b2_mg', 'Riboflavina (B2)', 1.3], ['b3_mg', 'Niacina (B3)', 16],
  ['b6_mg', 'Vitamina B6', 1.7], ['folato_ug', 'Folato', 400], ['b12_ug', 'Vitamina B12', 2.4],
];
export const MINERALES: [string, string, number][] = [
  ['calcio_mg', 'Calcio', 1300], ['hierro_mg', 'Hierro', 18], ['magnesio_mg', 'Magnesio', 420], ['fosforo_mg', 'Fósforo', 1250],
  ['potasio_mg', 'Potasio', 4700], ['zinc_mg', 'Zinc', 11], ['cobre_mg', 'Cobre', 0.9], ['manganeso_mg', 'Manganeso', 2.3], ['selenio_ug', 'Selenio', 55],
];

export const FOTOS = 'https://sergiosaacx.github.io/kalo/fotos/';
export const fotoDe = (a: AlimentoDB) => a.foto_url ?? null;

export const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Nutrientes de una cantidad (en porciones base)
// «Añadidos»: lo que se le pone a un alimento (panela al café, aceite al arroz, lo de un batido)
export interface Anadido { alimento_id: string; cantidad: number }

// Un alimento con sus añadidos: suma todo (lo que no esté en el catálogo no cuenta)
export function nutrientesItem(it: { alimento_id: string; cantidad: number; anadidos?: Anadido[] | null }, porId: Map<string, AlimentoDB> = mapaCache()) {
  const partes = [it, ...(it.anadidos ?? [])].filter(x => porId.has(x.alimento_id)).map(x => nutrientes(porId.get(x.alimento_id)!, x.cantidad));
  const n = (k: string) => partes.reduce((t, x) => t + x.n(k), 0);
  return { g: partes.reduce((t, x) => t + x.g, 0), kcal: n('kcal'), p: n('proteina_g'), c: n('carbos_g'), gr: n('grasa_g'), n };
}

export function nutrientes(a: AlimentoDB, cantidad: number) {
  const g = a.porcion_base.gramos * cantidad;
  const n = (k: string) => (a.por_100g[k] ?? 0) * g / 100;
  return { g, kcal: n('kcal'), p: n('proteina_g'), c: n('carbos_g'), gr: n('grasa_g'), n };
}

// Se descargan una vez por sesión: son ~360 alimentos
let cache: AlimentoDB[] | null = null;
let mapa: Map<string, AlimentoDB> | null = null;
// El catálogo como mapa por id (para sumar añadidos donde no hay uno a la mano)
export const mapaCache = () => (mapa ??= new Map((cache ?? []).map(a => [a.id, a])));
let pendiente: Promise<AlimentoDB[]> | null = null;
function cargar() {
  if (cache) return Promise.resolve(cache);
  pendiente ??= (async () => {
    const { data, error } = await supabase.from('alimentos').select('*').order('nombre');
    if (error) { pendiente = null; throw error; }
    cache = data as AlimentoDB[];
    mapa = null;
    return cache;
  })();
  return pendiente;
}

export function useAlimentos() {
  const [lista, setLista] = useState<AlimentoDB[] | null>(cache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (cache) return;
    cargar().then(setLista).catch(() => setError('No pudimos cargar los alimentos. Revisa tu conexión e inténtalo de nuevo.'));
  }, []);
  return { lista, error };
}
