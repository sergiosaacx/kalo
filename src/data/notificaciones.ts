// Notificaciones (Web Push) en este celular: permiso de Apple/Android + suscripción guardada en la cuenta.
// En iPhone solo funcionan con Kalo instalada en la pantalla de inicio (iOS 16.4 o más).
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Llave pública VAPID (la privada vive solo en los secretos de Supabase)
const VAPID_PUBLICA = 'BEHu472LfzR3ushQ14EU9uStat0MpVDdg4jiKiEMAaH1qMhMLsKBEsg5npyToUw9Yh13YBn7QeMjROFGqSL_l9c';
const BASE = '/kalo';
const PREGUNTADO = 'kalo_notif_preguntado'; // este celular ya vio el letrero
const DUENO = 'kalo_celular_de';            // «Este celular es de…»: id del perfil (o nada = de todos)

export const duenoCelular = () => { try { return localStorage.getItem(DUENO); } catch { return null; } };

// Asigna este celular a un perfil (o a todos con null): Kalo abre con ese perfil y solo le llegan sus notificaciones
export async function asignarCelular(perfilId: string | null) {
  try { if (perfilId) localStorage.setItem(DUENO, perfilId); else localStorage.removeItem(DUENO); } catch { /* sin almacenamiento */ }
  if (!web || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration(`${BASE}/`);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await supabase.from('suscripciones_push').update({ perfil_id: perfilId }).eq('endpoint', sub.endpoint);
  } catch { /* sin suscripción todavía: se asigna al suscribirse */ }
}

export type EstadoNotif = 'no-soportado' | 'instalar' | 'preguntar' | 'activadas' | 'bloqueadas';

const web = Platform.OS === 'web' && typeof window !== 'undefined';
const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function estadoNotif(): EstadoNotif {
  if (!web) return 'no-soportado';
  if (esIOS() && !instalada()) return 'instalar';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no-soportado';
  const p = Notification.permission;
  return p === 'granted' ? 'activadas' : p === 'denied' ? 'bloqueadas' : 'preguntar';
}

export const yaPreguntado = () => { try { return localStorage.getItem(PREGUNTADO) === '1'; } catch { return false; } };
export const marcarPreguntado = () => { try { localStorage.setItem(PREGUNTADO, '1'); } catch { /* sin almacenamiento: se volverá a preguntar */ } };

const aBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

async function registro() {
  await navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` });
  return navigator.serviceWorker.ready;
}

// Crea (o reutiliza) la suscripción de este celular y la guarda en la cuenta actual
async function suscribir(): Promise<string | null> {
  try {
    const reg = await registro();
    const sub = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLICA) });
    const j = sub.toJSON();
    const { error } = await supabase.rpc('guardar_suscripcion', {
      p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_dispositivo: navigator.userAgent,
    });
    if (error) return 'No pudimos guardar las notificaciones. Inténtalo de nuevo.';
    const dueno = duenoCelular();
    if (dueno) await supabase.from('suscripciones_push').update({ perfil_id: dueno }).eq('endpoint', j.endpoint!);
    return null;
  } catch {
    return 'No pudimos activar las notificaciones en este celular.';
  }
}

// Llamar directo desde el toque del botón: así aparece el letrero de Apple
export async function activarNotificaciones(): Promise<{ estado: EstadoNotif; error: string | null }> {
  marcarPreguntado();
  if (estadoNotif() === 'no-soportado' || estadoNotif() === 'instalar') return { estado: estadoNotif(), error: null };
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return { estado: estadoNotif(), error: null };
  const error = await suscribir();
  return { estado: 'activadas', error };
}

// Al abrir la app con sesión: deja listo el service worker y, si ya hay permiso, la suscripción al día en esta cuenta
export async function sincronizarNotificaciones() {
  if (!web || !('serviceWorker' in navigator)) return;
  try {
    if (estadoNotif() === 'activadas') await suscribir();
    else await registro();
  } catch { /* sin service worker no hay avisos, la app sigue igual */ }
}

// Al cerrar sesión: este celular deja de recibir los avisos de esta cuenta
export async function soltarEsteCelular() {
  if (!web || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration(`${BASE}/`);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await supabase.from('suscripciones_push').delete().eq('endpoint', sub.endpoint);
  } catch { /* nada que soltar */ }
}
