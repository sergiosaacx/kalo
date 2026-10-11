// Fórmulas del handoff (README › Lógica de negocio). Con «Tu día», el gasto sale de logic/actividad.ts.
import { gastoPorRutina, type Rutina } from './actividad';

export type Sexo = 'F' | 'M';
export type Meta = 'bajar' | 'mantener' | 'subir';
export type Trabajo = 'sentado' | 'pie' | 'fisico';

export interface Perfil {
  id: string;
  nombre: string;
  edad: number;          // se calcula de fechaNacimiento cuando la hay
  fechaNacimiento?: string; // YYYY-MM-DD
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
  rutina?: Rutina; // «Tu día»: si existe, el gasto se calcula con ella
}

const TRABAJO_KCAL: Record<Trabajo, number> = { sentado: 0, pie: 180, fisico: 380 };

// Edad cumplida a hoy desde una fecha YYYY-MM-DD
export function edadDe(fecha: string, hoy = new Date()) {
  const [a, m, d] = fecha.split('-').map(Number);
  let edad = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
  return edad;
}

// Día, mes y año escritos → YYYY-MM-DD, o null si la fecha no existe
export function fechaValida(dia: string, mes: string, anio: string): string | null {
  const d = parseInt(dia, 10), m = parseInt(mes, 10), a = parseInt(anio, 10);
  if (!(a >= 1900 && m >= 1 && m <= 12 && d >= 1)) return null;
  const f = new Date(a, m - 1, d);
  if (f.getFullYear() !== a || f.getMonth() !== m - 1 || f.getDate() !== d) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Mensaje para la persona si la fecha de nacimiento no sirve (null si está bien)
export function errorFecha(dia: string, mes: string, anio: string): string | null {
  if (!dia || !mes || anio.length < 4) return 'Escribe la fecha de nacimiento completa, por ejemplo 15 / 04 / 1995.';
  const f = fechaValida(dia, mes, anio);
  if (!f) return 'Esa fecha no existe, revísala.';
  if (edadDe(f) < 10 || edadDe(f) > 100) return 'Revisa el año de nacimiento.';
  return null;
}

export const PRESUPUESTO = { des: 0.25, alm: 0.35, cena: 0.3, snack: 0.1 } as const;

export const basalDe = (p: Pick<Perfil, 'peso' | 'estatura' | 'edad' | 'sexo'>) =>
  Math.round(10 * p.peso + 6.25 * p.estatura - 5 * p.edad + (p.sexo === 'M' ? 5 : -161));

export function gasto(p: Perfil) {
  const basal = basalDe(p);
  const ajuste = p.meta === 'bajar' ? -Math.round(p.ritmo * 1100) : p.meta === 'subir' ? Math.round(p.ritmo * 1100) : 0;
  // Con «Tu día»: método factorial hora por hora (logic/actividad.ts)
  if (p.rutina) {
    const r = gastoPorRutina(basal, p.rutina);
    return { basal, total: r.total, partes: r.partes, ajuste, objetivo: Math.max(1200, r.total + ajuste) };
  }
  const vidaDiaria = Math.round(basal * 0.15);
  const trabajo = TRABAJO_KCAL[p.trabajo];
  const pasos = Math.round(p.pasos * 0.04 * p.peso / 70);
  const ejercicio = Math.round(p.ejercicio * 6.5 * p.peso / 70);
  const subtotal = basal + vidaDiaria + trabajo + pasos + ejercicio;
  const digestion = Math.round(subtotal * 0.08);
  const total = subtotal + digestion;
  return { basal, total, partes: null, ajuste, objetivo: Math.max(1200, total + ajuste) };
}

export function macrosObjetivo(p: Perfil, objetivo: number) {
  const proteina = Math.round(p.peso * 1.6);
  const grasa = Math.round(objetivo * 0.28 / 9);
  const carbos = Math.round((objetivo - proteina * 4 - grasa * 9) / 4);
  return { proteina, carbos, grasa };
}

export const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');
export const conSigno = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
