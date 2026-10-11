// Kalo · recordatorios «¿Ya desayunaste?». La llama pg_cron cada minuto.
// A cada perfil con «recordar» prendido le manda la notificación a la hora de cada comida (hora de Colombia),
// salvo que ya la haya anotado o respondido. «Recuérdame en 30 min» la vuelve a mandar a la hora pospuesta.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Momento = 'des' | 'media' | 'alm' | 'snack' | 'cena';
interface ComidaHora { id: Momento; hora: string; on: boolean }

// Igual que src/data/comidas.ts
const DEFECTO: ComidaHora[] = [
  { id: 'des', hora: '07:00', on: true }, { id: 'media', hora: '10:00', on: false }, { id: 'alm', hora: '12:30', on: true },
  { id: 'snack', hora: '16:00', on: true }, { id: 'cena', hora: '19:30', on: true },
];
const PREGUNTA: Record<Momento, string> = {
  des: '¿ya desayunaste?', media: '¿ya comiste algo a media mañana?', alm: '¿ya almorzaste?', snack: '¿ya comiste tu snack?', cena: '¿ya cenaste?',
};
const COMIDA: Record<Momento, string> = { des: 'des', media: 'snack', alm: 'alm', snack: 'snack', cena: 'cena' };
const VENTANA_MIN = 90; // si el cron se atrasa, todavía se manda dentro de hora y media

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(Deno.env.get('KALO_VAPID_SUBJECT')!, Deno.env.get('KALO_VAPID_PUBLIC')!, Deno.env.get('KALO_VAPID_PRIVATE')!);

const minutos = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

Deno.serve(async req => {
  if (req.headers.get('x-kalo-cron') !== Deno.env.get('KALO_CRON_SECRET')) return new Response('No autorizado', { status: 401 });

  // Colombia: UTC−5 todo el año
  const col = new Date(Date.now() - 5 * 3600e3);
  const fecha = col.toISOString().slice(0, 10);
  const ahora = col.getUTCHours() * 60 + col.getUTCMinutes();
  const ahoraISO = new Date().toISOString();

  const { data: perfiles, error } = await db.from('perfiles').select('id, cuenta_id, nombre, comidas').eq('recordar', true);
  if (error) return new Response(error.message, { status: 500 });
  if (!perfiles?.length) return Response.json({ enviados: 0 });

  const ids = perfiles.map(p => p.id);
  const [{ data: estados }, { data: planes }] = await Promise.all([
    db.from('recordatorios').select('perfil_id, momento, estado, pospuesto_hasta').eq('fecha', fecha).in('perfil_id', ids),
    db.from('plan').select('perfil_id, comida, plan_items(comido)').eq('fecha', fecha).in('perfil_id', ids),
  ]);
  const estadoDe = new Map((estados ?? []).map(e => [`${e.perfil_id}|${e.momento}`, e]));
  // Comidas que ya tienen algo marcado como comido hoy
  const comidas = new Set((planes ?? []).filter(p => (p.plan_items ?? []).some((i: { comido: boolean }) => i.comido)).map(p => `${p.perfil_id}|${p.comida}`));

  let enviados = 0;
  for (const p of perfiles) {
    const horario: ComidaHora[] = Array.isArray(p.comidas) && p.comidas.length ? p.comidas : DEFECTO;
    for (const c of horario) {
      if (!c.on) continue;
      const clave = `${p.id}|${c.id}`;
      const e = estadoDe.get(clave);
      const toca = e
        ? e.estado === 'pospuesto' && e.pospuesto_hasta && e.pospuesto_hasta <= ahoraISO
        : ahora >= minutos(c.hora) && ahora - minutos(c.hora) < VENTANA_MIN;
      if (!toca) continue;
      // Desayuno, almuerzo y cena: si ya lo anotó como comido, no se pregunta
      if (c.id !== 'media' && c.id !== 'snack' && comidas.has(`${p.id}|${COMIDA[c.id]}`)) {
        await db.from('recordatorios').upsert({ perfil_id: p.id, fecha, momento: c.id, estado: 'respondido', actualizado: ahoraISO });
        continue;
      }
      await db.from('recordatorios').upsert({ perfil_id: p.id, fecha, momento: c.id, estado: 'enviado', pospuesto_hasta: null, actualizado: ahoraISO });
      // Solo a los celulares de este perfil («Este celular es de…») y a los que no tienen dueño
      const { data: todas } = await db.from('suscripciones_push').select('endpoint, p256dh, auth, perfil_id').eq('usuario_id', p.cuenta_id);
      const subs = (todas ?? []).filter(s => !s.perfil_id || s.perfil_id === p.id);
      const carga = JSON.stringify({
        titulo: 'Kalo',
        cuerpo: `${p.nombre}, ${PREGUNTA[c.id]} Toca para contarle a Kalo qué comiste.`,
        url: `./?registrar=${c.id}&perfil=${p.id}&fecha=${fecha}`,
        tag: `kalo-${p.id}-${c.id}`,
      });
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 3600 });
          enviados++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          // El celular ya no existe o quitó el permiso: se suelta
          if (code === 404 || code === 410) await db.from('suscripciones_push').delete().eq('endpoint', s.endpoint);
        }
      }
    }
  }
  return Response.json({ enviados });
});
