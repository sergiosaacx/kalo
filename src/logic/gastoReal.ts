// Gasto real: lo que el cuerpo gasta de verdad, medido con lo que la persona come y lo que cambia su peso.
// gasto = promedio comido − (cambio de peso en kg/día × 7.700 kcal)
import type { Dia } from '../data/historial';
import { dias, sumarDias, type RegistroPeso } from './peso';

export const DIAS_MIN = 10, PESOS_MIN = 2, VENTANA = 28, SEPARACION_PESOS = 7;

export type Medicion =
  | { listo: false; diasValidos: number; pesos: number; separados: boolean }
  | { listo: true; diasValidos: number; pesos: number; gasto: number; promedio: number; cambioKg: number; diasMedidos: number };

// Un día cuenta si tiene al menos 2 comidas con algo marcado como comido. Hoy no cuenta (va en curso).
export function medirGastoReal(porDia: Map<string, Dia>, pesos: RegistroPeso[], hoy: string): Medicion {
  const desde = sumarDias(hoy, -VENTANA);
  const validos = [...porDia.values()].filter(d => d.fecha >= desde && d.fecha < hoy && d.comidas >= 2).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ps = pesos.filter(r => r.fecha >= desde && r.fecha <= hoy);
  const separados = ps.length >= 2 && dias(ps[0].fecha, ps[ps.length - 1].fecha) >= SEPARACION_PESOS;
  if (validos.length < DIAS_MIN || ps.length < PESOS_MIN || !separados) return { listo: false, diasValidos: validos.length, pesos: ps.length, separados };

  const promedio = validos.reduce((t, d) => t + d.kcal, 0) / validos.length;
  // Tendencia del peso (kg por día) por mínimos cuadrados: un pesaje raro pesa poco
  const x = ps.map(r => dias(ps[0].fecha, r.fecha)), y = ps.map(r => r.peso);
  const mx = x.reduce((a, b) => a + b, 0) / x.length, my = y.reduce((a, b) => a + b, 0) / y.length;
  const den = x.reduce((a, xi) => a + (xi - mx) ** 2, 0);
  const kgDia = den === 0 ? 0 : x.reduce((a, xi, i) => a + (xi - mx) * (y[i] - my), 0) / den;
  const gasto = Math.round((promedio - kgDia * 7700) / 10) * 10;
  const diasMedidos = dias(validos[0].fecha, validos[validos.length - 1].fecha) + 1;
  return { listo: true, diasValidos: validos.length, pesos: ps.length, gasto, promedio: Math.round(promedio), cambioKg: Math.round(kgDia * diasMedidos * 10) / 10, diasMedidos };
}
