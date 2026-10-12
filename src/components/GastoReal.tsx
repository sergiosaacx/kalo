import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Boton, u } from './ui';
import { useAlimentos } from '../data/alimentos';
import { porDia, usePlanRango } from '../data/historial';
import { hoyISO } from '../data/plan';
import { usePesos } from '../data/peso';
import { useSesion } from '../data/sesion';
import { fmt, gastoFormula } from '../logic/energia';
import { DIAS_MIN, PESOS_MIN, VENTANA, medirGastoReal } from '../logic/gastoReal';
import { sumarDias } from '../logic/peso';
import { C } from '../theme';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaTxt = (f: string) => { const [, m, d] = f.split('-').map(Number); return `${d} de ${MESES[m - 1]}`; };
const VISTO = (id: string) => `kalo_gastoreal_visto_${id}`;
const leerVisto = (id: string) => { try { return Number(localStorage.getItem(VISTO(id)) ?? 0); } catch { return 0; } };

// Pestaña Gasto: cuánto gasta el cuerpo de verdad, medido con lo que come y lo que pesa (nada cambia si no lo acepta)
export function TarjetaGastoReal() {
  const { activo, actualizarPerfil } = useSesion();
  const p = activo!;
  const hoy = hoyISO();
  const { items } = usePlanRango(p.id, sumarDias(hoy, -VENTANA), hoy);
  const { lista: pesos } = usePesos(p.id);
  const { lista } = useAlimentos();
  const [visto, setVisto] = useState(leerVisto(p.id));
  const [ocupado, setOcupado] = useState(false);
  const porId = useMemo(() => new Map((lista ?? []).map(a => [a.id, a])), [lista]);
  const med = useMemo(() => (items && pesos && lista ? medirGastoReal(porDia(items, porId), pesos, hoy) : null), [items, pesos, lista]);
  if (!med) return <View style={[u.card, { alignItems: 'center' }]}><ActivityIndicator color={C.accent} /></View>;

  const formula = gastoFormula(p).total;
  const usar = async (g: number) => {
    setOcupado(true);
    await actualizarPerfil(p.id, { gastoReal: g, gastoRealFecha: hoy, ajusteKcal: 0, ajusteDesde: hoy });
    setOcupado(false);
  };
  const descartar = (g: number) => { try { localStorage.setItem(VISTO(p.id), String(g)); } catch { /* sin almacenamiento */ } setVisto(g); };

  if (!med.listo) {
    const avance = (Math.min(med.diasValidos, DIAS_MIN) / DIAS_MIN + Math.min(med.pesos, PESOS_MIN) / PESOS_MIN) / 2;
    return (
      <View style={[u.card, { gap: 10 }]}>
        {p.gastoReal ? <EnUso p={p} formula={formula} volver={() => actualizarPerfil(p.id, { gastoReal: null, gastoRealFecha: null })} /> : null}
        <Text style={s.muted13}>Tu gasto real · midiendo</Text>
        <Text style={s.txt}>
          Lleva <Text style={s.b}>{Math.min(med.diasValidos, DIAS_MIN)} de {DIAS_MIN} días</Text> anotados y <Text style={s.b}>{Math.min(med.pesos, PESOS_MIN)} de {PESOS_MIN} pesos</Text>.
        </Text>
        <View style={s.track}><View style={[s.fill, { width: `${Math.max(3, avance * 100)}%` }]} /></View>
        <Text style={s.muted12}>
          {med.pesos >= PESOS_MIN && !med.separados ? 'Los pesos deben estar separados por al menos una semana. ' : ''}
          Anota todo lo que comes (también el aceite y la panela) y pésate cada semana, en ayunas. Un día cuenta si tiene al menos 2 comidas anotadas.
        </Text>
      </View>
    );
  }

  const dif = med.gasto - formula;
  const subio = med.cambioKg > 0.05 ? `subiste ${med.cambioKg.toLocaleString('es-CO')} kg` : med.cambioKg < -0.05 ? `bajaste ${Math.abs(med.cambioKg).toLocaleString('es-CO')} kg` : 'tu peso se mantuvo';
  const texto = `Comiste en promedio ${fmt(med.promedio)} kcal y ${subio}. Tu cuerpo gasta unas ${fmt(Math.abs(dif))} kcal ${dif >= 0 ? 'más' : 'menos'} de lo que calcula la fórmula (${fmt(formula)}).`;

  // Ya lo usa: solo se vuelve a proponer si cambió más de 100 kcal
  if (p.gastoReal && Math.abs(med.gasto - p.gastoReal) <= 100) {
    return <View style={[u.card, { gap: 10 }]}><EnUso p={p} formula={formula} volver={() => actualizarPerfil(p.id, { gastoReal: null, gastoRealFecha: null })} /></View>;
  }
  if (visto === med.gasto) {
    return p.gastoReal ? <View style={[u.card, { gap: 10 }]}><EnUso p={p} formula={formula} volver={() => actualizarPerfil(p.id, { gastoReal: null, gastoRealFecha: null })} /></View> : null;
  }
  return (
    <View style={[u.card, { gap: 10 }]}>
      <Text style={s.muted13}>{p.gastoReal ? 'Tu gasto real cambió' : `Tu gasto real · ${med.diasMedidos} días`}</Text>
      <Text style={s.big}>{fmt(med.gasto)} <Text style={s.unidad}>kcal al día</Text></Text>
      <Text style={s.txt}>{texto}</Text>
      <Boton texto={p.gastoReal ? `Usar ${fmt(med.gasto)} kcal` : 'Usar mi gasto real'} onPress={() => usar(med.gasto)} cargando={ocupado} />
      <Boton texto={p.gastoReal ? `Seguir con ${fmt(p.gastoReal)}` : 'Seguir con la fórmula'} tipo="borde" onPress={() => descartar(med.gasto)} />
    </View>
  );
}

function EnUso({ p, formula, volver }: { p: { gastoReal?: number | null; gastoRealFecha?: string | null }; formula: number; volver: () => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.muted13}>Usando tu gasto real</Text>
      <Text style={s.big}>{fmt(p.gastoReal ?? 0)} <Text style={s.unidad}>kcal al día</Text></Text>
      <Text style={s.muted12}>Medido {p.gastoRealFecha ? `el ${fechaTxt(p.gastoRealFecha)}` : ''} con lo que comiste y lo que pesaste. La fórmula decía {fmt(formula)}. Kalo lo vuelve a medir cada semana.</Text>
      <Pressable onPress={volver} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={s.link}>Volver a la fórmula</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12.5, color: C.muted, lineHeight: 18 },
  txt: { fontSize: 15, color: C.soft, lineHeight: 21 },
  b: { color: C.text, fontWeight: '700' },
  big: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8, color: C.text },
  unidad: { fontSize: 15, color: C.muted, fontWeight: '400' },
  link: { fontSize: 14, fontWeight: '600', color: C.accent },
  track: { height: 8, borderRadius: 4, backgroundColor: C.surface3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: C.accent },
});
