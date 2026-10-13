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
  let enviados = await avisoPesarse(fecha, ahora, col.getUTCDay(), ahoraISO);
  enviados += await avisoAgua(fecha, ahora, ahoraISO);
  enviados += await avisoExceso(fecha, ahora, ahoraISO);
  if (!perfiles?.length) return Response.json({ enviados });

  const ids = perfiles.map(p => p.id);
  const [{ data: estados }, { data: planes }] = await Promise.all([
    db.from('recordatorios').select('perfil_id, momento, estado, pospuesto_hasta').eq('fecha', fecha).in('perfil_id', ids),
    db.from('plan').select('perfil_id, comida, plan_items(comido)').eq('fecha', fecha).in('perfil_id', ids),
  ]);
  const estadoDe = new Map((estados ?? []).map(e => [`${e.perfil_id}|${e.momento}`, e]));
  // Comidas que ya tienen algo marcado como comido hoy
  const comidas = new Set((planes ?? []).filter(p => (p.plan_items ?? []).some((i: { comido: boolean }) => i.comido)).map(p => `${p.perfil_id}|${p.comida}`));

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

// Manda una notificación a los celulares de un perfil (los suyos y los que no tienen dueño)
async function mandar(perfil: { id: string; cuenta_id: string }, carga: object) {
  const { data: todas } = await db.from('suscripciones_push').select('endpoint, p256dh, auth, perfil_id').eq('usuario_id', perfil.cuenta_id);
  let n = 0;
  for (const s of (todas ?? []).filter(x => !x.perfil_id || x.perfil_id === perfil.id)) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(carga), { TTL: 3600 });
      n++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('suscripciones_push').delete().eq('endpoint', s.endpoint);
    }
  }
  return n;
}

// Agua: cada 2 horas de 8 a. m. a 8 p. m., solo si va atrasado (lo esperado a esa hora, contando de 7 a. m. a 9 p. m.)
async function avisoAgua(fecha: string, ahora: number, ahoraISO: string) {
  const hora = Math.floor(ahora / 60);
  if (hora < 8 || hora > 20 || hora % 2 !== 0 || ahora % 60 >= 50) return 0;
  const momento = `agua${hora}`;
  const { data: perfiles } = await db.from('perfiles').select('id, cuenta_id, nombre, peso_kg, agua_meta').eq('recordar_agua', true);
  if (!perfiles?.length) return 0;
  const ids = perfiles.map(p => p.id);
  const [{ data: ya }, { data: agua }] = await Promise.all([
    db.from('recordatorios').select('perfil_id').eq('fecha', fecha).eq('momento', momento).in('perfil_id', ids),
    db.from('agua').select('perfil_id, ml').eq('fecha', fecha).in('perfil_id', ids),
  ]);
  const enviado = new Set((ya ?? []).map(x => x.perfil_id));
  const tomado = new Map<string, number>();
  for (const r of agua ?? []) tomado.set(r.perfil_id, (tomado.get(r.perfil_id) ?? 0) + r.ml);
  let n = 0;
  for (const p of perfiles) {
    if (enviado.has(p.id)) continue;
    const meta = p.agua_meta ?? Math.round((35 * Number(p.peso_kg)) / 250) * 250;
    const esperado = meta * Math.min(1, (ahora - 7 * 60) / (14 * 60));
    const lleva = Math.max(0, tomado.get(p.id) ?? 0);
    await db.from('recordatorios').upsert({ perfil_id: p.id, fecha, momento, estado: lleva >= esperado ? 'saltado' : 'enviado', actualizado: ahoraISO });
    if (lleva >= esperado) continue;
    const faltan = Math.max(1, Math.round((esperado - lleva) / 250));
    n += await mandar(p, {
      titulo: 'Kalo',
      cuerpo: `${p.nombre}, ¿ya tomaste agua? Vas ${faltan} ${faltan === 1 ? 'vaso' : 'vasos'} atrasado.`,
      url: './',
      tag: `kalo-${p.id}-agua`,
    });
  }
  return n;
}

// «Hoy toca pesarte»: el día y la hora que escogió en Meta de peso; no se manda si ese día ya se pesó
async function avisoPesarse(fecha: string, ahora: number, diaSemana: number, ahoraISO: string) {
  const { data: perfiles } = await db.from('perfiles').select('id, cuenta_id, nombre, pesarse').not('pesarse', 'is', null);
  const toca = (perfiles ?? []).filter(p => p.pesarse?.on && p.pesarse.dia === diaSemana && p.pesarse.hora
    && ahora >= minutos(p.pesarse.hora) && ahora - minutos(p.pesarse.hora) < VENTANA_MIN);
  if (!toca.length) return 0;
  const ids = toca.map(p => p.id);
  const [{ data: ya }, { data: pesados }] = await Promise.all([
    db.from('recordatorios').select('perfil_id').eq('fecha', fecha).eq('momento', 'peso').in('perfil_id', ids),
    db.from('registros_peso').select('perfil_id').eq('fecha', fecha).in('perfil_id', ids),
  ]);
  const saltar = new Set([...(ya ?? []), ...(pesados ?? [])].map(x => x.perfil_id));
  let n = 0;
  for (const p of toca) {
    if (saltar.has(p.id)) continue;
    await db.from('recordatorios').upsert({ perfil_id: p.id, fecha, momento: 'peso', estado: 'enviado', actualizado: ahoraISO });
    n += await mandar(p, {
      titulo: 'Kalo',
      cuerpo: `${p.nombre}, hoy toca pesarte. En ayunas, y lo anotas en Kalo.`,
      url: `./?pesarse=1&perfil=${p.id}`,
      tag: `kalo-${p.id}-peso`,
    });
  }
  return n;
}

// ---- Aviso de exceso: se pasó del tope de sodio, azúcar libre o grasa saturada del día (una vez por cosa al día) ----
// Mismos cálculos que src/logic/salud.ts (topes de la OMS sobre la meta de calorías que guarda la app)
const LIBRES = new Set(['azucar', 'panela', 'miel', 'aguapanela', 'bocadillo', 'banano-bocadillo', 'arequipe', 'mermelada', 'leche-condensada', 'gaseosa', 'helado', 'torta',
  'pan-dulce', 'limonada', 'limonada-coco', 'chocolate-mesa', 'chocolate-agua', 'chocolate-caliente', 'cereal-arroz', 'corn-flakes', 'granola', 'galleta-integral',
  'yogur-fruta', 'batido-banano', 'avena-bebida', 'colada', 'mazamorra']);
const azucarLibre = (id: string) => LIBRES.has(id) || id.startsWith('jugo-');
type Cosa = 'sodio' | 'azucar' | 'grasaSat';
const EXCESO: Record<Cosa, { titulo: string; nombre: string; un: string; consejo: string }> = {
  azucar: { titulo: 'Cuidado con el azúcar', nombre: 'azúcar', un: 'g', consejo: 'Por hoy, mejor nada más de dulce, gaseosa ni jugos.' },
  sodio: { titulo: 'Cuidado con la sal', nombre: 'sodio', un: 'mg', consejo: 'Por hoy, mejor sin sal extra, embutidos ni paquetes.' },
  grasaSat: { titulo: 'Cuidado con la grasa', nombre: 'grasa saturada', un: 'g', consejo: 'Por hoy, mejor sin fritos, embutidos ni queso extra.' },
};
const fmtCO = (n: number) => Math.round(n).toLocaleString('es-CO');

async function avisoExceso(fecha: string, ahora: number, ahoraISO: string) {
  if (ahora < 6 * 60 || ahora >= 23 * 60) return 0; // de noche no se molesta
  const { data: perfiles } = await db.from('perfiles').select('id, cuenta_id, nombre, objetivo_kcal').eq('avisar_exceso', true);
  if (!perfiles?.length) return 0;
  const ids = perfiles.map(p => p.id);
  const [{ data: ya }, { data: planes }] = await Promise.all([
    db.from('recordatorios').select('perfil_id, momento').eq('fecha', fecha).like('momento', 'exceso%').in('perfil_id', ids),
    db.from('plan').select('perfil_id, plan_items(alimento_id, cantidad, comido, anadidos)').eq('fecha', fecha).in('perfil_id', ids),
  ]);
  const enviado = new Set((ya ?? []).map(x => `${x.perfil_id}|${x.momento}`));
  type Parte = { alimento_id: string; cantidad: number };
  const comido = new Map<string, Parte[]>();
  for (const pl of planes ?? []) for (const it of (pl.plan_items ?? []) as (Parte & { comido: boolean; anadidos: Parte[] | null })[]) {
    if (!it.comido) continue;
    const l = comido.get(pl.perfil_id) ?? [];
    l.push(it, ...(it.anadidos ?? []));
    comido.set(pl.perfil_id, l);
  }
  if (!comido.size) return 0;
  const alIds = [...new Set([...comido.values()].flat().map(x => x.alimento_id))];
  const { data: als } = await db.from('alimentos').select('id, nombre, porcion_base, por_100g').in('id', alIds);
  const porId = new Map((als ?? []).map(a => [a.id, a]));
  let n = 0;
  for (const p of perfiles) {
    const partes = comido.get(p.id);
    if (!partes) continue;
    const suma: Record<Cosa, Map<string, number>> = { sodio: new Map(), azucar: new Map(), grasaSat: new Map() };
    for (const x of partes) {
      const a = porId.get(x.alimento_id);
      if (!a) continue;
      const g = Number(a.porcion_base?.gramos ?? 0) * Number(x.cantidad);
      const v = (k: string) => Number(a.por_100g?.[k] ?? 0) * g / 100;
      const add = (c: Cosa, val: number) => { if (val > 0) suma[c].set(a.nombre, (suma[c].get(a.nombre) ?? 0) + val); };
      add('sodio', v('sodio_mg'));
      add('grasaSat', v('grasa_sat_g'));
      if (azucarLibre(a.id)) add('azucar', v('azucar_g'));
    }
    // Sin la meta de calorías (no ha abierto Kalo desde este cambio) solo se revisa el sodio, que es fijo
    const kcal = p.objetivo_kcal;
    const tope: Record<Cosa, number> = { sodio: 2000, azucar: kcal ? Math.round(kcal * 0.1 / 4) : Infinity, grasaSat: kcal ? Math.round(kcal * 0.1 / 9) : Infinity };
    for (const c of ['azucar', 'sodio', 'grasaSat'] as Cosa[]) {
      const momento = `exceso_${c}`;
      if (enviado.has(`${p.id}|${momento}`)) continue;
      const total = [...suma[c].values()].reduce((s, x) => s + x, 0);
      if (total < tope[c]) continue;
      await db.from('recordatorios').upsert({ perfil_id: p.id, fecha, momento, estado: 'enviado', actualizado: ahoraISO });
      const mas = [...suma[c].entries()].sort((x, y) => y[1] - x[1])[0][0].toLowerCase();
      const e = EXCESO[c];
      n += await mandar(p, {
        titulo: e.titulo,
        cuerpo: `${p.nombre}, hoy ya pasaste tu tope de ${e.nombre}: ${fmtCO(total)} de ${fmtCO(tope[c])} ${e.un}. Lo que más aportó: ${mas}. ${e.consejo}`,
        url: './',
        tag: `kalo-${p.id}-${momento}`,
      });
    }
  }
  return n;
}
