// Kalo · clasifica una actividad escrita en «Otro» contra el catálogo del Compendio de Actividades.
// 1) respuesta guardada → 2) Claude escoge del catálogo (o estima si nada se parece) → se guarda.
// Body: { texto: string, tipo: 'trabajo' | 'ejercicio', registrar?: 'catalogo' | 'intensidad' }
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODELO = 'claude-opus-5-5';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const claude = new Anthropic({ apiKey: Deno.env.get('KALO_ANTHROPIC_API_KEY') });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Usa POST.' }, 405);

  let body: { texto?: string; tipo?: string; registrar?: string };
  try { body = await req.json(); } catch { return json({ error: 'El cuerpo debe ser JSON.' }, 400); }
  const texto = normalizar(String(body.texto ?? '')).slice(0, 120);
  const tipo = body.tipo === 'ejercicio' ? 'ejercicio' : body.tipo === 'trabajo' ? 'trabajo' : null;
  if (!texto || !tipo) return json({ error: 'Faltan «texto» y «tipo» (trabajo o ejercicio).' }, 400);

  // La app ya lo resolvió sola: solo se anota para saber qué escribe la gente
  if (body.registrar === 'catalogo' || body.registrar === 'intensidad') {
    await db.from('actividades_escritas').insert({ texto, tipo, resuelto_por: body.registrar });
    return json({ ok: true });
  }

  const { data: guardada } = await db.from('actividades_ia').select('*').eq('texto', texto).eq('tipo', tipo).maybeSingle();
  if (guardada) {
    await db.from('actividades_escritas').insert({ texto, tipo, resuelto_por: 'ia' });
    return json({ actividad_id: guardada.actividad_id, met: Number(guardada.met), nombre: guardada.nombre, confianza: guardada.confianza, guardada: true });
  }

  const { data: catalogo, error: eCat } = await db.from('actividades').select('id, nombre, met, sinonimos').eq('tipo', tipo).order('id');
  if (eCat || !catalogo?.length) return json({ error: 'No pudimos leer el catálogo.' }, 500);

  const lista = catalogo.map(a => `${a.id} | ${a.nombre} | ${a.met} | ${a.sinonimos.join(', ')}`).join('\n');
  const system = `Clasificas actividades que personas de Colombia escriben en una app de nutrición, para estimar su gasto calórico con el Compendio de Actividades Físicas.
Recibes un texto corto (${tipo === 'trabajo' ? 'un trabajo u oficio' : 'un ejercicio o deporte'}) y debes escoger la actividad del catálogo que mejor representa su exigencia física promedio.
Reglas:
- Escoge el id del catálogo cuya exigencia física sea más parecida, aunque el nombre no coincida (ej. «panadero» → cocina; «ordeño a mano» → ganadería).
- Usa "ninguna" solo si nada del catálogo se parece en exigencia; en ese caso estima el MET con el Compendio.
- met: el MET típico de la actividad${tipo === 'ejercicio' ? ' a intensidad moderada' : ' promediado en una jornada'} (entre 1 y 15).
- nombre: cómo llamarías la actividad en español de Colombia, corto.
- confianza: alta si el texto es claro; baja si es ambiguo o no parece una actividad física.

Catálogo (id | nombre | MET | sinónimos):
${lista}`;

  const schema = {
    type: 'object',
    properties: {
      actividad_id: { type: 'string', enum: [...catalogo.map(a => a.id), 'ninguna'] },
      met: { type: 'number' },
      nombre: { type: 'string' },
      confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    },
    required: ['actividad_id', 'met', 'nombre', 'confianza'],
    additionalProperties: false,
  };

  let r: { actividad_id: string; met: number; nombre: string; confianza: string };
  let modelo = MODELO;
  try {
    const resp = await claude.beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: texto }],
    });
    if (resp.stop_reason === 'refusal') return json({ error: 'No pudimos clasificarlo.' }, 422);
    const bloque = resp.content.find(b => b.type === 'text');
    if (!bloque || bloque.type !== 'text') return json({ error: 'Respuesta vacía.' }, 502);
    r = JSON.parse(bloque.text);
    modelo = resp.model;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Muchas consultas seguidas. Intenta en un momento.' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'La llave de la IA no es válida.' }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: `La IA no respondió (${e.status}).` }, 502);
    return json({ error: 'No pudimos clasificarlo.' }, 500);
  }

  // Si escogió del catálogo, manda el MET medido del catálogo; si no, el estimado (acotado)
  const delCatalogo = catalogo.find(a => a.id === r.actividad_id);
  const met = delCatalogo ? Number(delCatalogo.met) : Math.min(15, Math.max(1, Number(r.met) || 3));
  const fila = { texto, tipo, actividad_id: delCatalogo?.id ?? null, met, nombre: r.nombre.slice(0, 60), confianza: r.confianza, modelo };
  await db.from('actividades_ia').upsert(fila);
  await db.from('actividades_escritas').insert({ texto, tipo, resuelto_por: 'ia' });
  return json({ actividad_id: fila.actividad_id, met, nombre: fila.nombre, confianza: fila.confianza, guardada: false });
});
