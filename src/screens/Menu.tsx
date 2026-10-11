import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlimentoPicker } from '../components/AlimentoPicker';
import { Boton, Chips, Segmento, u } from '../components/ui';
import { nutrientes, useAlimentos, type AlimentoDB } from '../data/alimentos';
import { DIFICULTAD, aplicarAlDia, borrarOpcion, guardarOpcion, tiempoTexto, useOpciones, type Dificultad, type ItemOpcion, type Opcion } from '../data/opciones';
import { COMIDAS, agregarAlPlan, comidaDeAhora, hoyISO, nombreComida, usePlanDia, type ComidaId } from '../data/plan';
import { useSesion } from '../data/sesion';
import { PRESUPUESTO, conSigno, fmt, gasto } from '../logic/energia';
import { C } from '../theme';

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fq = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');
const desdeISO = (f: string) => { const [a, m, d] = f.split('-').map(Number); return new Date(a, m - 1, d); };
const sumarDias = (f: string, n: number) => { const d = desdeISO(f); d.setDate(d.getDate() + n); return hoyISO(d); };
const diaTexto = (f: string) => { const d = desdeISO(f); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()}`; };
const diaCorto = (f: string) => { const d = desdeISO(f); return f === hoyISO() ? 'hoy' : `${DIAS_CORTO[d.getDay()].toLowerCase()} ${d.getDate()}`; };

type Mapa = Map<string, AlimentoDB>;
function totales(items: ItemOpcion[], porId: Mapa) {
  return items.reduce((a, it) => {
    const f = porId.get(it.alimento_id);
    if (!f) return a;
    const n = nutrientes(f, it.cantidad);
    a.k += n.kcal; a.p += n.p; a.c += n.c; a.g += n.gr;
    return a;
  }, { k: 0, p: 0, c: 0, g: 0 });
}

// «En tu meta» si queda a ±10 % de lo que le toca a esa comida
function ajuste(k: number, presupuesto: number) {
  const d = k - presupuesto;
  return Math.abs(d) <= presupuesto * 0.1 ? { txt: 'En tu meta', color: C.success } : { txt: `${conSigno(d)} kcal`, color: d > 0 ? C.accentLight : C.muted };
}

// Nombre automático: «Pollo con arroz y espinaca»
function nombreAuto(items: ItemOpcion[], porId: Mapa) {
  const n = items.map(i => porId.get(i.alimento_id)?.nombre).filter(Boolean) as string[];
  if (!n.length) return 'Nueva opción';
  if (n.length === 1) return n[0];
  const resto = n.slice(1).map(x => x.toLowerCase());
  return `${n[0]} con ${resto.length === 1 ? resto[0] : resto.slice(0, -1).join(', ') + ' y ' + resto[resto.length - 1]}`;
}

interface Borrador { id?: string; comida: ComidaId; nombre: string; items: ItemOpcion[]; tiempo_min: number | null; dificultad: Dificultad | null }

export function Menu() {
  const { activo } = useSesion();
  const { lista: alimentos } = useAlimentos();
  const { lista: opciones } = useOpciones();
  const [vista, setVista] = useState<'semana' | 'opciones'>('semana');
  const [dia, setDia] = useState(hoyISO());
  const [eligiendo, setEligiendo] = useState<ComidaId | null>(null);    // «Cambiar» desde Semana
  const [comidaOp, setComidaOp] = useState<ComidaId>(comidaDeAhora());
  const [rapidas, setRapidas] = useState(false);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [picker, setPicker] = useState<{ destino: 'dia' | 'borrador'; comida: ComidaId } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const plan = usePlanDia(activo?.id, dia);
  const porId: Mapa = useMemo(() => new Map((alimentos ?? []).map(a => [a.id, a])), [alimentos]);

  if (!activo) return null;
  const objetivo = gasto(activo).objetivo;
  const presupuesto = (c: ComidaId) => Math.round(objetivo * PRESUPUESTO[c]);

  const mostrarAviso = (t: string) => { setAviso(t); setTimeout(() => setAviso(null), 2500); };

  const usar = async (o: Opcion) => {
    const comida = eligiendo ?? o.comida;
    const e = await aplicarAlDia(activo.id, dia, comida, o.items, o.nombre, o.id);
    if (e) return mostrarAviso(e);
    await plan.recargar();
    setEligiendo(null);
    setVista('semana');
    mostrarAviso(`Listo: ${o.nombre} en ${nombreComida(comida).toLowerCase()} del ${diaTexto(dia)}.`);
  };

  // Llena las 4 comidas con las opciones que más se acercan a lo que le toca a cada una (varía según el día)
  const armarDia = async () => {
    if (!opciones) return;
    const semilla = desdeISO(dia).getDate();
    for (const [c] of COMIDAS) {
      const cands = opciones.filter(o => o.comida === c && o.items.length)
        .map(o => ({ o, d: Math.abs(totales(o.items, porId).k - presupuesto(c)) }))
        .sort((a, b) => a.d - b.d).slice(0, 4);
      if (!cands.length) continue;
      const { o } = cands[semilla % cands.length];
      await aplicarAlDia(activo.id, dia, c, o.items, o.nombre, o.id);
    }
    await plan.recargar();
    mostrarAviso(`Listo: armamos tu ${diaTexto(dia)}.`);
  };

  // ── Buscador de alimentos (para el día o para la opción que se está creando)
  if (picker) {
    return (
      <AlimentoPicker titulo={picker.destino === 'dia' ? `Agregar a ${nombreComida(picker.comida).toLowerCase()} · ${diaCorto(dia)}` : 'Agregar a la opción'}
        onCerrar={() => setPicker(null)}
        onElegir={async a => {
          if (picker.destino === 'borrador' && borrador) {
            const ya = borrador.items.find(i => i.alimento_id === a.id);
            setBorrador({ ...borrador, items: ya ? borrador.items.map(i => (i === ya ? { ...i, cantidad: i.cantidad + 1 } : i)) : [...borrador.items, { alimento_id: a.id, cantidad: 1 }] });
          } else {
            const e = await agregarAlPlan(activo.id, picker.comida, a.id, 1, dia);
            if (e) return mostrarAviso(e);
            await plan.recargar();
          }
          setPicker(null);
        }} />
    );
  }

  // ── Crear o editar una opción propia
  if (borrador) {
    const t = totales(borrador.items, porId), pres = presupuesto(borrador.comida);
    return (
      <Constructor b={borrador} set={setBorrador} t={t} presupuesto={pres} porId={porId}
        agregar={() => setPicker({ destino: 'borrador', comida: borrador.comida })}
        cancelar={() => setBorrador(null)}
        guardar={async () => {
          const e = await guardarOpcion({ ...borrador, nombre: borrador.nombre.trim() || nombreAuto(borrador.items, porId) });
          if (e) return e;
          setComidaOp(borrador.comida); setBorrador(null); setVista('opciones');
          mostrarAviso('Opción guardada.');
          return null;
        }}
        borrar={borrador.id ? async () => { const e = await borrarOpcion(borrador.id!); if (!e) setBorrador(null); return e; } : undefined} />
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2, paddingTop: 4 }}>
        <Text style={s.muted13}>{eligiendo ? `Eligiendo ${nombreComida(eligiendo).toLowerCase()} para el ${diaTexto(dia)}` : 'Lo que vas a comer'}</Text>
        <Text style={u.h1}>Menú</Text>
      </View>
      <Segmento<'semana' | 'opciones'> opciones={[['semana', 'Semana'], ['opciones', 'Opciones']]} valor={vista}
        onCambio={v => { setVista(v); setEligiendo(null); }} />
      {aviso && <Text style={s.aviso}>{aviso}</Text>}

      {vista === 'semana' ? (
        <Semana dia={dia} setDia={setDia} plan={plan} porId={porId} objetivo={objetivo} presupuesto={presupuesto} armar={armarDia}
          cambiar={c => { setEligiendo(c); setComidaOp(c); setVista('opciones'); }}
          agregar={c => setPicker({ destino: 'dia', comida: c })} />
      ) : (
        <View style={{ gap: 12 }}>
          <Chips<ComidaId> opciones={COMIDAS} valor={eligiendo ?? comidaOp} onCambio={c => { setComidaOp(c); if (eligiendo) setEligiendo(c); }} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable onPress={() => setRapidas(!rapidas)} style={[s.filtro, rapidas && s.filtroOn]}>
              <Text style={[s.filtroTxt, rapidas && { color: C.accent }]}>Rápidas · 20 min o menos</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setBorrador({ comida: eligiendo ?? comidaOp, nombre: '', items: [], tiempo_min: null, dificultad: null })} style={s.crear}>
              <Text style={s.crearTxt}>+ Crear opción</Text>
            </Pressable>
          </View>
          {(opciones ?? [])
            .filter(o => o.comida === (eligiendo ?? comidaOp) && (!rapidas || (o.tiempo_min !== null && o.tiempo_min <= 20)))
            .map(o => {
              const t = totales(o.items, porId), aj = ajuste(t.k, presupuesto(o.comida));
              return (
                <View key={o.id} style={[u.card, { gap: 10, padding: 16 }]}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {o.items.slice(0, 5).map(i => {
                      const f = porId.get(i.alimento_id);
                      return f?.foto_url ? <Image key={i.alimento_id} source={{ uri: f.foto_url }} style={s.mini} /> : <View key={i.alimento_id} style={s.mini} />;
                    })}
                  </View>
                  <View style={{ gap: 3 }}>
                    <Text style={s.nombre}>{o.nombre}</Text>
                    <Text style={s.muted13} numberOfLines={2}>{o.items.map(i => porId.get(i.alimento_id)?.nombre).filter(Boolean).join(' · ')}</Text>
                    <Text style={s.prep}>
                      {[o.tiempo_min !== null ? tiempoTexto(o.tiempo_min) : null, o.dificultad ? DIFICULTAD[o.dificultad] : null, o.fuente === 'kalo' ? 'Kalo' : 'Tuya']
                        .filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={s.filaEntre}>
                    <Text style={s.kcal}>{fmt(t.k)} <Text style={s.muted13}>kcal</Text></Text>
                    <Text style={[s.ajuste, { color: aj.color }]}>{aj.txt}</Text>
                  </View>
                  <Text style={s.muted13}>P {fmt(t.p)} g · C {fmt(t.c)} g · G {fmt(t.g)} g</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {o.fuente !== 'kalo' && (
                      <View style={{ flex: 1 }}><Boton texto="Editar" tipo="borde"
                        onPress={() => setBorrador({ id: o.id, comida: o.comida, nombre: o.nombre, items: o.items.map(i => ({ ...i })), tiempo_min: o.tiempo_min, dificultad: o.dificultad })} /></View>
                    )}
                    <View style={{ flex: 2 }}><Boton texto={`Usar el ${diaCorto(dia)}`} onPress={() => usar(o)} /></View>
                  </View>
                </View>
              );
            })}
        </View>
      )}
    </View>
  );
}

function Semana({ dia, setDia, plan, porId, objetivo, presupuesto, armar, cambiar, agregar }: {
  dia: string; setDia: (d: string) => void; plan: ReturnType<typeof usePlanDia>; porId: Mapa; objetivo: number;
  presupuesto: (c: ComidaId) => number; armar: () => Promise<void>; cambiar: (c: ComidaId) => void; agregar: (c: ComidaId) => void;
}) {
  const [armando, setArmando] = useState(false);
  const d = desdeISO(dia);
  const lunes = sumarDias(dia, -((d.getDay() + 6) % 7));
  const semana = Array.from({ length: 7 }, (_, k) => sumarDias(lunes, k));
  const fin = desdeISO(semana[6]);
  const items = plan.items ?? [];
  const planeado = totales(items, porId).k;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.filaEntre}>
        <Pressable onPress={() => setDia(sumarDias(dia, -7))} style={s.flecha}><Text style={s.flechaTxt}>‹</Text></Pressable>
        <Text style={s.semanaTxt}>{desdeISO(lunes).getDate()} – {fin.getDate()} de {MESES[fin.getMonth()]}</Text>
        <Pressable onPress={() => setDia(sumarDias(dia, 7))} style={s.flecha}><Text style={s.flechaTxt}>›</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {semana.map(f => {
          const on = f === dia, hoy = f === hoyISO(), x = desdeISO(f);
          return (
            <Pressable key={f} onPress={() => setDia(f)} style={[s.diaChip, hoy && { borderColor: C.muted }, on && { backgroundColor: C.accent, borderColor: C.accent }]}>
              <Text style={[s.diaChipTxt, { color: on ? C.onAccent : C.muted }]}>{DIAS_CORTO[x.getDay()]}</Text>
              <Text style={[s.diaChipNum, { color: on ? C.onAccent : C.text }]}>{x.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[u.card, { gap: 10 }]}>
        <View style={s.filaEntre}>
          <Text style={s.nombre}>Planeado {fmt(planeado)} kcal</Text>
          <Text style={s.muted13}>meta {fmt(objetivo)}</Text>
        </View>
        <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, (planeado / objetivo) * 100)}%` }]} /></View>
        <Boton texto="↻ Armar este día por mí" tipo="borde" cargando={armando} onPress={async () => { setArmando(true); await armar(); setArmando(false); }} />
      </View>

      {COMIDAS.map(([c, label]) => {
        const deLa = items.filter(i => i.comida === c);
        const t = totales(deLa, porId);
        return (
          <View key={c} style={[u.card, { padding: 16, gap: 4 }]}>
            <View style={s.filaEntre}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.overline}>{label} · {fmt(t.k)} de {fmt(presupuesto(c))} kcal</Text>
                <Text style={s.nombre} numberOfLines={1}>{plan.nombres[c] ?? (deLa.length ? 'Combinación libre' : 'Sin elegir')}</Text>
              </View>
              <Pressable onPress={() => cambiar(c)} style={s.cambiar}><Text style={s.cambiarTxt}>{deLa.length ? 'Cambiar' : 'Elegir'}</Text></Pressable>
            </View>
            {deLa.map(it => {
              const f = porId.get(it.alimento_id);
              if (!f) return null;
              return (
                <View key={it.id} style={s.item}>
                  {f.foto_url ? <Image source={{ uri: f.foto_url }} style={s.thumb} /> : <View style={s.thumb} />}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.itemNombre} numberOfLines={1}>{f.nombre}</Text>
                    <Text style={s.muted12} numberOfLines={1}>{it.cantidad === 1 ? f.porcion_base.texto : `${fq(it.cantidad)} × ${f.porcion_base.texto}`}</Text>
                  </View>
                  <Text style={s.itemKcal}>{fmt(nutrientes(f, it.cantidad).kcal)}</Text>
                  <Pressable onPress={() => plan.quitar(it.id)} style={s.x}><Text style={s.xTxt}>×</Text></Pressable>
                </View>
              );
            })}
            <Pressable onPress={() => agregar(c)} style={{ minHeight: 40, justifyContent: 'center' }}>
              <Text style={s.cambiarTxt}>+ Agregar alimento</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function Constructor({ b, set, t, presupuesto, porId, agregar, cancelar, guardar, borrar }: {
  b: Borrador; set: (b: Borrador) => void; t: { k: number; p: number; c: number; g: number }; presupuesto: number; porId: Mapa;
  agregar: () => void; cancelar: () => void; guardar: () => Promise<string | null>; borrar?: () => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const aj = ajuste(t.k, presupuesto);
  const cambiar = (k: number, d: number) => {
    const items = b.items.map((it, j) => (j === k ? { ...it, cantidad: it.cantidad + d } : it)).filter(it => it.cantidad > 0);
    set({ ...b, items });
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2, paddingTop: 4 }}>
        <Text style={s.muted13}>{b.id ? 'Editar opción' : `Nueva opción de ${nombreComida(b.comida).toLowerCase()}`}</Text>
        <Text style={u.h1}>{b.nombre.trim() || nombreAuto(b.items, porId)}</Text>
      </View>
      <TextInput value={b.nombre} onChangeText={v => set({ ...b, nombre: v })} placeholder={b.items.length ? nombreAuto(b.items, porId) : 'Nombre, ej. Mi desayuno de siempre'}
        placeholderTextColor={C.muted} style={s.input} />
      <Chips<ComidaId> opciones={COMIDAS} valor={b.comida} onCambio={c => set({ ...b, comida: c })} />

      <View style={[u.card, { gap: 8 }]}>
        <View style={s.filaEntre}>
          <Text style={s.kcal}>{fmt(t.k)} <Text style={s.muted13}>de {fmt(presupuesto)} kcal</Text></Text>
          {b.items.length > 0 && <Text style={[s.ajuste, { color: aj.color }]}>{aj.txt}</Text>}
        </View>
        <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, (t.k / presupuesto) * 100)}%` }]} /></View>
        <Text style={s.muted13}>Proteína {fmt(t.p)} g · Carbos {fmt(t.c)} g · Grasa {fmt(t.g)} g</Text>
      </View>

      <View style={[u.card, { gap: 4, padding: 16 }]}>
        {b.items.length === 0 && <Text style={[s.muted13, { paddingVertical: 8 }]}>Todavía no tiene alimentos.</Text>}
        {b.items.map((it, k) => {
          const f = porId.get(it.alimento_id);
          if (!f) return null;
          return (
            <View key={it.alimento_id} style={s.item}>
              {f.foto_url ? <Image source={{ uri: f.foto_url }} style={s.thumb} /> : <View style={s.thumb} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.itemNombre} numberOfLines={1}>{f.nombre}</Text>
                <Text style={s.muted12} numberOfLines={1}>{fq(it.cantidad)} × {f.porcion_base.texto} · {fmt(nutrientes(f, it.cantidad).kcal)} kcal</Text>
              </View>
              <Pressable onPress={() => cambiar(k, -0.5)} style={s.step}><Text style={s.stepTxt}>−</Text></Pressable>
              <Pressable onPress={() => cambiar(k, 0.5)} style={s.step}><Text style={s.stepTxt}>+</Text></Pressable>
            </View>
          );
        })}
        <Pressable onPress={agregar} style={{ minHeight: 40, justifyContent: 'center' }}><Text style={s.cambiarTxt}>+ Agregar alimento</Text></Pressable>
      </View>

      <View style={[u.card, { gap: 10 }]}>
        <Text style={s.overline}>Preparación</Text>
        <Chips<string> valor={b.tiempo_min === null ? '' : String(b.tiempo_min)} onCambio={v => set({ ...b, tiempo_min: Number(v) })}
          opciones={[['5', '5 min'], ['10', '10 min'], ['15', '15 min'], ['20', '20 min'], ['30', '30 min'], ['45', '45 min'], ['60', '1 h'], ['90', '1 h 30'], ['120', '2 h']]} />
        <Segmento<Dificultad> valor={b.dificultad ?? ('' as Dificultad)} onCambio={v => set({ ...b, dificultad: v })}
          opciones={[['facil', 'Fácil'], ['media', 'Media'], ['dificil', 'Difícil']]} />
      </View>

      {error && <Text style={u.error}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Boton texto="Cancelar" tipo="borde" onPress={cancelar} /></View>
        <View style={{ flex: 2 }}><Boton texto={b.id ? 'Guardar cambios' : 'Guardar opción'} cargando={guardando} desactivado={!b.items.length}
          onPress={async () => { setGuardando(true); const e = await guardar(); setGuardando(false); setError(e); }} /></View>
      </View>
      {borrar && (
        <Boton texto={confirmar ? '¿Seguro? Toca otra vez para eliminarla' : 'Eliminar opción'} tipo="texto"
          onPress={async () => { if (!confirmar) return setConfirmar(true); const e = await borrar(); setError(e); }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12, color: C.muted },
  overline: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.muted },
  aviso: { fontSize: 14, color: C.success },
  nombre: { fontSize: 16, fontWeight: '700', color: C.text },
  prep: { fontSize: 13, color: C.soft, fontWeight: '600' },
  kcal: { fontSize: 22, fontWeight: '700', color: C.text },
  ajuste: { fontSize: 13, fontWeight: '700' },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  mini: { width: 42, height: 42, borderRadius: 10, backgroundColor: C.surface2 },
  filtro: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  filtroOn: { borderColor: C.accent, backgroundColor: '#2A1C16' },
  filtroTxt: { fontSize: 13, fontWeight: '600', color: C.text },
  crear: { minHeight: 36, justifyContent: 'center' },
  crearTxt: { fontSize: 14, fontWeight: '700', color: C.accent },
  flecha: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  flechaTxt: { fontSize: 22, color: C.text },
  semanaTxt: { fontSize: 15, fontWeight: '600', color: C.text },
  diaChip: { flex: 1, minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: C.surface3, alignItems: 'center', justifyContent: 'center', gap: 2 },
  diaChipTxt: { fontSize: 11, fontWeight: '600' },
  diaChipNum: { fontSize: 16, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: C.surface3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: C.accent },
  cambiar: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  cambiarTxt: { fontSize: 14, fontWeight: '600', color: C.accent },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.divider },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface2 },
  itemNombre: { fontSize: 15, fontWeight: '600', color: C.text },
  itemKcal: { fontSize: 14, fontWeight: '600', color: C.text },
  x: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  xTxt: { fontSize: 20, color: C.muted },
  input: { backgroundColor: C.surface2, borderRadius: 14, minHeight: 50, paddingHorizontal: 16, color: C.text, fontSize: 16, outlineWidth: 0 },
  step: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 18, color: C.text, fontWeight: '600' },
});
