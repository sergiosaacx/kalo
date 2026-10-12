import { createElement, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { Chips, u } from '../components/ui';
import { useAlimentos } from '../data/alimentos';
import { porDia, usePlanRango, type Dia } from '../data/historial';
import { hoyISO } from '../data/plan';
import { usePesos } from '../data/peso';
import { useSesion } from '../data/sesion';
import { fmt, gasto, conSigno } from '../logic/energia';
import { sumarDias } from '../logic/peso';
import { C } from '../theme';

const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const INICIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dDe = (f: string) => { const [a, m, d] = f.split('-').map(Number); return new Date(a, m - 1, d); };
const diaTxt = (f: string) => { const d = dDe(f); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()}`; };
export const rangoTxt = (desde: string, hasta: string) => {
  const a = dDe(desde), b = dDe(hasta);
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} de ${MESES[b.getMonth()]}` : `${a.getDate()} de ${MESES[a.getMonth()]} – ${b.getDate()} de ${MESES[b.getMonth()]}`;
};
// Lunes de la semana de una fecha
export const lunesDe = (f: string) => sumarDias(f, -((dDe(f).getDay() + 6) % 7));
const enMeta = (k: number, meta: number) => Math.abs(k - meta) <= meta * 0.1;

// Promedios de los días ya cerrados (hoy va en curso y no cuenta) que tienen algo comido
function resumen(m: Map<string, Dia>, hoy: string, meta: number) {
  const cerrados = [...m.values()].filter(d => d.fecha < hoy && d.kcal > 0);
  const n = cerrados.length;
  return {
    n, promedio: n ? cerrados.reduce((t, d) => t + d.kcal, 0) / n : 0,
    proteina: n ? cerrados.reduce((t, d) => t + d.p, 0) / n : 0,
    enMeta: cerrados.filter(d => enMeta(d.kcal, meta)).length,
  };
}

function Datos({ items }: { items: { label: string; valor: string; sub?: string }[] }) {
  return (
    <View style={s.tres}>
      {items.map(x => (
        <View key={x.label} style={s.dato}>
          <Text style={s.datoLbl}>{x.label}</Text>
          <Text style={s.datoVal}>{x.valor}</Text>
          {x.sub ? <Text style={s.datoSub}>{x.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

// Semana de lunes a domingo: barras contra la meta, promedios y la lista de días (tocar uno lo abre como Hoy)
export function Semana({ onDia }: { onDia: (fecha: string) => void }) {
  const { activo } = useSesion();
  const { lista } = useAlimentos();
  const hoy = hoyISO(), lunes = lunesDe(hoy), domingo = sumarDias(lunes, 6);
  const { items } = usePlanRango(activo?.id, lunes, domingo);
  const porId = useMemo(() => new Map((lista ?? []).map(a => [a.id, a])), [lista]);
  if (!activo) return null;
  if (!items || !lista) return <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} />;
  const meta = gasto(activo).objetivo;
  const m = porDia(items.filter(i => i.fecha >= lunes && i.fecha <= domingo), porId);
  const r = resumen(m, hoy, meta);
  const fechas = Array.from({ length: 7 }, (_, k) => sumarDias(lunes, k));
  const max = Math.max(meta * 1.15, ...fechas.map(f => m.get(f)?.kcal ?? 0));
  const W = 330, H = 130, base = 108, alto = 88;
  const Y = (k: number) => base - (k / max) * alto;

  // Lista de hoy hacia atrás; los días seguidos sin anotar se juntan en una línea
  const filas: { txt: string; valor?: string; color?: string; fecha?: string; nota?: string }[] = [];
  let vacios: string[] = [];
  const cerrarVacios = () => {
    if (!vacios.length) return;
    filas.push({ txt: vacios.length === 1 ? diaTxt(vacios[0]) : `${diaTxt(vacios[vacios.length - 1])} a ${diaTxt(vacios[0]).toLowerCase()}`, nota: 'sin anotar' });
    vacios = [];
  };
  for (const f of [...fechas].reverse().filter(f => f <= hoy)) {
    const d = m.get(f);
    if (!d || d.kcal <= 0) { if (f === hoy) filas.push({ txt: `${diaTxt(f)} · hoy`, valor: '0', fecha: f }); else vacios.push(f); continue; }
    cerrarVacios();
    if (f === hoy) filas.push({ txt: `${diaTxt(f)} · hoy, va en curso`, valor: fmt(d.kcal), fecha: f });
    else filas.push({ txt: diaTxt(f), valor: `${fmt(d.kcal)} · ${conSigno(d.kcal - meta)}`, color: enMeta(d.kcal, meta) ? C.success : d.kcal > meta ? C.accent : C.muted, fecha: f });
  }
  cerrarVacios();

  return (
    <View style={{ gap: 12 }}>
      <View style={[u.card, { paddingVertical: 12 }]}>
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={undefined} style={{ aspectRatio: W / H }}>
          <Line x1={8} y1={Y(meta)} x2={322} y2={Y(meta)} stroke={C.muted} strokeWidth={1.2} strokeDasharray="4 4" />
          <SvgText x={322} y={Y(meta) - 6} fill={C.muted} fontSize={10} textAnchor="end">meta {fmt(meta)}</SvgText>
          {fechas.map((f, k) => {
            const x = 14 + k * 46, kc = m.get(f)?.kcal ?? 0;
            return kc > 0
              ? <Rect key={f} x={x} y={Y(kc)} width={30} height={base - Y(kc)} rx={5} fill={C.accent} opacity={f === hoy ? 0.55 : 1} />
              : <Rect key={f} x={x} y={base - 4} width={30} height={4} rx={2} fill={C.surface3} />;
          })}
          {fechas.map((f, k) => (
            <SvgText key={`t${f}`} x={29 + k * 46} y={124} fill={f === hoy ? C.text : C.muted} fontSize={11} textAnchor="middle">{INICIAL[dDe(f).getDay()]}</SvgText>
          ))}
        </Svg>
      </View>
      <Datos items={[
        { label: 'Promedio', valor: r.n ? fmt(r.promedio) : '—', sub: r.n ? `kcal · ${r.n} ${r.n === 1 ? 'día' : 'días'}` : 'sin días cerrados' },
        { label: 'En tu meta', valor: r.n ? `${r.enMeta} de ${r.n}` : '—', sub: '±10 %' },
        { label: 'Proteína', valor: r.n ? `${fmt(r.proteina)} g` : '—', sub: 'promedio' },
      ]} />
      <View style={[u.card, { paddingVertical: 6 }]}>
        {filas.map((f, k) => {
          const fila = (
            <View style={[s.fila, k > 0 && s.borde]}>
              <Text style={s.diaTxt}>{f.txt}</Text>
              {f.nota ? <Text style={s.muted12}>{f.nota}</Text> : <Text style={[s.diaVal, f.color ? { color: f.color } : null]}>{f.valor}</Text>}
            </View>
          );
          return f.fecha ? <Pressable key={k} onPress={() => onDia(f.fecha!)}>{fila}</Pressable> : <View key={k}>{fila}</View>;
        })}
      </View>
    </View>
  );
}

// Selector de fecha nativo (la app es web instalada: en el iPhone abre su calendario)
function FechaInput({ valor, cambiar, label }: { valor: string; cambiar: (f: string) => void; label: string }) {
  const d = dDe(valor);
  return (
    <View style={s.fechaCaja}>
      <Text style={s.muted12}>{label}</Text>
      <Text style={s.fechaTxt}>{d.getDate()} de {MESES[d.getMonth()]}</Text>
      {Platform.OS === 'web' && createElement('input', {
        type: 'date', value: valor, max: hoyISO(), 'aria-label': label,
        onChange: (e: { target: { value: string } }) => e.target.value && cambiar(e.target.value),
        style: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', border: 0, cursor: 'pointer' },
      })}
    </View>
  );
}

type Rango = '14' | '30' | 'mes' | 'fechas';

// Cualquier rango: promedio, días en la meta, proteína, cambio de peso y lo que más comió
export function Personalizado({ onRango }: { onRango?: (desde: string, hasta: string) => void }) {
  const { activo } = useSesion();
  const { lista } = useAlimentos();
  const hoy = hoyISO();
  const [rango, setRango] = useState<Rango>('30');
  const [libre, setLibre] = useState({ desde: sumarDias(hoy, -13), hasta: hoy });
  const desde = rango === '14' ? sumarDias(hoy, -13) : rango === '30' ? sumarDias(hoy, -29) : rango === 'mes' ? `${hoy.slice(0, 8)}01` : libre.desde;
  const hasta = rango === 'fechas' ? libre.hasta : hoy;
  const { items } = usePlanRango(activo?.id, desde, hasta);
  const { lista: pesos } = usePesos(activo?.id);
  const porId = useMemo(() => new Map((lista ?? []).map(a => [a.id, a])), [lista]);
  useEffect(() => { onRango?.(desde, hasta); }, [desde, hasta]);
  if (!activo) return null;
  const meta = gasto(activo).objetivo;

  const cuerpo = () => {
    if (!items || !lista || !pesos) return <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />;
    const m = porDia(items.filter(i => i.fecha >= desde && i.fecha <= hasta), porId);
    const r = resumen(m, hoy, meta);
    if (r.n === 0) return <Text style={u.soft}>No hay días anotados en este rango (hoy no cuenta porque va en curso).</Text>;
    const ps = pesos.filter(x => x.fecha >= desde && x.fecha <= hasta);
    const cambio = ps.length >= 2 ? ps[ps.length - 1].peso - ps[0].peso : null;
    const veces = new Map<string, number>();
    for (const it of items) if (it.comido && it.fecha < hoy) veces.set(it.alimento_id, (veces.get(it.alimento_id) ?? 0) + 1);
    const top = [...veces.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => porId.get(id)?.nombre).filter(Boolean);
    return (
      <>
        <View style={[u.card, { gap: 8 }]}>
          <Text style={s.muted13}>Promedio por día · {r.n} {r.n === 1 ? 'día anotado' : 'días anotados'}</Text>
          <Text style={s.big}>{fmt(r.promedio)} <Text style={s.unidad}>kcal</Text></Text>
          <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, (r.promedio / meta) * 100)}%` }]} /></View>
          <Text style={s.muted12}>{fmt((r.promedio / meta) * 100)} % de tu meta ({fmt(meta)})</Text>
        </View>
        <Datos items={[
          { label: 'En tu meta', valor: `${r.enMeta} de ${r.n}` },
          { label: 'Proteína', valor: `${fmt(r.proteina)} g` },
          { label: 'Peso', valor: cambio === null ? '—' : `${cambio > 0 ? '+' : cambio < 0 ? '−' : ''}${Math.abs(Math.round(cambio * 10) / 10).toLocaleString('es-CO')} kg` },
        ]} />
        {top.length > 0 && (
          <View style={[u.card, { gap: 6 }]}>
            <Text style={s.muted13}>Lo que más comiste</Text>
            <Text style={{ fontSize: 14, color: C.text, lineHeight: 20 }}>{top.join(' · ')}</Text>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <Chips<Rango> opciones={[['14', 'Últimos 14 días'], ['30', 'Últimos 30 días'], ['mes', 'Este mes'], ['fechas', 'Elegir fechas']]} valor={rango} onCambio={setRango} />
      {rango === 'fechas' && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <FechaInput label="Desde" valor={libre.desde} cambiar={f => setLibre(x => ({ desde: f, hasta: f > x.hasta ? f : x.hasta }))} />
          <FechaInput label="Hasta" valor={libre.hasta} cambiar={f => setLibre(x => ({ hasta: f, desde: f < x.desde ? f : x.desde }))} />
        </View>
      )}
      {cuerpo()}
    </View>
  );
}

const s = StyleSheet.create({
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12.5, color: C.muted },
  tres: { flexDirection: 'row', gap: 8 },
  dato: { flex: 1, backgroundColor: C.surface, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  datoLbl: { fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted },
  datoVal: { fontSize: 18, fontWeight: '700', color: C.text },
  datoSub: { fontSize: 11, color: C.muted },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, gap: 10 },
  borde: { borderTopWidth: 1, borderTopColor: C.divider },
  diaTxt: { fontSize: 14, color: C.text, flex: 1 },
  diaVal: { fontSize: 14, fontWeight: '700', color: C.text },
  big: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8, color: C.text },
  unidad: { fontSize: 15, color: C.muted, fontWeight: '400' },
  track: { height: 8, borderRadius: 4, backgroundColor: C.surface3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: C.accent },
  fechaCaja: { flex: 1, position: 'relative', backgroundColor: C.surface, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  fechaTxt: { fontSize: 15, fontWeight: '700', color: C.text },
});
