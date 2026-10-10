import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Anillo } from '../components/Anillo';
import { ALIMENTOS, COMIDAS, PERFIL_DEMO, PLAN_HOY, type ComidaId, type Item } from '../data/demo';
import { conSigno, fmt, gasto, macrosObjetivo } from '../logic/energia';
import { C } from '../theme';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const RANGOS = [['hoy', 'Hoy'], ['semana', 'Semana'], ['custom', 'Personalizado']] as const;

function sumar(items: Item[], soloComido: boolean) {
  return items.reduce((a, it) => {
    if (soloComido && !it.comido) return a;
    const f = ALIMENTOS[it.id];
    a.k += f.kcal * it.q; a.p += f.p * it.q; a.c += f.c * it.q; a.g += f.g * it.q;
    return a;
  }, { k: 0, p: 0, c: 0, g: 0 });
}

export function Hoy({ irA }: { irA: (tab: string) => void }) {
  const [rango, setRango] = useState<string>('hoy');
  const [plan, setPlan] = useState(PLAN_HOY);
  const pr = PERFIL_DEMO;
  const en = gasto(pr);
  const tgt = en.objetivo;
  const hoy = sumar(COMIDAS.flatMap(([m]) => plan[m]), true);
  const rem = tgt - hoy.k;
  const obj = macrosObjetivo(pr, tgt);
  const d = new Date();
  const fecha = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;

  const msg = rem >= 0
    ? `Vas muy bien, ${pr.nombre}. Te quedan ${fmt(rem)} kcal y sigues en déficit.`
    : `Te pasaste ${fmt(-rem)} kcal. Una caminata de 30 minutos ayuda a equilibrar.`;

  const alternar = (m: ComidaId, i: number) =>
    setPlan(p => ({ ...p, [m]: p[m].map((it, j) => (j === i ? { ...it, comido: !it.comido } : it)) }));

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

      {rango !== 'hoy' ? (
        <View style={[s.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <Text style={s.soft}>La vista de {rango === 'semana' ? 'la semana' : 'rango personalizado'} llega en la próxima entrega.</Text>
        </View>
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
              {kpis.map(k => (
                <View key={k.label} style={s.kpi}>
                  <Text style={[s.overline, { letterSpacing: 0.66 }]}>{k.label}</Text>
                  <Text style={[s.kpiVal, { color: k.color }]}>{k.value}</Text>
                  <Text style={[s.muted13, { fontSize: 11 }]}>kcal</Text>
                </View>
              ))}
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
            const items = plan[m];
            return (
              <View key={m} style={[s.card, { padding: 16, paddingBottom: 8 }]}>
                <View style={[s.row, { paddingBottom: 6, alignItems: 'baseline' }]}>
                  <Text style={[s.b14, { fontSize: 16, fontWeight: '700' }]}>{label}</Text>
                  <Text style={s.muted13}>{fmt(sumar(items, true).k)} / {fmt(sumar(items, false).k)} kcal</Text>
                </View>
                {items.map((it, i) => {
                  const f = ALIMENTOS[it.id];
                  const op = it.comido ? 1 : 0.6;
                  return (
                    <View key={it.id + i} style={s.item}>
                      <Pressable onPress={() => alternar(m, i)}
                        style={[s.check, { borderColor: it.comido ? C.accent : '#4A4A4E', backgroundColor: it.comido ? C.accent : 'transparent' }]}>
                        <Text style={s.checkTxt}>{it.comido ? '✓' : ''}</Text>
                      </Pressable>
                      <View style={s.thumb} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2, opacity: op }}>
                        <Text style={[s.b14, { fontSize: 15 }]}>{f.nombre}</Text>
                        <Text style={[s.muted13, { fontSize: 12 }]}>{f.porcion}</Text>
                      </View>
                      <Text style={[s.b14, { opacity: op }]}>{fmt(f.kcal * it.q)}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
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
});
