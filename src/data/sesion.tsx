import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { asignarCelular, duenoCelular, soltarEsteCelular } from './notificaciones';
import { edadDe, type Meta, type Perfil, type Salud, type Sexo, type Trabajo } from '../logic/energia';
import type { Rutina } from '../logic/actividad';
import { AVATAR_COLORS } from '../theme';

// Fila de public.perfiles
interface PerfilDB {
  id: string; nombre: string; edad: number; sexo: Sexo; estatura_cm: number; peso_kg: number; peso_inicial_kg: number;
  meta: Meta; peso_meta_kg: number; ritmo_kg_semana: number; trabajo: Trabajo; pasos_dia: number; ejercicio_min: number;
  sueno_h: number; color: string; activo: boolean; fecha_nacimiento: string | null; rutina: Rutina | null;
  ajuste_kcal: number; ajuste_desde: string | null; salud: Salud | null;
  comidas: Perfil['comidas']; recordar: boolean;
  gasto_real: number | null; gasto_real_fecha: string | null; pesarse: Perfil['pesarse'];
}

const desdeDB = (r: PerfilDB): Perfil & { activo: boolean } => ({
  id: r.id, nombre: r.nombre, edad: r.fecha_nacimiento ? edadDe(r.fecha_nacimiento) : r.edad,
  fechaNacimiento: r.fecha_nacimiento ?? undefined, rutina: r.rutina ?? undefined, sexo: r.sexo, estatura: Number(r.estatura_cm), peso: Number(r.peso_kg),
  pesoInicial: Number(r.peso_inicial_kg), meta: r.meta, pesoMeta: Number(r.peso_meta_kg), ritmo: Number(r.ritmo_kg_semana),
  trabajo: r.trabajo, pasos: r.pasos_dia, ejercicio: r.ejercicio_min, sueno: Number(r.sueno_h), color: r.color, activo: r.activo,
  ajusteKcal: r.ajuste_kcal ?? 0, ajusteDesde: r.ajuste_desde ?? undefined, salud: r.salud, comidas: r.comidas, recordar: r.recordar,
  gastoReal: r.gasto_real, gastoRealFecha: r.gasto_real_fecha, pesarse: r.pesarse,
});

const haciaDB = (p: Partial<Perfil>) => {
  const m: Record<string, unknown> = {};
  if (p.nombre !== undefined) m.nombre = p.nombre;
  if (p.edad !== undefined) m.edad = p.edad;
  if (p.fechaNacimiento !== undefined) { m.fecha_nacimiento = p.fechaNacimiento; m.edad = edadDe(p.fechaNacimiento); }
  if (p.sexo !== undefined) m.sexo = p.sexo;
  if (p.estatura !== undefined) m.estatura_cm = p.estatura;
  if (p.peso !== undefined) m.peso_kg = p.peso;
  if (p.pesoInicial !== undefined) m.peso_inicial_kg = p.pesoInicial;
  if (p.meta !== undefined) m.meta = p.meta;
  if (p.pesoMeta !== undefined) m.peso_meta_kg = p.pesoMeta;
  if (p.ritmo !== undefined) m.ritmo_kg_semana = p.ritmo;
  if (p.trabajo !== undefined) m.trabajo = p.trabajo;
  if (p.pasos !== undefined) m.pasos_dia = p.pasos;
  if (p.ejercicio !== undefined) m.ejercicio_min = p.ejercicio;
  if (p.sueno !== undefined) m.sueno_h = p.sueno;
  if (p.color !== undefined) m.color = p.color;
  if (p.rutina !== undefined) m.rutina = p.rutina;
  if (p.ajusteKcal !== undefined) m.ajuste_kcal = p.ajusteKcal;
  if (p.ajusteDesde !== undefined) m.ajuste_desde = p.ajusteDesde;
  if (p.salud !== undefined) m.salud = p.salud;
  if (p.comidas !== undefined) m.comidas = p.comidas;
  if (p.recordar !== undefined) m.recordar = p.recordar;
  if (p.gastoReal !== undefined) m.gasto_real = p.gastoReal;
  if (p.gastoRealFecha !== undefined) m.gasto_real_fecha = p.gastoRealFecha;
  if (p.pesarse !== undefined) m.pesarse = p.pesarse;
  return m;
};

export type PerfilActivo = Perfil & { activo: boolean };

interface Ctx {
  cargando: boolean;
  sesion: Session | null;
  perfiles: PerfilActivo[];
  activo: PerfilActivo | null;
  crearPerfil: (p: Omit<Perfil, 'id' | 'color'>) => Promise<string | null>;
  actualizarPerfil: (id: string, p: Partial<Perfil>) => Promise<string | null>;
  activar: (id: string) => Promise<void>;
  borrarPerfil: (id: string) => Promise<string | null>;
  salir: () => Promise<void>;
}

const SesionCtx = createContext<Ctx | null>(null);
export const useSesion = () => {
  const c = useContext(SesionCtx);
  if (!c) throw new Error('useSesion fuera de SesionProvider');
  return c;
};

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilActivo[]>([]);
  const [cargando, setCargando] = useState(true);
  // Perfil activo de ESTE celular (no de la cuenta): arranca en el dueño del celular o en el último que se usó aquí
  const [activoLocal, setActivoLocal] = useState<string | null>(() => {
    try { return duenoCelular() ?? localStorage.getItem('kalo_activo'); } catch { return null; }
  });
  const usarLocal = (id: string) => { setActivoLocal(id); try { localStorage.setItem('kalo_activo', id); } catch { /* sin almacenamiento */ } };

  const cargarPerfiles = useCallback(async () => {
    const { data } = await supabase.from('perfiles').select('*').order('creado');
    setPerfiles((data as PerfilDB[] | null ?? []).map(desdeDB));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session);
      if (data.session) await cargarPerfiles();
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSesion(s);
      if (s) cargarPerfiles(); else setPerfiles([]);
    });
    return () => sub.subscription.unsubscribe();
  }, [cargarPerfiles]);

  const activar = useCallback(async (id: string) => {
    usarLocal(id);
    setPerfiles(ps => ps.map(p => ({ ...p, activo: p.id === id })));
    await supabase.rpc('activar_perfil', { p: id });
  }, []);

  const crearPerfil = useCallback(async (p: Omit<Perfil, 'id' | 'color'>) => {
    const color = AVATAR_COLORS[perfiles.length % AVATAR_COLORS.length];
    const { data, error } = await supabase.from('perfiles').insert({ ...haciaDB({ ...p, color }) }).select('id').single();
    if (error || !data) return 'No pudimos crear el perfil. Revisa tu conexión e inténtalo de nuevo.';
    await supabase.rpc('activar_perfil', { p: data.id });
    usarLocal(data.id);
    await cargarPerfiles();
    return null;
  }, [perfiles.length, cargarPerfiles]);

  const actualizarPerfil = useCallback(async (id: string, p: Partial<Perfil>) => {
    setPerfiles(ps => ps.map(x => (x.id === id ? { ...x, ...p } : x)));
    const { error } = await supabase.from('perfiles').update(haciaDB(p)).eq('id', id);
    if (error) { await cargarPerfiles(); return 'No pudimos guardar los cambios. Inténtalo de nuevo.'; }
    return null;
  }, [cargarPerfiles]);

  // Borra el perfil y todo lo suyo (comidas, pesos, avisos: en cascada). Si era el activo, queda activo otro.
  const borrarPerfil = useCallback(async (id: string) => {
    const resto = perfiles.filter(p => p.id !== id);
    if (resto.length === 0) return 'No puedes borrar el único perfil de la cuenta.';
    const eraActivo = (perfiles.find(p => p.id === activoLocal) ?? perfiles.find(p => p.activo) ?? perfiles[0])?.id === id;
    const { error } = await supabase.from('perfiles').delete().eq('id', id);
    if (error) return 'No pudimos borrar el perfil. Revisa tu conexión e inténtalo de nuevo.';
    if (eraActivo) { await supabase.rpc('activar_perfil', { p: resto[0].id }); usarLocal(resto[0].id); }
    if (duenoCelular() === id) await asignarCelular(null);
    await cargarPerfiles();
    return null;
  }, [perfiles, activoLocal, cargarPerfiles]);

  const salir = useCallback(async () => { await soltarEsteCelular(); await supabase.auth.signOut(); }, []);

  const activo = perfiles.find(p => p.id === activoLocal) ?? perfiles.find(p => p.activo) ?? perfiles[0] ?? null;
  return (
    <SesionCtx.Provider value={{ cargando, sesion, perfiles, activo, crearPerfil, actualizarPerfil, activar, borrarPerfil, salir }}>
      {children}
    </SesionCtx.Provider>
  );
}
