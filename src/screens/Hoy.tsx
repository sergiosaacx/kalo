import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Anillo } from '../components/Anillo';
import { nutrientesItem, useAlimentos, type AlimentoDB } from '../data/alimentos';
import { COMIDAS, hoyISO, usePlanDia, type ComidaId, type ItemPlan } from '../data/plan';
import { Personalizado, Semana, lunesDe, rangoTxt } from './Resumen';
import { sumarDias } from '../logic/peso';
import { useSesion } from '../data/sesion';
import { conSigno, fmt, gasto, macrosObjetivo } from '../logic/energia';
import { C } from '../theme';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const RANGOS = [['hoy', 'Hoy'], ['semana', 'Semana'], ['custom', 'Personalizado']] as const;

function sumar(items: ItemPlan[], porId: Map<string, AlimentoDB>, soloComido: boolean) {
  return items.reduce((a, it) => {
    const f = porId.get(it.alimento_id);
    if (!f || (soloComido && !it.comido)) return a;
    const n = nutrientesItem(it, porId);
    a.k += n.kcal; a.p += n.p; a.c += n.c; a.g += n.gr;
    return a;
  }, { k: 0, p: 0, c: 0, g: 0 });
}

// aviso: «Desayuno anotado · 766 kcal» al volver de responder «¿Ya desayunaste?»; aquí se le suma lo que queda del día
export function Hoy({ irA, agregarA, verRestante, editar, aviso }: { irA: (tab: string) => void; agregarA: (c: ComidaId) => void; verRestante?: () => void; editar?: (it: ItemPlan) => void; aviso?: string | null }) {
  const [rango, setRango] = useState<string>('hoy');
  // El día que se ve (hoy, o uno anterior tocado en «Semana») y el rango de «Personalizado» para el encabezado
  const [dia, setDia] = useState(hoyISO());
  const [rangoP, setRangoP] = useState<[string, string] | null>(null);
  const esHoy = dia === hoyISO();
  const { activo } = useSesion();
  const { lista } = useAlimentos();
  const { items, alternar } = usePlanDia(activo?.id, dia);
  if (!activo) return null;
  const pr = activo;
  const porId = new Map((lista ?? []).map(a => [a.id, a]));
  const todos = items ?? [];
  const en = gasto(pr);
  const tgt = en.objetivo;
  const hoy = sumar(todos, porId, true);
  const rem = tgt - hoy.k;
  const obj = macrosObjetivo(pr, tgt);
  const [aa, mm, dd] = dia.split('-').map(Number);
  const d = new Date(aa, mm - 1, dd);
  const fecha = rango === 'semana' ? rangoTxt(lunesDe(hoyISO()), sumarDias(lunesDe(hoyISO()), 6))
    : rango === 'custom' ? (rangoP ? rangoTxt(rangoP[0], rangoP[1]) : '')
      : `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;

  const msg = todos.length === 0
    ? `Hola, ${pr.nombre}. Hoy te tocan ${fmt(tgt)} kcal. Agrega lo que comas y marca el círculo cuando lo comas.`
    : pr.meta === 'bajar'
      ? (rem >= 0 ? `Vas muy bien, ${pr.nombre}. Te quedan ${fmt(rem)} kcal y sigues en déficit.` : `Te pasaste ${fmt(-rem)} kcal. Una caminata de 30 minutos ayuda a equilibrar.`)
      : pr.meta === 'subir'
        ? (rem > 0 ? `Te faltan ${fmt(rem)} kcal para tu meta de hoy. Un snack más y lo logras.` : 'Meta cumplida. Hoy sumaste lo que tu cuerpo necesita para crecer.')
        : (rem > 0 ? `Te quedan ${fmt(rem)} kcal para mantenerte en equilibrio.` : `Llevas ${fmt(-rem)} kcal sobre tu equilibrio de hoy.`);

  const kpis = [
    { label: rem >= 0 ? 'Restante' : 'Exceso', value: fmt(Math.abs(rem)), color: C.accent },
    { label: 'Gasto', value: fmt(en.total), color: C.text },
    { label: 'Balance', value: conSigno(hoy.k - en.total), color: C.text },
  ];
  const macros = [
    { label: 'Proteína', v: hoy.p, t: obj.proteina, color: C.accent },
    { label: 'Carbohidratos', v: hoy.c, t: obj.carbos, color: C.carbs },
    { label: 'Grasa', v: hoy.g, t: obj.grasa, color: C.fat },
  ];

  return (
    <View style={{ gap: 14 }}>
      {aviso && esHoy && items !== null && (
        <Text style={s.aviso}>{aviso} · {rem > 0 ? `te quedan ${fmt(rem)} para hoy` : 'ya cubriste tu meta de hoy'}</Text>
      )}
      <View style={s.header}>
        <View style={{ gap: 2 }}>
          <Text style={s.muted13}>{fecha}</Text>
          <Text style={s.h1}>Hola, {pr.nombre}</Text>
        </View>
        <Pressable onPress={() => irA('perfil')} style={[s.avatar, { backgroundColor: pr.color }]}>
          <Text style={s.avatarTxt}>{pr.nombre.charAt(0)}</Text>
        </Pressable>
      </View>

      <View style={s.segment}>
        {RANGOS.map(([id, l]) => (
          <Pressable key={id} onPress={() => setRango(id)} style={[s.segBtn, rango === id && { backgroundColor: C.accent }]}>
            <Text style={[s.segTxt, { color: rango === id ? C.onAccent : C.text }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {rango === 'hoy' && !esHoy && (
        <Pressable onPress={() => setDia(hoyISO())} style={{ minHeight: 36, justifyContent: 'center', marginTop: -4 }}>
          <Text style={[s.link, { fontSize: 14 }]}>‹ Volver a hoy</Text>
        </Pressable>
      )}

      {rango === 'semana' ? (
        <Semana onDia={f => { setDia(f); setRango('hoy'); }} />
      ) : rango === 'custom' ? (
        <Personalizado onRango={(a, b) => setRangoP([a, b])} />
      ) : (
        <>
          <View style={[s.card, { borderRadius: 24, paddingVertical: 22, alignItems: 'center', gap: 18 }]}>
            <Anillo progreso={hoy.k / tgt}>
              <Text style={s.overline}>Consumido</Text>
              <Text style={s.hero}>{fmt(hoy.k)}</Text>
              <Text style={[s.muted13, { fontSize: 14 }]}>de {fmt(tgt)} kcal</Text>
            </Anillo>
            <Text style={s.msg}>{msg}</Text>
            <View style={s.kpis}>
              {kpis.map((k, i) => {
                const contenido = (
                  <>
                    <Text style={[s.overline, { letterSpacing: 0.66 }]}>{k.label}</Text>
                    <Text style={[s.kpiVal, { color: k.color }]}>{k.value}</Text>
                    <Text style={[s.muted13, { fontSize: 11 }]}>kcal</Text>
                  </>
                );
                // «Restante» se puede tocar: abre «¿Qué como para completar?» (el cuadro se ve igual)
                return i === 0 && verRestante && esHoy
                  ? <Pressable key={k.label} style={s.kpi} onPress={verRestante} accessibilityRole="button">{contenido}</Pressable>
                  : <View key={k.label} style={s.kpi}>{contenido}</View>;
              })}
            </View>
          </View>

          <View style={[s.card, { gap: 14 }]}>
            <Text style={[s.overline, { fontSize: 12 }]}>Macronutrientes</Text>
            {macros.map(m => (
              <View key={m.label} style={{ gap: 7 }}>
                <View style={s.row}>
                  <Text style={s.b14}>{m.label}</Text>
                  <Text style={[s.muted13, { fontSize: 14 }]}>{fmt(m.v)} g / {fmt(m.t)} g</Text>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${Math.min(100, (m.v / m.t) * 100)}%`, backgroundColor: m.color }]} />
                </View>
              </View>
            ))}
          </View>

          <Pressable onPress={() => irA('gasto')} style={[s.card, s.row, { borderWidth: 1, borderColor: C.surface3, paddingVertical: 16 }]}>
            <View style={{ gap: 3 }}>
              <Text style={s.muted13}>Tu cuerpo usa hoy</Text>
              <Text style={s.h22}>{fmt(en.total)} kcal</Text>
              <Text style={s.muted13}>Según tus hábitos diarios</Text>
            </View>
            <Text style={s.link}>Ajustar →</Text>
          </Pressable>

          <View style={[s.row, { paddingTop: 6, paddingHorizontal: 2, alignItems: 'baseline' }]}>
            <Text style={[s.h22, { fontSize: 20 }]}>Comidas de hoy</Text>
            <Pressable onPress={() => irA('menu')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={s.link}>Ver menú</Text>
            </Pressable>
          </View>

          {COMIDAS.map(([m, label]) => {
            const delaComida = todos.filter(it => it.comida === m);
            return (
              <View key={m} style={[s.card, { padding: 16, paddingBottom: 8 }]}>
                <View style={[s.row, { paddingBottom: 6, alignItems: 'baseline' }]}>
                  <Text style={[s.b14, { fontSize: 16, fontWeight: '700' }]}>{label}</Text>
                  <Text style={s.muted13}>{fmt(sumar(delaComida, porId, true).k)} / {fmt(sumar(delaComida, porId, false).k)} kcal</Text>
                </View>
                {delaComida.length === 0 && items !== null && !esHoy && <Text style={[s.muted13, { paddingVertical: 8 }]}>Sin alimentos</Text>}
                {delaComida.length === 0 && items !== null && esHoy && (
                  <Pressable onPress={() => agregarA(m)} style={s.vacio}>
                    <Text style={[s.muted13, { fontSize: 14 }]}>Sin alimentos · Agregar</Text>
                  </Pressable>
                )}
                {delaComida.map(it => {
                  const f = porId.get(it.alimento_id);
                  if (!f) return null;
                  const n = nutrientesItem(it, porId);
                  const ad = (it.anadidos ?? []).map(x => porId.get(x.alimento_id)?.nombre.toLowerCase()).filter(Boolean);
                  const op = it.comido ? 1 : 0.6;
                  const q = it.cantidad;
                  return (
                    <View key={it.id} style={s.item}>
                      <Pressable onPress={() => alternar(it.id)}
                        style={[s.check, { borderColor: it.comido ? C.accent : '#4A4A4E', backgroundColor: it.comido ? C.accent : 'transparent' }]}>
                        <Text style={s.checkTxt}>{it.comido ? '✓' : ''}</Text>
                      </Pressable>
                      {/* Tocar el alimento lo abre para editarlo (medida, añadidos, cambiarlo o quitarlo) */}
                      <Pressable onPress={() => editar?.(it)} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {f.foto_url ? <Image source={{ uri: f.foto_url }} style={s.thumb} /> : <View style={s.thumb} />}
                      <View style={{ flex: 1, minWidth: 0, gap: 2, opacity: op }}>
                        <Text style={[s.b14, { fontSize: 15 }]} numberOfLines={1}>{f.nombre}</Text>
                        <Text style={[s.muted13, { fontSize: 12 }]} numberOfLines={1}>
                          {q === 1 ? f.porcion_base.texto : `${q.toLocaleString('es-CO')} × ${f.porcion_base.texto}`}
                        </Text>
                        {ad.length > 0 && <Text style={[s.muted13, { fontSize: 12, color: C.fat }]} numberOfLines={1}>+ {ad.join(', ')}</Text>}
                      </View>
                      <Text style={[s.b14, { opacity: op }]}>{fmt(n.kcal)}</Text>
                      </Pressable>
                    </View>
                  );
                })}
                {delaComida.length > 0 && esHoy && (
                  <Pressable onPress={() => agregarA(m)} style={{ minHeight: 40, justifyContent: 'center', borderTopWidth: 1, borderTopColor: C.divider }}>
                    <Text style={[s.link, { fontSize: 14 }]}>+ Agregar alimento</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  aviso: { backgroundColor: '#141A0E', borderWidth: 1, borderColor: C.success, color: C.success, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, fontWeight: '700', overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.56, color: C.text },
  h22: { fontSize: 22, fontWeight: '700', color: C.text },
  muted13: { fontSize: 13, color: C.muted },
  soft: { fontSize: 15, color: C.soft, textAlign: 'center', lineHeight: 22 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.onAccent, fontSize: 17, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segTxt: { fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 18 },
  overline: { fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: C.muted },
  hero: { fontSize: 50, fontWeight: '700', letterSpacing: -1.5, color: C.text },
  msg: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: C.text, maxWidth: 290 },
  kpis: { flexDirection: 'row', gap: 8, width: '100%' },
  kpi: { flex: 1, backgroundColor: C.surface2, borderRadius: 14, padding: 12, gap: 3 },
  kpiVal: { fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  b14: { fontSize: 14, fontWeight: '600', color: C.text },
  track: { height: 8, borderRadius: 4, backgroundColor: C.surface3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  link: { fontSize: 14, fontWeight: '600', color: C.accent },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkTxt: { color: C.onAccent, fontSize: 14, fontWeight: '700' },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface2 },
  vacio: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, borderRadius: 14, padding: 12, marginTop: 6, marginBottom: 8, alignItems: 'center' },
});
