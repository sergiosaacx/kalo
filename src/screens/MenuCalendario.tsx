import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Boton, Chips, Segmento, u } from '../components/ui';
import { aplicarVarios, type ItemOpcion, type Opcion } from '../data/opciones';
import { COMIDAS, hoyISO, nombreComida, type ComidaId, type usePlanDia } from '../data/plan';
import { supabase } from '../lib/supabase';
import { fmt } from '../logic/energia';
import { DIAS_CORTO, MESES, desdeISO, diaTexto, fechaLarga, sumarDias, totales, type Mapa } from '../logic/menu';
import { recomendar } from '../logic/recomendar';
import { C } from '../theme';

type HoraAviso = Record<ComidaId, number>; // minutos desde medianoche
const HORAS_INICIALES: HoraAviso = { des: 7 * 60, alm: 12 * 60 + 30, cena: 19 * 60, snack: 16 * 60 };
const VERBO: Record<ComidaId, string> = { des: 'Hora de desayunar', alm: 'Hora de almorzar', cena: 'Hora de cenar', snack: 'Hora de tu snack' };
const hora12 = (m: number) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };
const aMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const aHora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Qué comidas tienen algo planeado, día por día, en un rango de fechas
function useMes(perfilId: string, desde: string, hasta: string, version: number) {
  const [mapa, setMapa] = useState<Map<string, Set<ComidaId>>>(new Map());
  useEffect(() => {
    supabase.from('plan').select('fecha, comida, plan_items(id)').eq('perfil_id', perfilId).gte('fecha', desde).lte('fecha', hasta)
      .then(({ data }) => {
        const m = new Map<string, Set<ComidaId>>();
        for (const p of (data ?? []) as { fecha: string; comida: ComidaId; plan_items: { id: string }[] }[]) {
          if (!p.plan_items.length) continue;
          if (!m.has(p.fecha)) m.set(p.fecha, new Set());
          m.get(p.fecha)!.add(p.comida);
        }
        setMapa(m);
      });
  }, [perfilId, desde, hasta, version]);
  return mapa;
}

export function Calendario({ perfilId, dia, setDia, plan, porId, opciones, presupuesto, cambiar }: {
  perfilId: string; dia: string; setDia: (d: string) => void; plan: ReturnType<typeof usePlanDia>; porId: Mapa;
  opciones: Opcion[]; presupuesto: (c: ComidaId) => number; cambiar: (c: ComidaId) => void;
}) {
  const [modo, setModo] = useState<'manual' | 'auto'>('manual');
  const [version, setVersion] = useState(0);
  const d = desdeISO(dia);
  const primero = new Date(d.getFullYear(), d.getMonth(), 1), ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const desde = hoyISO(primero), hasta = hoyISO(ultimo);
  const mes = useMes(perfilId, desde, hasta, version + (plan.items?.length ?? 0));
  const hueco = (primero.getDay() + 6) % 7; // la cuadrícula empieza en lunes
  const celdas: (string | null)[] = [...Array(hueco).fill(null), ...Array.from({ length: ultimo.getDate() }, (_, k) => sumarDias(desde, k))];
  const hoy = hoyISO();
  const items = plan.items ?? [];

  return (
    <View style={{ gap: 12 }}>
      <View style={s.filaEntre}>
        <Pressable onPress={() => setDia(hoyISO(new Date(d.getFullYear(), d.getMonth() - 1, 1)))} style={s.flecha}><Text style={s.flechaTxt}>‹</Text></Pressable>
        <Text style={s.mes}>{MESES[d.getMonth()][0].toUpperCase() + MESES[d.getMonth()].slice(1)} {d.getFullYear()}</Text>
        <Pressable onPress={() => setDia(hoyISO(new Date(d.getFullYear(), d.getMonth() + 1, 1)))} style={s.flecha}><Text style={s.flechaTxt}>›</Text></Pressable>
      </View>
      <View style={[u.card, { padding: 12, gap: 6 }]}>
        <View style={s.semana}>{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, k) => <Text key={k} style={s.cab}>{l}</Text>)}</View>
        <View style={s.grilla}>
          {celdas.map((f, k) => {
            if (!f) return <View key={`v${k}`} style={s.celda} />;
            const on = f === dia, pasado = f < hoy, puestas = mes.get(f);
            return (
              <Pressable key={f} onPress={() => setDia(f)}
                style={[s.celda, s.celdaDia, f === hoy && { borderColor: C.muted }, on && { backgroundColor: C.accent, borderColor: C.accent }, pasado && !on && { opacity: 0.55 }]}>
                <Text style={[s.num, { color: on ? C.onAccent : C.text }]}>{desdeISO(f).getDate()}</Text>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {COMIDAS.map(([c]) => <View key={c} style={[s.punto, { backgroundColor: puestas?.has(c) ? (on ? C.onAccent : C.accent) : (on ? 'rgba(11,11,12,0.25)' : C.border) }]} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Segmento<'manual' | 'auto'> opciones={[['manual', 'Manual'], ['auto', 'Automático']]} valor={modo} onCambio={setModo} />

      {modo === 'manual' ? (
        <View style={[u.card, { gap: 4, padding: 16 }]}>
          <Text style={s.nombre}>{diaTexto(dia)[0].toUpperCase() + diaTexto(dia).slice(1)} de {MESES[d.getMonth()]} · {fmt(totales(items, porId).k)} kcal</Text>
          {COMIDAS.map(([c, label]) => {
            const deLa = items.filter(i => i.comida === c);
            return (
              <View key={c} style={s.comida}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.overline}>{label}</Text>
                  <Text style={s.comidaNombre} numberOfLines={1}>{plan.nombres[c] ?? (deLa.length ? 'Combinación libre' : 'Sin planear')}</Text>
                </View>
                <Text style={s.kcal}>{deLa.length ? `${fmt(totales(deLa, porId).k)} kcal` : '—'}</Text>
                <Pressable onPress={() => cambiar(c)} style={s.boton}><Text style={s.botonTxt}>{deLa.length ? 'Cambiar' : 'Elegir'}</Text></Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <Automatico perfilId={perfilId} dia={dia} opciones={opciones} porId={porId} presupuesto={presupuesto}
          listo={() => { setVersion(v => v + 1); plan.recargar(); }} />
      )}
    </View>
  );
}

function Automatico({ perfilId, dia, opciones, porId, presupuesto, listo }: {
  perfilId: string; dia: string; opciones: Opcion[]; porId: Mapa; presupuesto: (c: ComidaId) => number; listo: () => void;
}) {
  const [dias, setDias] = useState(15);
  const [variedad, setVariedad] = useState<'diario' | 'pocas'>('diario');
  const [porSemana, setPorSemana] = useState(3);
  const [comidas, setComidas] = useState<Record<ComidaId, boolean>>({ des: true, alm: true, cena: true, snack: false });
  const [avisos, setAvisos] = useState(true);
  const [horas, setHoras] = useState<HoraAviso>(HORAS_INICIALES);
  const [banner, setBanner] = useState(false);
  const [repartiendo, setRepartiendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; txt: string } | null>(null);

  // Avisos guardados del perfil
  useEffect(() => {
    supabase.from('avisos').select('*').eq('perfil_id', perfilId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setAvisos(data.activos);
      setHoras({ des: aMin(data.des), alm: aMin(data.alm), cena: aMin(data.cena), snack: aMin(data.snack) });
    });
  }, [perfilId]);

  const inicio = dia > hoyISO() ? dia : sumarDias(hoyISO(), 1); // si es hoy o un día pasado, desde mañana
  const fin = sumarDias(inicio, dias - 1);
  const elegidas = COMIDAS.filter(([c]) => comidas[c]);

  // Opciones para cada comida: primero las tuyas, luego las de Kalo que mejor cuadran, y si faltan, recomendaciones nuevas
  const listaPara = useCallback((c: ComidaId, necesarias: number) => {
    const pres = presupuesto(c);
    const tuyas = opciones.filter(o => o.comida === c && o.fuente !== 'kalo' && o.items.length);
    const kalo = opciones.filter(o => o.comida === c && o.fuente === 'kalo' && o.items.length)
      .sort((a, b) => Math.abs(totales(a.items, porId).k - pres) - Math.abs(totales(b.items, porId).k - pres));
    const lista: { items: ItemOpcion[]; nombre: string; opcionId: string | null }[] =
      [...tuyas, ...kalo].map(o => ({ items: o.items, nombre: o.nombre, opcionId: o.id }));
    for (let semilla = 1; lista.length < necesarias && semilla < 80; semilla++) {
      const r = recomendar(c, semilla, pres, porId);
      if (r && !lista.some(x => x.nombre === r.nombre)) lista.push({ items: r.items, nombre: r.nombre, opcionId: null });
    }
    return { lista: lista.slice(0, Math.max(necesarias, 1)), tuyas: tuyas.length };
  }, [opciones, porId, presupuesto]);

  const repartir = async () => {
    if (!elegidas.length) return;
    setRepartiendo(true); setAviso(null);
    const necesarias = variedad === 'diario' ? dias : porSemana * Math.ceil(dias / 7);
    const entradas = elegidas.flatMap(([c]) => {
      const { lista } = listaPara(c, necesarias);
      return Array.from({ length: dias }, (_, j) => {
        // «Pocas opciones»: la semana w usa sus k opciones y las alterna día a día
        const o = variedad === 'diario' ? lista[j % lista.length] : lista[(Math.floor(j / 7) * porSemana + ((j % 7) % porSemana)) % lista.length];
        return { fecha: sumarDias(inicio, j), comida: c, items: o.items, nombre: o.nombre, opcionId: o.opcionId };
      });
    });
    const e = await aplicarVarios(perfilId, entradas);
    await supabase.from('avisos').upsert({ perfil_id: perfilId, activos: avisos, des: aHora(horas.des), alm: aHora(horas.alm), cena: aHora(horas.cena), snack: aHora(horas.snack) });
    setRepartiendo(false);
    if (e) return setAviso({ ok: false, txt: e });
    setAviso({ ok: true, txt: `Listo: ${dias} días planeados, del ${fechaLarga(inicio)} al ${fechaLarga(fin)}.` });
    listo();
  };

  const ejemplo = elegidas.find(([c]) => c === 'alm') ?? elegidas[0];
  const ejemploOp = ejemplo ? listaPara(ejemplo[0], 1).lista[0] : null;

  return (
    <View style={{ gap: 12 }}>
      {banner && ejemplo && ejemploOp && (
        <Pressable onPress={() => setBanner(false)} style={s.banner}>
          <View style={s.bannerIcono}><Text style={{ color: C.onAccent, fontWeight: '700', fontSize: 17 }}>K</Text></View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View style={s.filaEntre}><Text style={{ color: C.text, fontSize: 12, fontWeight: '600' }}>Kalo</Text><Text style={{ color: C.muted, fontSize: 12 }}>{DIAS_CORTO[desdeISO(inicio).getDay()]} · {hora12(horas[ejemplo[0]])}</Text></View>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{VERBO[ejemplo[0]]}</Text>
            <Text style={{ color: C.soft, fontSize: 13 }} numberOfLines={2}>{ejemploOp.nombre} · {fmt(totales(ejemploOp.items, porId).k)} kcal. Toca para ver tu menú.</Text>
          </View>
        </Pressable>
      )}

      <View style={[u.card, { gap: 10 }]}>
        <Text style={s.overline}>Periodo</Text>
        <Segmento<string> valor={String(dias)} onCambio={v => { setDias(Number(v)); setAviso(null); }}
          opciones={[['7', 'Semana', '7 días'], ['15', 'Quincena', '15 días'], ['30', 'Mes', '30 días']]} />
        <Text style={s.muted}>Del {fechaLarga(inicio)} al {fechaLarga(fin)}</Text>
      </View>

      <View style={[u.card, { gap: 10 }]}>
        <Text style={s.overline}>Variedad</Text>
        <Segmento<'diario' | 'pocas'> valor={variedad} onCambio={v => { setVariedad(v); setAviso(null); }}
          opciones={[['diario', 'Distinto cada día', 'un menú nuevo por día'], ['pocas', 'Pocas opciones', 'se alternan en la semana']]} />
        {variedad === 'pocas' && (
          <Chips<string> valor={String(porSemana)} onCambio={v => setPorSemana(Number(v))} opciones={[['2', '2 opciones por semana'], ['3', '3 opciones por semana']]} />
        )}
      </View>

      <View style={[u.card, { gap: 10 }]}>
        <Text style={s.overline}>Comidas a planear</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COMIDAS.map(([c, l]) => (
            <Pressable key={c} onPress={() => setComidas({ ...comidas, [c]: !comidas[c] })} style={[s.chip, comidas[c] && s.chipOn]}>
              <Text style={[s.chipTxt, { color: comidas[c] ? C.onAccent : C.text }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
        {elegidas.map(([c, l]) => {
          const necesarias = variedad === 'diario' ? dias : porSemana * Math.ceil(dias / 7);
          const { tuyas } = listaPara(c, necesarias);
          return (
            <Text key={c} style={s.muted}>
              {l}: {variedad === 'diario'
                ? (tuyas >= dias ? `${dias} de tus opciones` : `${tuyas} tuyas + hasta ${dias - tuyas} de Kalo`)
                : `${porSemana} opciones que se alternan${tuyas < porSemana ? ' (Kalo completa)' : ''}`}
            </Text>
          );
        })}
      </View>

      <View style={[u.card, { gap: 10 }]}>
        <View style={s.filaEntre}>
          <View style={{ flex: 1 }}>
            <Text style={s.nombre}>Avisos a la hora de comer</Text>
            <Text style={s.muted}>Un aviso con lo que te toca en cada comida.</Text>
          </View>
          <Pressable onPress={() => setAvisos(!avisos)} style={[s.switch, { backgroundColor: avisos ? C.accent : C.border }]}>
            <View style={[s.perilla, { left: avisos ? 23 : 3 }]} />
          </Pressable>
        </View>
        {avisos && elegidas.map(([c, l]) => (
          <View key={c} style={s.filaEntre}>
            <Text style={{ color: C.text, fontSize: 14, flex: 1 }}>{l}</Text>
            <Pressable onPress={() => setHoras({ ...horas, [c]: Math.max(5 * 60, horas[c] - 30) })} style={s.paso}><Text style={s.pasoTxt}>−</Text></Pressable>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', width: 92, textAlign: 'center' }}>{hora12(horas[c])}</Text>
            <Pressable onPress={() => setHoras({ ...horas, [c]: Math.min(23 * 60, horas[c] + 30) })} style={s.paso}><Text style={s.pasoTxt}>+</Text></Pressable>
          </View>
        ))}
        {avisos && elegidas.length > 0 && (
          <Pressable onPress={() => { setBanner(true); setTimeout(() => setBanner(false), 4500); }} style={{ minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ color: C.accent, fontWeight: '600', fontSize: 14 }}>Ver ejemplo de aviso</Text>
          </Pressable>
        )}
      </View>

      {aviso && <Text style={aviso.ok ? { color: C.success, fontSize: 14 } : u.error}>{aviso.txt}</Text>}
      <Boton texto={elegidas.length ? `Distribuir ${dias} días` : 'Elige al menos una comida'} onPress={repartir} cargando={repartiendo} desactivado={!elegidas.length} />
      <Text style={[s.muted, { fontSize: 12 }]}>Si ya tenías algo planeado en esos días, se reemplaza por lo nuevo.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  flecha: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  flechaTxt: { fontSize: 22, color: C.text },
  mes: { fontSize: 16, fontWeight: '700', color: C.text },
  semana: { flexDirection: 'row' },
  cab: { flex: 1, textAlign: 'center', fontSize: 12, color: C.muted },
  grilla: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  celdaDia: { borderRadius: 12, borderWidth: 1, borderColor: 'transparent', backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', gap: 4, transform: [{ scale: 0.92 }] },
  num: { fontSize: 14, fontWeight: '600' },
  punto: { width: 5, height: 5, borderRadius: 3 },
  nombre: { fontSize: 16, fontWeight: '700', color: C.text },
  overline: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.muted },
  muted: { fontSize: 13, color: C.muted },
  comida: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider },
  comidaNombre: { fontSize: 15, fontWeight: '600', color: C.text },
  kcal: { fontSize: 13, color: C.muted },
  boton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  botonTxt: { fontSize: 13, fontWeight: '600', color: C.accent },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipTxt: { fontSize: 13, fontWeight: '600' },
  switch: { width: 52, height: 32, borderRadius: 16 },
  perilla: { position: 'absolute', top: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: C.text },
  paso: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  pasoTxt: { fontSize: 18, color: C.text, fontWeight: '600' },
  banner: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(46,46,50,0.97)', borderRadius: 22, padding: 14, alignItems: 'flex-start' },
  bannerIcono: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
});
