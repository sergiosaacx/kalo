import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Boton, Chips, Segmento, u } from '../components/ui';
import { hoyISO } from '../data/plan';
import { usePesos } from '../data/peso';
import { useSesion, type PerfilActivo } from '../data/sesion';
import { fmt, gasto, type Meta } from '../logic/energia';
import { dias, fechaMeta, llego, proponerAjuste, ritmoPlan, sumarDias, type RegistroPeso } from '../logic/peso';
import { C } from '../theme';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const kg = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');
const conSignoKg = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + kg(Math.abs(n));
const partes = (f: string) => { const [a, m, d] = f.split('-').map(Number); return { a, m: m - 1, d }; };
export const fechaCorta = (f: string) => { const x = partes(f); return `${x.d} ${CORTOS[x.m]}`; };
const fechaLarga = (f: string) => { const x = partes(f); return `${x.d} de ${MESES[x.m]}`; };
const fechaConAnio = (f: string) => { const x = partes(f); return `${x.d} de ${MESES[x.m]} de ${x.a}`; };

const VISTO = (id: string) => `kalo_ajuste_visto_${id}`;
const leerVisto = (id: string) => { try { return localStorage.getItem(VISTO(id)); } catch { return null; } };
const marcarVisto = (id: string, f: string) => { try { localStorage.setItem(VISTO(id), f); } catch { /* sin almacenamiento */ } };

// Avance desde el primer peso: cuánto se ha movido hacia la meta y cuánto falta
export function avance(p: PerfilActivo, rs: RegistroPeso[] | null) {
  const inicio = rs?.[0]?.peso ?? p.pesoInicial;
  const actual = rs?.length ? rs[rs.length - 1].peso : p.peso;
  const total = Math.abs(p.pesoMeta - inicio);
  const signo = p.pesoMeta >= inicio ? 1 : -1;
  const hecho = Math.max(0, (actual - inicio) * signo);
  return { inicio, actual, total, hecho, falta: Math.abs(p.pesoMeta - actual), pct: total > 0 ? Math.min(1, hecho / total) : 0 };
}

// Tarjeta de acceso en Perfil
export function TarjetaMeta({ p, abrir }: { p: PerfilActivo; abrir: () => void }) {
  const { lista } = usePesos(p.id);
  const a = avance(p, lista);
  const llega = fechaMeta(p, hoyISO(), a.actual);
  return (
    <Pressable onPress={abrir} style={[u.card, { gap: 6 }]}>
      <Text style={s.muted13}>Meta de peso</Text>
      <Text style={{ fontSize: 19, fontWeight: '700', color: C.text }}>
        {p.meta === 'mantener' ? `Mantener ${kg(p.pesoMeta)} kg` : `${kg(a.actual)} kg → ${kg(p.pesoMeta)} kg`}
      </Text>
      {p.meta !== 'mantener' && (
        <Text style={s.muted13}>{p.meta === 'subir' ? 'Subir' : 'Bajar'} {kg(p.ritmo)} kg por semana{llega ? ` · llegarías el ${fechaCorta(llega)}` : ''}</Text>
      )}
      {p.meta !== 'mantener' && <View style={[s.track, { marginTop: 4 }]}><View style={[s.fill, { width: `${Math.max(2, a.pct * 100)}%` }]} /></View>}
      <Text style={[s.link, { fontSize: 14 }]}>Anotar peso y ver avance →</Text>
    </Pressable>
  );
}

export function MetaPeso({ volver }: { volver: () => void }) {
  const { activo, actualizarPerfil } = useSesion();
  const p = activo!;
  const { lista, guardar } = usePesos(p.id);
  const hoy = hoyISO();
  const [peso, setPeso] = useState(p.peso);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [visto, setVisto] = useState(leerVisto(p.id));
  useEffect(() => { if (msg?.ok) { const t = setTimeout(() => setMsg(null), 2500); return () => clearTimeout(t); } }, [msg]);
  // El valor de arriba arranca en el peso de hoy si ya se anotó, si no en el último
  useEffect(() => { if (lista?.length) setPeso(lista[lista.length - 1].peso); }, [lista === null]);

  const en = gasto(p);
  const a = avance(p, lista);
  const ultimo = lista?.length ? lista[lista.length - 1] : null;
  const propuesta = lista ? proponerAjuste(p, lista, en.objetivo) : null;
  const verPropuesta = propuesta && ultimo && visto !== ultimo.fecha;
  const llegaHoy = fechaMeta(p, hoy, a.actual);

  const onGuardar = async () => {
    setGuardando(true);
    const e = await guardar(hoy, Math.round(peso * 10) / 10);
    if (!e) await actualizarPerfil(p.id, { peso: Math.round(peso * 10) / 10 });
    setGuardando(false);
    setMsg(e ? { ok: false, txt: e } : { ok: true, txt: 'Peso guardado' });
  };
  const cambiarMeta = (meta: Meta) => {
    const pesoMeta = meta === 'mantener' ? p.peso : meta === 'bajar' ? Math.min(p.pesoMeta, p.peso - 1) : Math.max(p.pesoMeta, p.peso + 1);
    actualizarPerfil(p.id, { meta, pesoMeta, ajusteKcal: 0, ajusteDesde: hoy });
  };

  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={volver} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>‹ Perfil</Text></Pressable>
      <View style={{ gap: 2, marginTop: -6 }}>
        <Text style={s.muted13}>{p.nombre}</Text>
        <Text style={u.h1}>Meta de peso</Text>
      </View>

      {/* Anotar el peso de hoy */}
      <View style={[u.card, { gap: 10 }]}>
        <Text style={s.muted13}>Tu peso de hoy · {fechaLarga(hoy)}</Text>
        <View style={s.entre}>
          <Text style={s.big}>{kg(peso)} <Text style={{ fontSize: 15, color: C.muted, fontWeight: '400' }}>kg</Text></Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => setPeso(v => Math.max(30, Math.round((v - 0.1) * 10) / 10))} style={s.btn}><Text style={s.btnTxt}>−</Text></Pressable>
            <Pressable onPress={() => setPeso(v => Math.min(250, Math.round((v + 0.1) * 10) / 10))} style={s.btn}><Text style={s.btnTxt}>+</Text></Pressable>
          </View>
        </View>
        {msg && <Text style={msg.ok ? { color: C.success, fontSize: 14 } : u.error}>{msg.txt}</Text>}
        <Boton texto={ultimo?.fecha === hoy ? 'Cambiar el peso de hoy' : 'Guardar peso'} onPress={onGuardar} cargando={guardando} />
      </View>

      {/* Gráfica: tus pesos contra la línea del plan */}
      {!lista ? <ActivityIndicator color={C.accent} /> : (
        <View style={[u.card, { gap: 6 }]}>
          <View style={[s.entre, { alignItems: 'baseline' }]}>
            <Text style={s.b15}>{p.meta === 'mantener' ? `Pesas ${kg(a.actual)} kg` : `Vas ${conSignoKg(a.actual - a.inicio)} kg`}</Text>
            {p.meta !== 'mantener' && <Text style={s.muted12}>{a.falta < 0.05 ? 'llegaste' : `faltan ${kg(a.falta)} kg`}</Text>}
          </View>
          <Grafica p={p} rs={lista} hoy={hoy} />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={s.muted12}><Text style={{ color: C.accent }}>●</Text> Tus pesos</Text>
            <Text style={s.muted12}>- - {p.meta === 'mantener' ? 'Tu meta' : `Plan (${kg(p.ritmo)} kg/semana)`}</Text>
          </View>
        </View>
      )}

      {p.meta !== 'mantener' && lista && (
        <View style={[u.card, { gap: 8 }]}>
          <View style={s.entre}><Text style={s.muted13}>Inicio {kg(a.inicio)} kg</Text><Text style={s.muted13}>{kg(a.hecho)} de {kg(a.total)} kg</Text></View>
          <View style={s.track}><View style={[s.fill, { width: `${Math.max(2, a.pct * 100)}%` }]} /></View>
        </View>
      )}

      {/* Llegó a la meta */}
      {lista && llego(p, a.actual) && (
        <View style={s.aviso}>
          <Text style={s.avisoTit}>¡Llegaste a tu meta!</Text>
          <Text style={u.soft}>Pesas {kg(a.actual)} kg y tu meta era {kg(p.pesoMeta)} kg. Para quedarte ahí, pasa a «Mantener».</Text>
          <Boton texto="Pasar a Mantener" onPress={() => actualizarPerfil(p.id, { meta: 'mantener', pesoMeta: a.actual, ajusteKcal: 0, ajusteDesde: hoy })} />
        </View>
      )}

      {/* Kalo propone ajustar (nunca lo aplica solo) */}
      {!llego(p, a.actual) && verPropuesta && propuesta && ultimo && (
        <View style={s.aviso}>
          <Text style={s.avisoTit}>
            {p.meta === 'mantener' ? (propuesta.real > 0 ? 'Tu peso está subiendo' : 'Tu peso está bajando') : propuesta.lento ? 'Vas más lento que el plan' : 'Vas más rápido que el plan'}
          </Text>
          <Text style={u.soft}>
            {`En ${fmt(propuesta.semanas)} semanas ${propuesta.real >= 0 ? 'subiste' : 'bajaste'} ${kg(Math.abs(propuesta.real * propuesta.semanas))} kg: ${kg(Math.abs(propuesta.real))} kg por semana`}
            {p.meta === 'mantener' ? '. ' : `, y el plan es ${kg(p.ritmo)}. `}
            {p.meta !== 'mantener' && (propuesta.llegaria ? `A este ritmo llegarías el ${fechaLarga(propuesta.llegaria)}. ` : 'A este ritmo no llegarías a tu meta. ')}
            {p.meta === 'mantener' ? 'Para quedarte en tu peso' : `Para volver al ritmo de ${kg(p.ritmo)} kg por semana`}, come {fmt(Math.abs(propuesta.cambio))} kcal {propuesta.cambio > 0 ? 'más' : 'menos'} al día.
          </Text>
          <Boton texto={`Comer ${fmt(propuesta.objetivoNuevo)} kcal al día`}
            onPress={() => actualizarPerfil(p.id, { ajusteKcal: (p.ajusteKcal ?? 0) + propuesta.cambio, ajusteDesde: ultimo.fecha })} />
          <Boton texto={`Seguir con ${fmt(en.objetivo)}`} tipo="borde" onPress={() => { marcarVisto(p.id, ultimo.fecha); setVisto(ultimo.fecha); }} />
        </View>
      )}

      <Segmento<Meta> opciones={[['bajar', 'Bajar'], ['mantener', 'Mantener'], ['subir', 'Subir']]} valor={p.meta} onCambio={cambiarMeta} />
      {p.meta !== 'mantener' && (
        <>
          <View style={[u.card, s.entre]}>
            <View>
              <Text style={s.muted13}>Peso meta</Text>
              <Text style={{ fontSize: 26, fontWeight: '700', color: C.accent }}>{kg(p.pesoMeta)} <Text style={{ fontSize: 14, color: C.muted, fontWeight: '400' }}>kg</Text></Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => actualizarPerfil(p.id, { pesoMeta: p.pesoMeta - 0.5 })} style={s.btn}><Text style={s.btnTxt}>−</Text></Pressable>
              <Pressable onPress={() => actualizarPerfil(p.id, { pesoMeta: p.pesoMeta + 0.5 })} style={s.btn}><Text style={s.btnTxt}>+</Text></Pressable>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={s.muted13}>Ritmo por semana</Text>
            <Chips<string> opciones={[['0.25', '0,25 kg'], ['0.5', '0,5 kg'], ['0.75', '0,75 kg']]} valor={String(p.ritmo)}
              onCambio={v => actualizarPerfil(p.id, { ritmo: Number(v), ajusteKcal: 0, ajusteDesde: hoy })} />
          </View>
        </>
      )}

      <View style={s.naranja}>
        <View>
          <Text style={{ color: C.onAccent, fontSize: 13, fontWeight: '600' }}>Tu objetivo diario</Text>
          <Text style={{ color: C.onAccent, fontSize: 32, fontWeight: '700', letterSpacing: -0.6 }}>{fmt(en.objetivo)} kcal</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
          <View style={{ width: '50%' }}><Text style={s.nTxt}>Gasto diario</Text><Text style={s.nB}>{fmt(en.total)} kcal</Text></View>
          <View style={{ width: '50%' }}><Text style={s.nTxt}>Ajuste</Text><Text style={s.nB}>{en.ajuste > 0 ? '+' : en.ajuste < 0 ? '−' : ''}{fmt(Math.abs(en.ajuste))} kcal</Text></View>
          {llegaHoy && <View style={{ width: '100%' }}><Text style={s.nTxt}>Llegarías a tu meta</Text><Text style={s.nB}>{fechaConAnio(llegaHoy)}</Text></View>}
        </View>
      </View>

      {lista && lista.length > 0 && (
        <View style={[u.card, { paddingVertical: 10 }]}>
          <Text style={[s.muted13, { paddingBottom: 6 }]}>Tus pesos</Text>
          {[...lista].reverse().slice(0, 12).map((r, i, arr) => {
            const ant = arr[i + 1];
            return (
              <View key={r.fecha} style={[s.entre, s.fila, i > 0 && { borderTopWidth: 1, borderTopColor: C.divider }]}>
                <Text style={s.b14n}>{fechaCorta(r.fecha)}</Text>
                <Text style={s.b14}>{kg(r.peso)} kg {ant ? <Text style={s.muted12}> {conSignoKg(r.peso - ant.peso)}</Text> : null}</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={[s.muted12, { paddingHorizontal: 4 }]}>Pésate una vez por semana, el mismo día, en la mañana y en ayunas.</Text>
    </View>
  );
}

// Escala única para puntos, líneas y etiquetas
function Grafica({ p, rs, hoy }: { p: PerfilActivo; rs: RegistroPeso[]; hoy: string }) {
  const W = 330, H = 150, x0 = 34, x1 = 318, yTop = 18, yBot = 120;
  const f0 = rs[0]?.fecha ?? hoy, p0 = rs[0]?.peso ?? p.peso;
  const ultimaF = rs.length ? rs[rs.length - 1].fecha : hoy;
  const fin0 = p.meta === 'mantener' ? sumarDias(ultimaF, 28) : (fechaMeta(p, f0, p0) ?? sumarDias(ultimaF, 28));
  const fin = fin0 < sumarDias(ultimaF, 7) ? sumarDias(ultimaF, 7) : fin0;
  const total = Math.max(1, dias(f0, fin));
  const pesos = [...rs.map(r => r.peso), p.pesoMeta, p0];
  const lo = Math.min(...pesos) - 0.5, hi = Math.max(...pesos) + 0.5;
  const X = (f: string) => x0 + (dias(f0, f) / total) * (x1 - x0);
  const Y = (kgv: number) => yBot - ((kgv - lo) / (hi - lo)) * (yBot - yTop);
  const yMeta = Y(p.pesoMeta), yIni = Y(p0);
  const planFin = p.meta === 'mantener' ? Y(p.pesoMeta) : Y(p0 + ritmoPlan(p) * (total / 7));
  const puntos = rs.map(r => `${X(r.fecha)},${Y(r.peso)}`).join(' ');
  const xu = rs.length ? X(ultimaF) : x0;
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={undefined} style={{ aspectRatio: W / H }}>
      <Line x1={x0} y1={yMeta} x2={x1} y2={yMeta} stroke={C.border} strokeWidth={1} />
      {Math.abs(yIni - yMeta) > 12 && <Line x1={x0} y1={yIni} x2={x1} y2={yIni} stroke={C.divider} strokeWidth={1} />}
      <SvgText x={x0 - 6} y={yMeta + 4} fill={C.muted} fontSize={11} textAnchor="end">{kg(p.pesoMeta)}</SvgText>
      {Math.abs(yIni - yMeta) > 12 && <SvgText x={x0 - 6} y={yIni + 4} fill={C.muted} fontSize={11} textAnchor="end">{kg(p0)}</SvgText>}
      <Line x1={x0} y1={p.meta === 'mantener' ? yMeta : yIni} x2={x1} y2={planFin} stroke={C.muted} strokeWidth={1.5} strokeDasharray="4 4" />
      {rs.length > 1 && <Polyline points={puntos} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {rs.map((r, i) => <Circle key={r.fecha} cx={X(r.fecha)} cy={Y(r.peso)} r={i === rs.length - 1 ? 5 : 3.5} fill={C.accent} />)}
      {p.meta !== 'mantener' && <Circle cx={x1} cy={yMeta} r={4} fill={C.bg} stroke={C.muted} strokeWidth={1.5} />}
      <SvgText x={x0} y={H - 8} fill={C.muted} fontSize={11}>{fechaCorta(f0)}</SvgText>
      {xu - x0 > 40 && x1 - xu > 40 && <SvgText x={xu} y={H - 8} fill={C.text} fontSize={11} textAnchor="middle">hoy</SvgText>}
      <SvgText x={x1} y={H - 8} fill={C.muted} fontSize={11} textAnchor="end">{fechaCorta(fin)}</SvgText>
    </Svg>
  );
}

const s = StyleSheet.create({
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12, color: C.muted },
  link: { fontSize: 15, fontWeight: '600', color: C.accent },
  b14: { fontSize: 14, fontWeight: '700', color: C.text },
  b14n: { fontSize: 14, color: C.text },
  b15: { fontSize: 15, fontWeight: '700', color: C.text },
  big: { fontSize: 40, fontWeight: '700', letterSpacing: -1.2, color: C.text },
  entre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  fila: { paddingVertical: 8 },
  btn: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: C.text, fontSize: 20, fontWeight: '600' },
  track: { height: 10, borderRadius: 5, backgroundColor: C.surface3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: C.accent },
  aviso: { borderWidth: 1, borderColor: C.success, backgroundColor: '#141A0E', borderRadius: 20, padding: 16, gap: 10 },
  avisoTit: { color: C.success, fontSize: 16, fontWeight: '700' },
  naranja: { backgroundColor: C.accent, borderRadius: 22, padding: 18, gap: 12 },
  nTxt: { color: C.onAccent, fontSize: 13.5 },
  nB: { color: C.onAccent, fontSize: 14, fontWeight: '700' },
});
