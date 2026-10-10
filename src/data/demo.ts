// Datos de ejemplo del prototipo, mientras se conecta Supabase.
import { AVATAR_COLORS } from '../theme';
import type { Perfil } from '../logic/energia';

export interface Alimento {
  id: string;
  nombre: string;
  porcion: string;
  kcal: number;
  p: number;
  c: number;
  g: number;
}

export const ALIMENTOS: Record<string, Alimento> = Object.fromEntries(
  ([
    ['avena', 'Avena en hojuelas', '40 g', 152, 5.3, 27, 2.8],
    ['banano', 'Banano', '1 mediano · 118 g', 105, 1.3, 27, 0.4],
    ['pechuga', 'Pechuga de pollo', '120 g, a la plancha', 198, 37, 0, 4.3],
    ['arroz', 'Arroz blanco cocido', '1 taza · 158 g', 205, 4.3, 45, 0.4],
    ['aguacate', 'Aguacate', '½ unidad · 100 g', 160, 2, 8.5, 14.7],
    ['salmon', 'Salmón', '120 g, al horno', 250, 24, 0, 16],
    ['yogur', 'Yogur griego natural', '170 g', 100, 17, 6, 0.7],
  ] as const).map(([id, nombre, porcion, kcal, p, c, g]) => [id, { id, nombre, porcion, kcal, p, c, g }]),
);

export const PERFIL_DEMO: Perfil = {
  id: 'laura', nombre: 'Laura', edad: 34, sexo: 'F', estatura: 165, peso: 68, pesoInicial: 72,
  meta: 'bajar', pesoMeta: 62, ritmo: 0.5, trabajo: 'sentado', pasos: 7000, ejercicio: 30, sueno: 7,
  color: AVATAR_COLORS[0],
};

export type ComidaId = 'des' | 'alm' | 'cena' | 'snack';
export const COMIDAS: [ComidaId, string][] = [['des', 'Desayuno'], ['alm', 'Almuerzo'], ['cena', 'Cena'], ['snack', 'Snacks']];

export interface Item { id: string; q: number; comido: boolean }

export const PLAN_HOY: Record<ComidaId, Item[]> = {
  des: [{ id: 'yogur', q: 1, comido: true }, { id: 'avena', q: 1, comido: true }],
  alm: [{ id: 'salmon', q: 1, comido: true }, { id: 'arroz', q: 1, comido: true }],
  cena: [{ id: 'pechuga', q: 1, comido: false }, { id: 'aguacate', q: 1, comido: false }],
  snack: [{ id: 'banano', q: 1, comido: false }],
};
