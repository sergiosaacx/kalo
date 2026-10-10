// Fórmulas del handoff (README › Lógica de negocio). Replicar exactamente.

export type Sexo = 'F' | 'M';
export type Meta = 'bajar' | 'mantener' | 'subir';
export type Trabajo = 'sentado' | 'pie' | 'fisico';

export interface Perfil {
  id: string;
  nombre: string;
  edad: number;
  sexo: Sexo;
  estatura: number; // cm
  peso: number; // kg
  pesoInicial: number;
  meta: Meta;
  pesoMeta: number;
  ritmo: number; // kg/semana
  trabajo: Trabajo;
  pasos: number;
  ejercicio: number; // min/día
  sueno: number; // h
  color: string;
}

const TRABAJO_KCAL: Record<Trabajo, number> = { sentado: 0, pie: 180, fisico: 380 };

export const PRESUPUESTO = { des: 0.25, alm: 0.35, cena: 0.3, snack: 0.1 } as const;

export function gasto(p: Perfil) {
  const basal = Math.round(10 * p.peso + 6.25 * p.estatura - 5 * p.edad + (p.sexo === 'M' ? 5 : -161));
  const vidaDiaria = Math.round(basal * 0.15);
  const trabajo = TRABAJO_KCAL[p.trabajo];
  const pasos = Math.round(p.pasos * 0.04 * p.peso / 70);
  const ejercicio = Math.round(p.ejercicio * 6.5 * p.peso / 70);
  const subtotal = basal + vidaDiaria + trabajo + pasos + ejercicio;
  const digestion = Math.round(subtotal * 0.08);
  const total = subtotal + digestion;
  const ajuste = p.meta === 'bajar' ? -Math.round(p.ritmo * 1100) : p.meta === 'subir' ? Math.round(p.ritmo * 1100) : 0;
  return { basal, vidaDiaria, trabajo, pasos, ejercicio, digestion, total, ajuste, objetivo: Math.max(1200, total + ajuste) };
}

export function macrosObjetivo(p: Perfil, objetivo: number) {
  const proteina = Math.round(p.peso * 1.6);
  const grasa = Math.round(objetivo * 0.28 / 9);
  const carbos = Math.round((objetivo - proteina * 4 - grasa * 9) / 4);
  return { proteina, carbos, grasa };
}

export const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');
export const conSigno = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
