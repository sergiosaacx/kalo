import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlimentoPicker } from '../components/AlimentoPicker';
import { Boton, Chips, Segmento, u } from '../components/ui';
import { nutrientes, nutrientesItem, useAlimentos, type AlimentoDB } from '../data/alimentos';
import { DIFICULTAD, aplicarAlDia, borrarOpcion, guardarOpcion, tiempoTexto, useOpciones, type Dificultad, type ItemOpcion, type Opcion } from '../data/opciones';
import { COMIDAS, agregarAlPlan, comidaDeAhora, hoyISO, nombreComida, usePlanDia, type ComidaId } from '../data/plan';
import { useSesion } from '../data/sesion';
import { PRESUPUESTO, fmt, gasto, macrosObjetivo } from '../logic/energia';
import { DIAS_CORTO, MESES, ajuste, desdeISO, diaCorto, diaTexto, fq, sumarDias, totales, type Mapa } from '../logic/menu';
import { recomendar } from '../logic/recomendar';
import { C } from '../theme';
import { Calendario } from './MenuCalendario';


// Nombre automático: «Pollo con arroz y espinaca»
function nombreAuto(items: ItemOpcion[], porId: Mapa) {
  const n = items.map(i => porId.get(i.alimento_id)?.nombre).filter(Boolean) as string[];
  if (!n.length) return 'Nueva opción';
  if (n.length === 1) return n[0];
  const resto = n.slice(1).map(x => x.toLowerCase());
  return `${n[0]} con ${resto.length === 1 ? resto[0] : resto.slice(0, -1).join(', ') + ' y ' + resto[resto.length - 1]}`;
}

interface Borrador { id?: string; comida: ComidaId; nombre: string; items: ItemOpcion[]; tiempo_min: number | null; dificultad: Dificultad | null; fuente?: 'mia' | 'ia' }

export function Menu() {
  const { activo } = useSesion();
  const { lista: alimentos } = useAlimentos();
  const { lista: opciones } = useOpciones();
  const [vista, setVista] = useState<'semana' | 'calendario' | 'opciones'>('semana');
  const [volverA, setVolverA] = useState<'semana' | 'calendario'>('semana'); // a dónde volver tras elegir
  const [recom, setRecom] = useState<{ comida: ComidaId; semilla: number } | null>(null);
  const [dia, setDia] = useState(hoyISO());
  const [eligiendo, setEligiendo] = useState<ComidaId | null>(null);    // «Cambiar» desde Semana
  const [comidaOp, setComidaOp] = useState<ComidaId>(comidaDeAhora());
  const [rapidas, setRapidas] = useState(false);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  // reemplazar: posición del alimento de la opción que se cambia por otro
  const [picker, setPicker] = useState<{ destino: 'dia' | 'borrador'; comida: ComidaId; reemplazar?: number } | null>(null);
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
    setVista(volverA);
    mostrarAviso(`Listo: ${o.nombre} en ${nombreComida(comida).toLowerCase()} del ${diaTexto(dia)}.`);
  };
  const elegirPara = (c: ComidaId, desde: 'semana' | 'calendario') => { setEligiendo(c); setComidaOp(c); setVolverA(desde); setVista('opciones'); };

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
      <AlimentoPicker
        titulo={picker.destino === 'dia' ? `Agregar a ${nombreComida(picker.comida).toLowerCase()} · ${diaCorto(dia)}`
          : picker.reemplazar !== undefined && borrador ? `Cambiar ${porId.get(borrador.items[picker.reemplazar]?.alimento_id)?.nombre.toLowerCase() ?? 'alimento'} por…` : 'Agregar a la opción'}
        onCerrar={() => setPicker(null)}
        onElegir={async a => {
          if (picker.destino === 'borrador' && borrador && picker.reemplazar !== undefined) {
            // Reemplaza ese alimento conservando el lugar; la porción vuelve a 1
            setBorrador({ ...borrador, items: borrador.items.map((i, k) => (k === picker.reemplazar ? { alimento_id: a.id, cantidad: 1 } : i)) });
          } else if (picker.destino === 'borrador' && borrador) {
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

  // ── Recomiéndame: Kalo arma una combinación que cuadre con lo que te toca en esa comida
  if (recom) {
    const pres = presupuesto(recom.comida);
    const r = recomendar(recom.comida, recom.semilla, pres, porId);
    const obj = macrosObjetivo(activo, objetivo), parte = PRESUPUESTO[recom.comida];
    const t = r ? totales(r.items, porId) : null;
    return (
      <View style={{ gap: 14 }}>
        <View style={{ gap: 2, paddingTop: 4 }}>
          <Text style={s.muted13}>Recomendación de {nombreComida(recom.comida).toLowerCase()}</Text>
          <Text style={u.h1}>{r?.nombre ?? 'Sin combinación'}</Text>
          {r && <Text style={s.prep}>{tiempoTexto(r.tiempo_min)} · Fácil</Text>}
        </View>
        <Chips<ComidaId> opciones={COMIDAS} valor={recom.comida} onCambio={c => setRecom({ comida: c, semilla: recom.semilla + 1 })} />
        {r && t && (<>
          <View style={[u.card, { gap: 4, padding: 16 }]}>
            {r.items.map(it => {
              const f = porId.get(it.alimento_id)!;
              return (
                <View key={it.alimento_id} style={[s.item, { borderTopWidth: 0 }]}>
                  {f.foto_url ? <Image source={{ uri: f.foto_url }} style={s.foto} /> : <View style={s.foto} />}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.itemNombre} numberOfLines={1}>{f.nombre}</Text>
                    <Text style={s.muted12}>{it.cantidad === 1 ? f.porcion_base.texto : `${fq(it.cantidad)} × ${f.porcion_base.texto}`}</Text>
                  </View>
                  <Text style={s.itemKcal}>{fmt(nutrientesItem(it).kcal)}</Text>
                </View>
              );
            })}
          </View>
          <View style={[u.card, { gap: 10 }]}>
            <View style={s.filaEntre}>
              <Text style={s.kcal}>{fmt(t.k)} <Text style={s.muted13}>de {fmt(pres)} kcal</Text></Text>
              <Text style={[s.ajuste, { color: ajuste(t.k, pres).color }]}>{ajuste(t.k, pres).txt}</Text>
            </View>
            {([['Proteína', t.p, obj.proteina * parte, C.accent], ['Carbohidratos', t.c, obj.carbos * parte, C.carbs], ['Grasa', t.g, obj.grasa * parte, C.fat]] as const).map(([l, v, meta, col]) => (
              <View key={l} style={{ gap: 5 }}>
                <View style={s.filaEntre}><Text style={s.itemNombre}>{l}</Text><Text style={s.muted13}>{fmt(v)} g / {fmt(meta)} g</Text></View>
                <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, (v / meta) * 100)}%`, backgroundColor: col }]} /></View>
              </View>
            ))}
            <Text style={[s.muted13, { lineHeight: 19 }]}>
              {Math.abs(t.k - pres) <= pres * 0.1 ? `Queda a ${fmt(Math.abs(t.k - pres))} kcal de lo que te toca` : `Queda ${fmt(Math.abs(t.k - pres))} kcal ${t.k > pres ? 'por encima' : 'por debajo'} de lo que te toca`} en {nombreComida(recom.comida).toLowerCase()}. Aporta {fmt(t.p)} g de proteína y {fq(t.fib)} g de fibra.
            </Text>
          </View>
        </>)}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Boton texto="↻ Otra" tipo="borde" onPress={() => setRecom({ ...recom, semilla: recom.semilla + 1 })} /></View>
          {r && <View style={{ flex: 1 }}><Boton texto="Editar" tipo="borde" onPress={() => {
            setBorrador({ comida: recom.comida, nombre: r.nombre, items: r.items.map(i => ({ ...i })), tiempo_min: r.tiempo_min, dificultad: 'facil', fuente: 'ia' });
            setRecom(null);
          }} /></View>}
        </View>
        {r && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Boton texto="Guardar opción" tipo="borde" onPress={async () => {
              const e = await guardarOpcion({ comida: recom.comida, nombre: r.nombre, items: r.items, fuente: 'ia', tiempo_min: r.tiempo_min, dificultad: 'facil' });
              mostrarAviso(e ?? 'Guardada en tus opciones.');
            }} /></View>
            <View style={{ flex: 1 }}><Boton texto={`Usar el ${diaCorto(dia)}`} onPress={async () => {
              const e = await aplicarAlDia(activo.id, dia, eligiendo ?? recom.comida, r.items, r.nombre, null);
              if (e) return mostrarAviso(e);
              await plan.recargar(); setRecom(null); setEligiendo(null); setVista(volverA);
              mostrarAviso(`Listo: ${r.nombre} en tu ${diaTexto(dia)}.`);
            }} /></View>
          </View>
        )}
        {aviso && <Text style={s.aviso}>{aviso}</Text>}
        <Boton texto="Volver" tipo="texto" onPress={() => setRecom(null)} />
      </View>
    );
  }

  // ── Crear o editar una opción propia
  if (borrador) {
    const t = totales(borrador.items, porId), pres = presupuesto(borrador.comida);
    return (
      <Constructor b={borrador} set={setBorrador} t={t} presupuesto={pres} porId={porId}
        agregar={() => setPicker({ destino: 'borrador', comida: borrador.comida })}
        reemplazar={k => setPicker({ destino: 'borrador', comida: borrador.comida, reemplazar: k })}
        cancelar={() => setBorrador(null)}
        dia={diaCorto(dia)}
        guardar={async usarlo => {
          const nombre = borrador.nombre.trim() || nombreAuto(borrador.items, porId);
          const e = await guardarOpcion({ ...borrador, nombre });
          if (e) return e;
          if (usarlo) {
            const comida = eligiendo ?? borrador.comida;
            const e2 = await aplicarAlDia(activo.id, dia, comida, borrador.items, nombre, null);
            if (e2) return e2;
            await plan.recargar();
            setBorrador(null); setEligiendo(null); setVista(volverA);
            mostrarAviso(`Listo: ${nombre} en ${nombreComida(comida).toLowerCase()} del ${diaTexto(dia)}.`);
            return null;
          }
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
      <Segmento<'semana' | 'calendario' | 'opciones'> opciones={[['semana', 'Semana'], ['calendario', 'Calendario'], ['opciones', 'Opciones']]} valor={vista}
        onCambio={v => { setVista(v); setEligiendo(null); }} />
      {aviso && <Text style={s.aviso}>{aviso}</Text>}

      {vista === 'semana' ? (
        <Semana dia={dia} setDia={setDia} plan={plan} porId={porId} objetivo={objetivo} presupuesto={presupuesto} armar={armarDia}
          cambiar={c => elegirPara(c, 'semana')}
          agregar={c => setPicker({ destino: 'dia', comida: c })} />
      ) : vista === 'calendario' ? (
        <Calendario perfilId={activo.id} dia={dia} setDia={setDia} plan={plan} porId={porId} opciones={opciones ?? []}
          presupuesto={presupuesto} cambiar={c => elegirPara(c, 'calendario')} />
      ) : (
        <View style={{ gap: 12 }}>
          <Chips<ComidaId> opciones={COMIDAS} valor={eligiendo ?? comidaOp} onCambio={c => { setComidaOp(c); if (eligiendo) setEligiendo(c); }} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable onPress={() => setRapidas(!rapidas)} style={[s.filtro, rapidas && s.filtroOn]}>
              <Text style={[s.filtroTxt, rapidas && { color: C.accent }]}>Rápidas · 20 min o menos</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Boton texto="+ Crear opción" tipo="borde"
              onPress={() => setBorrador({ comida: eligiendo ?? comidaOp, nombre: '', items: [], tiempo_min: null, dificultad: null })} /></View>
            <View style={{ flex: 1 }}><Boton texto="Recomiéndame" onPress={() => setRecom({ comida: eligiendo ?? comidaOp, semilla: Math.floor(Math.random() * 50) + 1 })} /></View>
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
                    {/* Las tuyas se editan; las de Kalo se personalizan: se crea tu versión y la original no se toca */}
                    <View style={{ flex: 1 }}><Boton texto={o.fuente === 'kalo' ? 'Personalizar' : 'Editar'} tipo="borde"
                      onPress={() => setBorrador({ id: o.fuente === 'kalo' ? undefined : o.id, comida: o.comida, nombre: o.nombre, items: o.items.map(i => ({ ...i })), tiempo_min: o.tiempo_min, dificultad: o.dificultad })} /></View>
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
                  <Text style={s.itemKcal}>{fmt(nutrientesItem(it).kcal)}</Text>
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

function Constructor({ b, set, t, presupuesto, porId, dia, agregar, reemplazar, cancelar, guardar, borrar }: {
  b: Borrador; set: (b: Borrador) => void; t: { k: number; p: number; c: number; g: number }; presupuesto: number; porId: Mapa; dia: string;
  agregar: () => void; reemplazar: (k: number) => void; cancelar: () => void;
  guardar: (usarlo: boolean) => Promise<string | null>; borrar?: () => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<'' | 'guardar' | 'usar'>('');
  const [confirmar, setConfirmar] = useState(false);
  const aj = ajuste(t.k, presupuesto);
  const cambiar = (k: number, d: number) => {
    const items = b.items.map((it, j) => (j === k ? { ...it, cantidad: it.cantidad + d } : it)).filter(it => it.cantidad > 0);
    set({ ...b, items });
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2, paddingTop: 4 }}>
        <Text style={s.muted13}>{b.id ? 'Editar opción' : `Tu opción de ${nombreComida(b.comida).toLowerCase()} · cambia o quita lo que quieras`}</Text>
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
            <View key={`${k}-${it.alimento_id}`} style={s.item}>
              {f.foto_url ? <Image source={{ uri: f.foto_url }} style={s.thumb} /> : <View style={s.thumb} />}
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={s.itemNombre} numberOfLines={1}>{f.nombre}</Text>
                <Text style={s.muted12} numberOfLines={1}>{fq(it.cantidad)} × {f.porcion_base.texto} · {fmt(nutrientesItem(it).kcal)} kcal</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Pressable onPress={() => reemplazar(k)} hitSlop={8}><Text style={s.accion}>Cambiar</Text></Pressable>
                  <Pressable onPress={() => set({ ...b, items: b.items.filter((_, j) => j !== k) })} hitSlop={8}><Text style={[s.accion, { color: C.muted }]}>Quitar</Text></Pressable>
                </View>
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
      <Boton texto={`Guardar y usar el ${dia}`} cargando={guardando === 'usar'} desactivado={!b.items.length || guardando !== ''}
        onPress={async () => { setGuardando('usar'); const e = await guardar(true); setGuardando(''); setError(e); }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Boton texto="Cancelar" tipo="borde" onPress={cancelar} /></View>
        <View style={{ flex: 1 }}><Boton texto={b.id ? 'Guardar cambios' : 'Solo guardar'} tipo="borde" cargando={guardando === 'guardar'} desactivado={!b.items.length || guardando !== ''}
          onPress={async () => { setGuardando('guardar'); const e = await guardar(false); setGuardando(''); setError(e); }} /></View>
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
  foto: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.surface2 },
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
  accion: { fontSize: 13, fontWeight: '700', color: C.accent },
});
