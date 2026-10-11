// Gasto calórico por método factorial (FAO/OMS/UNU 2004): metabolismo basal × promedio de la exigencia
// de cada actividad hora por hora. Las exigencias (MET) salen del Compendio de Actividades Físicas.

export type Ocupacion = 'trabajo' | 'estudio' | 'ambos' | 'hogar' | 'ninguna';
export type Transporte = 'caminando' | 'bici' | 'bus' | 'moto' | 'carro' | 'casa';
export type Casa = 'nada' | 'rato' | 'bastante' | 'todo';
export type Intensidad = 'suave' | 'moderada' | 'fuerte';

export const OFICIOS: { id: string; nombre: string; ej: string; met: number }[] = [
  { id: 'oficina', nombre: 'Oficina', ej: 'computador, call center', met: 1.5 },
  { id: 'atencion', nombre: 'Atención al público', ej: 'vendedor, recepción', met: 2.0 },
  { id: 'docente', nombre: 'Docente', ej: 'profesor, instructor', met: 2.3 },
  { id: 'salud', nombre: 'Salud', ej: 'enfermería, auxiliar', met: 3.0 },
  { id: 'restaurante', nombre: 'Restaurante', ej: 'mesero, cocinero', met: 2.8 },
  { id: 'comercio', nombre: 'Comercio', ej: 'cajero, tienda, bodega', met: 2.5 },
  { id: 'belleza', nombre: 'Belleza', ej: 'peluquería, uñas', met: 2.5 },
  { id: 'conductor', nombre: 'Conductor', ej: 'taxi, bus, camión', met: 1.8 },
  { id: 'domi-moto', nombre: 'Domicilios en moto', ej: 'mensajería', met: 2.3 },
  { id: 'domi-bici', nombre: 'Domicilios en bici', ej: 'mensajería', met: 4.5 },
  { id: 'aseo', nombre: 'Aseo', ej: 'limpieza, oficios varios', met: 3.3 },
  { id: 'construccion', nombre: 'Construcción', ej: 'obra, cargue', met: 4.5 },
  { id: 'campo', nombre: 'Campo', ej: 'agricultura, ganadería', met: 4.5 },
  { id: 'seguridad', nombre: 'Seguridad', ej: 'vigilante, portería', met: 1.8 },
];

export const TRANSPORTES: [Transporte, string, number][] = [
  ['caminando', 'Caminando', 3.5], ['bici', 'En bici', 6.8], ['bus', 'Bus, TransMilenio, MIO, metro', 1.5],
  ['moto', 'Moto', 2.5], ['carro', 'Carro', 1.5], ['casa', 'Trabajo desde la casa', 0],
];

export const CASA: [Casa, string, number][] = [
  ['nada', 'Casi nada de oficio', 0.25], ['rato', 'Un rato (1 hora)', 1], ['bastante', 'Bastante (2 a 3 horas)', 2.5], ['todo', 'Casi todo el día', 6],
];

export const EJERCICIOS: { id: string; nombre: string; met: Record<Intensidad, number> }[] = [
  { id: 'caminar', nombre: 'Caminar', met: { suave: 2.8, moderada: 3.5, fuerte: 5.0 } },
  { id: 'correr', nombre: 'Correr / trotar', met: { suave: 7.0, moderada: 9.0, fuerte: 11.0 } },
  { id: 'bici', nombre: 'Bici', met: { suave: 4.0, moderada: 6.8, fuerte: 10.0 } },
  { id: 'pesas', nombre: 'Gimnasio: pesas', met: { suave: 3.5, moderada: 5.0, fuerte: 6.0 } },
  { id: 'clases', nombre: 'Clases: rumba, spinning, funcional', met: { suave: 5.0, moderada: 6.5, fuerte: 8.5 } },
  { id: 'futbol', nombre: 'Fútbol', met: { suave: 5.0, moderada: 7.0, fuerte: 10.0 } },
  { id: 'balon', nombre: 'Baloncesto / voleibol', met: { suave: 4.0, moderada: 6.0, fuerte: 8.0 } },
  { id: 'natacion', nombre: 'Natación', met: { suave: 5.0, moderada: 7.0, fuerte: 9.8 } },
  { id: 'baile', nombre: 'Baile', met: { suave: 3.5, moderada: 5.0, fuerte: 7.0 } },
  { id: 'yoga', nombre: 'Yoga / pilates', met: { suave: 2.5, moderada: 3.0, fuerte: 4.0 } },
  { id: 'otro', nombre: 'Otro deporte', met: { suave: 3.5, moderada: 5.0, fuerte: 7.0 } },
];

const MET_SUENO = 0.95, MET_ESTUDIO = 1.5, MET_NINOS = 2.5, MET_CASA = 2.8, MET_RESTO = 1.4;

export interface Ejercicio { tipo: string; intensidad: Intensidad; minutos: number; dias: number }
export interface Rutina {
  levanta: number; acuesta: number;            // minutos desde medianoche
  ocupacion: Ocupacion;
  oficio: string | null;
  entrada: number; salida: number;             // minutos desde medianoche
  dias: boolean[];                             // lunes … domingo
  transporte: Transporte; trayectoMin: number; // ida y vuelta
  estudioHoras: number; estudioDias: number;   // solo si estudia además de trabajar
  casa: Casa; ninos: boolean;
  ejercicios: Ejercicio[];
}

export const RUTINA_INICIAL: Rutina = {
  levanta: 6 * 60, acuesta: 22 * 60, ocupacion: 'trabajo', oficio: null, entrada: 8 * 60, salida: 17 * 60,
  dias: [true, true, true, true, true, false, false], transporte: 'bus', trayectoMin: 60,
  estudioHoras: 4, estudioDias: 5, casa: 'rato', ninos: false, ejercicios: [],
};

const horasEntre = (a: number, b: number) => (((b - a) % 1440) + 1440) % 1440 / 60;
export const horasSueno = (r: Rutina) => horasEntre(r.acuesta, r.levanta);
export const horasJornada = (r: Rutina) => horasEntre(r.entrada, r.salida);
export const hora12 = (min: number) => {
  const h = Math.floor(min / 60) % 24, m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};

export interface Desglose { clave: string; nombre: string; kcal: number; horas: number }

// Gasto promedio de la semana y en qué se va
export function gastoPorRutina(basal: number, r: Rutina) {
  const porHora = basal / 24;
  const sueno = horasSueno(r);
  const trabaja = r.ocupacion === 'trabajo' || r.ocupacion === 'ambos' || r.ocupacion === 'estudio';
  const metJornada = r.ocupacion === 'estudio' ? MET_ESTUDIO : (OFICIOS.find(o => o.id === r.oficio)?.met ?? 2.0);
  const diasJornada = trabaja ? r.dias.filter(Boolean).length : 0;
  const jornada = trabaja ? horasJornada(r) : 0;
  const [, , metTrans] = TRANSPORTES.find(t => t[0] === r.transporte) ?? TRANSPORTES[2];
  const trayecto = trabaja && r.transporte !== 'casa' ? r.trayectoMin / 60 : 0;
  const estudioExtra = r.ocupacion === 'ambos' ? r.estudioHoras * r.estudioDias / 7 : 0;
  const casa = (CASA.find(c => c[0] === r.casa)?.[2] ?? 1);
  const ninos = r.ninos ? 2 : 0;

  // Promedio diario de horas por actividad (la jornada solo cuenta los días que se trabaja)
  const hJornada = jornada * diasJornada / 7, hTrans = trayecto * diasJornada / 7;
  const hEj = r.ejercicios.reduce((a, e) => a + e.minutos / 60 * e.dias / 7, 0);
  const kcalEj = r.ejercicios.reduce((a, e) => a + (EJERCICIOS.find(x => x.id === e.tipo)?.met[e.intensidad] ?? 5) * e.minutos / 60 * e.dias / 7, 0);
  const ocupadas = sueno + hJornada + hTrans + estudioExtra + casa + ninos + hEj;
  const resto = Math.max(0, 24 - ocupadas);

  const partes: Desglose[] = [
    { clave: 'sueno', nombre: 'Sueño', horas: sueno, kcal: sueno * MET_SUENO * porHora },
    { clave: 'jornada', nombre: r.ocupacion === 'estudio' ? 'Estudio' : 'Trabajo', horas: hJornada, kcal: hJornada * metJornada * porHora },
    { clave: 'estudio', nombre: 'Estudio', horas: estudioExtra, kcal: estudioExtra * MET_ESTUDIO * porHora },
    { clave: 'transporte', nombre: 'Transporte', horas: hTrans, kcal: hTrans * metTrans * porHora },
    { clave: 'casa', nombre: 'Oficio y niños', horas: casa + ninos, kcal: (casa * MET_CASA + ninos * MET_NINOS) * porHora },
    { clave: 'ejercicio', nombre: 'Ejercicio', horas: hEj, kcal: kcalEj * porHora },
    { clave: 'resto', nombre: 'Resto del día en casa', horas: resto, kcal: resto * MET_RESTO * porHora },
  ].filter(p => p.horas > 0.01);
  const total = partes.reduce((a, p) => a + p.kcal, 0);
  return { total: Math.round(total), partes, sobran: ocupadas > 24 ? ocupadas - 24 : 0, nivel: total / basal };
}
