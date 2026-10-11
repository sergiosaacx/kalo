// Meta de peso: avance, ritmo real y ajuste de calorías que Kalo propone (nunca lo aplica solo).
import type { Perfil } from './energia';

export interface RegistroPeso { fecha: string; peso: number } // fecha YYYY-MM-DD

const DIA = 864e5;
export const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DIA);
export const sumarDias = (f: string, n: number) => new Date(Date.parse(f) + n * DIA).toISOString().slice(0, 10);

// kg por semana hacia donde va la meta: subir +ritmo, bajar −ritmo, mantener 0
export const ritmoPlan = (p: Pick<Perfil, 'meta' | 'ritmo'>) => (p.meta === 'subir' ? p.ritmo : p.meta === 'bajar' ? -p.ritmo : 0);

// Fecha en que llegaría a la meta al ritmo del plan, contando desde una fecha y un peso
export function fechaMeta(p: Pick<Perfil, 'meta' | 'ritmo' | 'pesoMeta'>, desde: string, peso: number) {
  if (p.meta === 'mantener' || p.ritmo <= 0) return null;
  return sumarDias(desde, Math.ceil(Math.abs(p.pesoMeta - peso) / p.ritmo) * 7);
}

// ¿Ya llegó? (subir: peso ≥ meta; bajar: peso ≤ meta)
export const llego = (p: Pick<Perfil, 'meta' | 'pesoMeta'>, peso: number) =>
  (p.meta === 'subir' && peso >= p.pesoMeta) || (p.meta === 'bajar' && peso <= p.pesoMeta);

// Pendiente (kg/semana) por mínimos cuadrados: no se deja llevar por un solo pesaje raro
function pendiente(rs: RegistroPeso[]) {
  const x = rs.map(r => dias(rs[0].fecha, r.fecha) / 7), y = rs.map(r => r.peso);
  const mx = x.reduce((a, b) => a + b, 0) / x.length, my = y.reduce((a, b) => a + b, 0) / y.length;
  const num = x.reduce((a, xi, i) => a + (xi - mx) * (y[i] - my), 0), den = x.reduce((a, xi) => a + (xi - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

export interface Propuesta {
  real: number;        // kg/semana medidos (con signo)
  plan: number;        // kg/semana del plan (con signo)
  semanas: number;     // semanas medidas
  cambio: number;      // kcal a sumar (o restar) al día
  objetivoNuevo: number;
  llegaria: string | null; // a este ritmo, fecha de llegada (null = así no llega)
  lento: boolean;      // va más lento que el plan hacia su meta
}

// Solo con 3 pesos o más en al menos 2 semanas (desde el último ajuste aceptado) y si la diferencia pasa de 0,1 kg/semana.
// Cada 0,1 kg/semana ≈ 110 kcal/día; nunca más de 500 de una vez ni un objetivo por debajo de 1.200.
export function proponerAjuste(p: Perfil, registros: RegistroPeso[], objetivo: number): Propuesta | null {
  const rs = registros.filter(r => !p.ajusteDesde || r.fecha >= p.ajusteDesde);
  if (rs.length < 3) return null;
  const semanas = dias(rs[0].fecha, rs[rs.length - 1].fecha) / 7;
  if (semanas < 2) return null;
  const real = pendiente(rs), plan = ritmoPlan(p);
  const dif = plan - real;
  if (Math.abs(dif) <= 0.1) return null;
  let cambio = Math.round((dif * 1100) / 10) * 10;
  cambio = Math.max(-500, Math.min(500, cambio));
  const objetivoNuevo = Math.max(1200, objetivo + cambio);
  cambio = objetivoNuevo - objetivo;
  if (cambio === 0) return null;
  const ultimo = rs[rs.length - 1];
  const hacia = p.meta === 'subir' ? real : p.meta === 'bajar' ? -real : 0;
  const llegaria = p.meta !== 'mantener' && hacia > 0.02
    ? sumarDias(ultimo.fecha, Math.ceil((Math.abs(p.pesoMeta - ultimo.peso) / hacia) * 7)) : null;
  return { real, plan, semanas, cambio, objetivoNuevo, llegaria, lento: p.meta === 'mantener' ? false : hacia < Math.abs(plan) };
}
