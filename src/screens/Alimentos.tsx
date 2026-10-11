import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Boton, Chips, Segmento, u } from '../components/ui';
import { CATEGORIAS, MINERALES, VITAMINAS, fotoDe, nutrientes, sinTildes, useAlimentos, type AlimentoDB } from '../data/alimentos';
import { bandeja, useBandeja, type ItemBandeja } from '../data/bandeja';
import { tiempoTexto, useOpciones, type Opcion } from '../data/opciones';
import { COMIDAS, agregarVariosAlPlan, comidaDeAhora, nombreComida, type ComidaId } from '../data/plan';
import { useSesion } from '../data/sesion';
import { fmt } from '../logic/energia';
import { C } from '../theme';

const fq = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');

function Miniatura({ a, size }: { a: AlimentoDB; size: number }) {
  const uri = fotoDe(a);
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size > 50 ? 14 : 12, backgroundColor: C.surface2 }} />
    : <View style={{ width: size, height: size, borderRadius: size > 50 ? 14 : 12, backgroundColor: C.surface2 }} />;
}

// Pantalla con su propio scroll: la bandeja queda fija abajo, encima de las pestañas
export function Alimentos({ destino, onAgregado }: { destino: ComidaId | null; onAgregado: () => void }) {
  const { activo } = useSesion();
  const { lista, error } = useAlimentos();
  const { items, ultimo } = useBandeja();
  const [query, setQuery] = useState('');
  const [abierto, setAbierto] = useState<AlimentoDB | null>(null);
  const [comida, setComida] = useState<ComidaId>(destino ?? comidaDeAhora());
  const [hoja, setHoja] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorListo, setErrorListo] = useState<string | null>(null);
  // Lo que se va a agregar desde la ficha (cantidad en porciones base + cómo se lee)
  const [elegido, setElegido] = useState<{ cantidad: number; texto: string } | null>(null);
  // «Mis opciones»: una opción completa entra a la bandeja de una vez
  const [vista, setVista] = useState<'alimentos' | 'opciones'>('alimentos');
  const [opcion, setOpcion] = useState<Opcion | null>(null);
  const { lista: opciones } = useOpciones();
  const porId = useMemo(() => new Map((lista ?? []).map(a => [a.id, a])), [lista]);

  const resultados = useMemo(() => {
    if (!lista) return [];
    const q = sinTildes(query.trim());
    return q ? lista.filter(a => a.busqueda.includes(q)) : lista;
  }, [lista, query]);

  const enBandeja = new Set(items.map(it => it.alimento.id));
  const totalKcal = items.reduce((t, it) => t + nutrientes(it.alimento, it.cantidad).kcal, 0);
  const nombre = nombreComida(comida).toLowerCase();

  const agregar = () => {
    if (!abierto || !elegido) return;
    bandeja.agregar({ alimento: abierto, ...elegido });
    setAbierto(null);
  };
  const listo = async () => {
    if (!activo || items.length === 0) return;
    setGuardando(true);
    setErrorListo(null);
    const e = await agregarVariosAlPlan(activo.id, comida, items.map(it => ({ alimento_id: it.alimento.id, cantidad: it.cantidad })));
    setGuardando(false);
    if (e) { setErrorListo(e); return; }
    bandeja.vaciar();
    setHoja(false);
    onAgregado();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView key={abierto?.id ?? 'lista'} style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {abierto ? <Ficha a={abierto} volver={() => setAbierto(null)} onMedida={setElegido} /> : (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 2, paddingTop: 4 }}>
              <Text style={s.muted13}>{destino || items.length > 0 ? `Agregando a ${nombre} de hoy` : lista ? `${lista.length} alimentos` : 'Cargando…'}</Text>
              <Text style={s.h1}>Alimentos</Text>
            </View>
            <Segmento<'alimentos' | 'opciones'> opciones={[['alimentos', 'Alimentos'], ['opciones', 'Mis opciones']]} valor={vista} onCambio={setVista} />
            {items.length > 0 && ultimo && <Text style={s.toast}>{ultimo.texto}</Text>}
            {vista === 'opciones' ? <ListaOpciones opciones={opciones} comida={comida} porId={porId} abrir={setOpcion} /> : <>
            <TextInput
              value={query} onChangeText={setQuery} placeholder="Busca un alimento: arepa, lulo, pollo…"
              placeholderTextColor={C.muted} style={s.input} autoCorrect={false} />
            {error ? <Text style={s.soft}>{error}</Text> : !lista ? (
              <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} />
            ) : resultados.length === 0 ? (
              <Text style={s.soft}>No encontramos «{query}». Prueba con otro nombre.</Text>
            ) : (
              <View style={s.card}>
                {resultados.slice(0, 80).map((a, i) => {
                  const n = nutrientes(a, 1);
                  return (
                    <Pressable key={a.id} onPress={() => setAbierto(a)} style={[s.row, i > 0 && s.rowBorde]}>
                      <Miniatura a={a} size={56} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={s.b15} numberOfLines={1}>{a.nombre}</Text>
                        <Text style={s.muted12} numberOfLines={1}>{a.porcion_base.texto} · {fmt(a.porcion_base.gramos)} g</Text>
                        <Text style={s.muted12}>P {fq(n.p)} · C {fq(n.c)} · G {fq(n.gr)}</Text>
                      </View>
                      {enBandeja.has(a.id) ? <Text style={s.ya}>En la bandeja</Text> : <Text style={s.kcal}>{fmt(n.kcal)}</Text>}
                    </Pressable>
                  );
                })}
                {resultados.length > 80 && <Text style={[s.muted12, { paddingTop: 10 }]}>Escribe para ver los demás ({resultados.length - 80} más).</Text>}
              </View>
            )}
            {query.trim() !== '' && items.length > 0 && (
              <>
                <Text style={[s.muted13, { paddingHorizontal: 2 }]}>Ya en la bandeja</Text>
                <View style={s.card}>
                  {items.map((it, i) => (
                    <View key={i} style={[s.row, i > 0 && s.rowBorde]}>
                      <Miniatura a={it.alimento} size={46} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={s.b15} numberOfLines={1}>{it.alimento.nombre}</Text>
                        <Text style={s.muted12} numberOfLines={1}>{it.texto}</Text>
                      </View>
                      <Text style={s.ya}>En la bandeja</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            </>}
          </View>
        )}
      </ScrollView>

      {(abierto || items.length > 0) && (
        <Pressable onPress={() => items.length > 0 && setHoja(true)} style={s.bandeja}>
          <View style={s.bandejaIn}>
            {items.length > 0 && (
              <View style={{ flexDirection: 'row' }}>
                {items.slice(-3).map((it, i) => (
                  <View key={i} style={[s.mini, i > 0 && { marginLeft: -8 }]}><Miniatura a={it.alimento} size={26} /></View>
                ))}
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.b14} numberOfLines={1}>
                {items.length === 0 ? `${nombreComida(comida)} · vacío` : `${items.length} ${items.length === 1 ? 'alimento' : 'alimentos'} · ${fmt(totalKcal)} kcal`}
              </Text>
              <Text style={s.muted12} numberOfLines={1}>{items.length === 0 ? 'Agrega el primer alimento' : 'Toca para ver o quitar'}</Text>
            </View>
            {abierto
              ? <Pressable onPress={agregar} style={[s.listo, !elegido && { opacity: 0.4 }]} disabled={!elegido}><Text style={s.listoTxt}>Agregar</Text></Pressable>
              : <Pressable onPress={listo} style={s.listo} disabled={guardando}>
                  {guardando ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.listoTxt}>Listo</Text>}
                </Pressable>}
          </View>
          {errorListo && !hoja && <Text style={[u.error, s.bandejaError]}>{errorListo}</Text>}
        </Pressable>
      )}

      {opcion && <HojaOpcion o={opcion} porId={porId} cerrar={() => setOpcion(null)} />}

      {hoja && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={s.velo} onPress={() => setHoja(false)} />
          <View style={s.hoja}>
            <View style={s.agarre} />
            <View style={[s.rowEntre, { alignItems: 'baseline' }]}>
              <Text style={[s.h1, { fontSize: 21 }]}>Tu {nombre}</Text>
              <Text style={s.muted13}>{fmt(totalKcal)} kcal</Text>
            </View>
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={[s.card, { backgroundColor: C.surface2, paddingVertical: 4 }]}>
              {items.map((it, i) => (
                <View key={i} style={[s.row, i > 0 && s.rowBorde]}>
                  <Miniatura a={it.alimento} size={46} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={s.b15} numberOfLines={1}>{it.alimento.nombre}</Text>
                    <Text style={s.muted12} numberOfLines={1}>{it.texto}</Text>
                  </View>
                  <Text style={s.kcal}>{fmt(nutrientes(it.alimento, it.cantidad).kcal)}</Text>
                  <Pressable onPress={() => { bandeja.quitar(i); if (items.length === 1) setHoja(false); }} style={s.quitar} hitSlop={6}>
                    <Text style={s.quitarTxt}>×</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Chips<ComidaId> opciones={COMIDAS} valor={comida} onCambio={setComida} />
            {errorListo && <Text style={u.error}>{errorListo}</Text>}
            <Boton texto={`Listo · agregar ${items.length} al ${nombre}`} onPress={listo} cargando={guardando} />
            <Boton texto="Seguir agregando" tipo="borde" onPress={() => setHoja(false)} />
          </View>
        </View>
      )}
    </View>
  );
}

const textoCantidad = (a: AlimentoDB, cantidad: number) =>
  cantidad === 1 ? a.porcion_base.texto : `${fq(cantidad)} × ${a.porcion_base.texto}`;
const itemsDe = (o: Opcion, porId: Map<string, AlimentoDB>): ItemBandeja[] => o.items
  .filter(i => porId.has(i.alimento_id))
  .map(i => { const a = porId.get(i.alimento_id)!; return { alimento: a, cantidad: i.cantidad, texto: textoCantidad(a, i.cantidad) }; });
const kcalDe = (its: ItemBandeja[]) => its.reduce((t, it) => t + nutrientes(it.alimento, it.cantidad).kcal, 0);

// Primero las opciones propias («Tuya»), luego las de Kalo; solo las de la comida que se está llenando
function ListaOpciones({ opciones, comida, porId, abrir }: { opciones: Opcion[] | null; comida: ComidaId; porId: Map<string, AlimentoDB>; abrir: (o: Opcion) => void }) {
  if (!opciones || porId.size === 0) return <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} />;
  const deLa = opciones.filter(o => o.comida === comida && o.items.length > 0);
  const orden = [...deLa.filter(o => o.fuente !== 'kalo'), ...deLa.filter(o => o.fuente === 'kalo')];
  if (orden.length === 0) return <Text style={s.soft}>No hay opciones de {nombreComida(comida).toLowerCase()} todavía. Puedes crearlas en Menú.</Text>;
  return (
    <View style={[s.card, { paddingVertical: 4 }]}>
      {orden.map((o, i) => {
        const its = itemsDe(o, porId);
        return (
          <Pressable key={o.id} onPress={() => abrir(o)} style={[s.opc, i > 0 && s.rowBorde]}>
            <View style={s.rowEntre}>
              <Text style={[s.b15, { flex: 1 }]} numberOfLines={2}>
                {o.nombre}{o.fuente !== 'kalo' ? <Text style={s.tag}>  Tuya</Text> : null}
              </Text>
              <Text style={s.kcal}>{fmt(kcalDe(its))}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row' }}>
                {its.slice(0, 5).map((it, k) => <View key={k} style={[s.miniO, k > 0 && { marginLeft: -9 }]}><Miniatura a={it.alimento} size={28} /></View>)}
              </View>
              <Text style={s.muted12}>{its.length} {its.length === 1 ? 'alimento' : 'alimentos'}{o.tiempo_min ? ` · ${tiempoTexto(o.tiempo_min)}` : ''}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// La opción abierta: sus alimentos y «Agregar los N a la bandeja»
function HojaOpcion({ o, porId, cerrar }: { o: Opcion; porId: Map<string, AlimentoDB>; cerrar: () => void }) {
  const its = itemsDe(o, porId);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={s.velo} onPress={cerrar} />
      <View style={s.hoja}>
        <View style={s.agarre} />
        <View style={[s.rowEntre, { alignItems: 'baseline' }]}>
          <Text style={[s.h1, { fontSize: 21, flex: 1 }]} numberOfLines={2}>{o.nombre}</Text>
          <Text style={s.muted13}>{fmt(kcalDe(its))} kcal</Text>
        </View>
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={[s.card, { backgroundColor: C.surface2, paddingVertical: 4 }]}>
          {its.map((it, i) => (
            <View key={i} style={[s.row, i > 0 && s.rowBorde]}>
              <Miniatura a={it.alimento} size={46} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={s.b15} numberOfLines={1}>{it.alimento.nombre}</Text>
                <Text style={s.muted12} numberOfLines={1}>{it.texto}</Text>
              </View>
              <Text style={s.kcal}>{fmt(nutrientes(it.alimento, it.cantidad).kcal)}</Text>
            </View>
          ))}
        </ScrollView>
        <Boton texto={its.length === 1 ? 'Agregar a la bandeja' : `Agregar los ${its.length} a la bandeja`}
          onPress={() => { bandeja.agregarVarios(its, `${o.nombre} · ${its.length} ${its.length === 1 ? 'alimento' : 'alimentos'} en la bandeja`); cerrar(); }} />
        <Boton texto="Volver" tipo="borde" onPress={cerrar} />
      </View>
    </View>
  );
}

function Ficha({ a, volver, onMedida }: { a: AlimentoDB; volver: () => void; onMedida: (m: { cantidad: number; texto: string } | null) => void }) {
  const [modo, setModo] = useState<'kalo' | 'g'>('kalo');
  const [mult, setMult] = useState(1);
  const [gramos, setGramos] = useState(String(Math.round(a.porcion_base.gramos)));
  const g = Number(gramos.replace(',', '.'));
  const gOk = Number.isFinite(g) && g > 0 && g <= 3000;
  const cantidad = modo === 'g' ? (gOk ? g / a.porcion_base.gramos : 0) : mult;
  const n = nutrientes(a, cantidad);
  const texto = modo === 'g'
    ? `${fmt(g)} g`
    : `${mult === 1 ? '' : `${fq(mult)} × `}${a.porcion_base.texto} · ${fmt(n.g)} g`;
  useEffect(() => { onMedida(cantidad > 0 ? { cantidad, texto } : null); }, [cantidad, texto]);
  const pk = n.p * 4, ck = n.c * 4, fk = n.gr * 9, tk = pk + ck + fk || 1;
  const uri = fotoDe(a);
  const barras = (lista: [string, string, number][], color: string) => lista
    .map(([k, label, dv]) => ({ label, pct: (n.n(k) / dv) * 100 }))
    .filter(x => x.pct >= 1)
    .sort((x, y) => y.pct - x.pct)
    .map(x => (
      <View key={x.label} style={s.vit}>
        <Text style={[s.b14, { width: 120, fontWeight: '400' }]}>{x.label}</Text>
        <View style={[s.track, { flex: 1 }]}><View style={[s.fill, { width: `${Math.min(100, x.pct)}%`, backgroundColor: color }]} /></View>
        <Text style={[s.muted12, { width: 44, textAlign: 'right' }]}>{fmt(x.pct)} %</Text>
      </View>
    ));
  const vit = barras(VITAMINAS, C.fat), min = barras(MINERALES, C.carbs);

  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={volver} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={s.link}>‹ Alimentos</Text>
      </Pressable>
      {uri ? <Image source={{ uri }} style={s.hero} /> : <View style={s.hero} />}
      <View style={{ gap: 2 }}>
        <Text style={s.overline}>{CATEGORIAS[a.categoria] ?? a.categoria}</Text>
        <Text style={s.h1}>{a.nombre}</Text>
        {a.sinonimos.length > 0 && <Text style={s.muted13}>También: {a.sinonimos.join(', ')}</Text>}
      </View>

      <View style={[s.card, { gap: 16 }]}>
        <View style={{ minWidth: 0 }}>
          <Text style={s.hero50}>{fmt(n.kcal)}</Text>
          <Text style={s.muted13}>{modo === 'g' ? `kcal en ${gOk ? fmt(g) : 0} g` : `kcal · ${fq(mult)} × ${a.porcion_base.texto} (${fmt(n.g)} g)`}</Text>
        </View>
        <View style={s.stack}>
          <View style={{ width: `${(pk / tk) * 100}%`, backgroundColor: C.accent }} />
          <View style={{ width: `${(ck / tk) * 100}%`, backgroundColor: C.carbs }} />
          <View style={{ width: `${(fk / tk) * 100}%`, backgroundColor: C.fat }} />
        </View>
        <View style={s.leyenda}>
          {[['Proteína', n.p, pk, C.accent], ['Carbos', n.c, ck, C.carbs], ['Grasa', n.gr, fk, C.fat]].map(([l, g, k, col]) => (
            <View key={l as string} style={{ flex: 1, gap: 2 }}>
              <Text style={[s.muted12, { color: col as string }]}>{l as string}</Text>
              <Text style={s.b15}>{fq(g as number)} g</Text>
              <Text style={s.muted12}>{fmt(((k as number) / tk) * 100)} % kcal</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[s.card, { gap: 12 }]}>
        <Segmento<'kalo' | 'g'> opciones={[['kalo', 'Medida de Kalo'], ['g', 'Mi medida']]} valor={modo} onCambio={setModo} />
        {modo === 'kalo' ? (
          <View style={s.rowEntre}>
            <Text style={[s.b14, { flex: 1, fontWeight: '400' }]}>{fq(mult)} × {a.porcion_base.texto} · {fmt(n.g)} g</Text>
            <View style={s.stepper}>
              <Pressable onPress={() => setMult(m => Math.max(0.5, m - 0.5))} style={s.stepBtn}><Text style={s.stepTxt}>−</Text></Pressable>
              <Text style={[s.b15, { minWidth: 34, textAlign: 'center' }]}>{fq(mult)}</Text>
              <Pressable onPress={() => setMult(m => m + 0.5)} style={s.stepBtn}><Text style={s.stepTxt}>+</Text></Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={s.campo}>
              <TextInput value={gramos} onChangeText={t => setGramos(t.replace(/[^0-9.,]/g, ''))} inputMode="decimal" keyboardType="decimal-pad"
                selectTextOnFocus style={s.campoTxt} />
              <Text style={s.muted13}>gramos</Text>
            </View>
            <Text style={s.muted12}>{gOk || gramos === '' ? 'Pon lo que comiste: el peso del empaque o lo que pesaste.' : 'Escribe un peso entre 1 y 3.000 g.'}</Text>
          </>
        )}
      </View>

      <View style={[s.card, s.leyenda]}>
        {[['Fibra', `${fq(n.n('fibra_g'))} g`], ['Azúcar', `${fq(n.n('azucar_g'))} g`], ['Sodio', `${fmt(n.n('sodio_mg'))} mg`]].map(([l, v]) => (
          <View key={l} style={{ flex: 1, gap: 2 }}><Text style={s.muted12}>{l}</Text><Text style={s.b15}>{v}</Text></View>
        ))}
      </View>

      {vit.length > 0 && <View style={[s.card, { gap: 10 }]}><Text style={s.overline}>Vitaminas · % del valor diario</Text>{vit}</View>}
      {min.length > 0 && <View style={[s.card, { gap: 10 }]}><Text style={s.overline}>Minerales · % del valor diario</Text>{min}</View>}

      <Text style={[s.muted12, { paddingHorizontal: 4 }]}>Fuente: {a.fuente.startsWith('USDA') ? 'USDA FoodData Central' : a.fuente}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.56, color: C.text },
  hero50: { fontSize: 50, fontWeight: '700', letterSpacing: -1.5, color: C.text, lineHeight: 54 },
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12, color: C.muted },
  soft: { fontSize: 15, color: C.soft, lineHeight: 22 },
  overline: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.muted },
  b14: { fontSize: 14, fontWeight: '600', color: C.text },
  b15: { fontSize: 15, fontWeight: '600', color: C.text },
  kcal: { fontSize: 15, fontWeight: '700', color: C.text },
  link: { fontSize: 15, fontWeight: '600', color: C.accent },
  input: { backgroundColor: C.surface2, borderRadius: 14, minHeight: 48, paddingHorizontal: 16, color: C.text, fontSize: 16, outlineWidth: 0 },
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowBorde: { borderTopWidth: 1, borderTopColor: C.divider },
  rowEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  hero: { width: '100%', height: 230, borderRadius: 24, backgroundColor: C.surface2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: C.text, fontSize: 20, fontWeight: '600' },
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: C.surface3 },
  leyenda: { flexDirection: 'row', gap: 10 },
  vit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { height: 6, borderRadius: 3, backgroundColor: C.surface3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  scroll: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28, width: '100%', maxWidth: 520, alignSelf: 'center' },
  toast: { backgroundColor: '#1E2A14', borderWidth: 1, borderColor: C.success, color: C.success, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, fontWeight: '600' },
  ya: { fontSize: 11, fontWeight: '700', color: C.success, borderWidth: 1, borderColor: C.success, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 7 },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 14, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.accent, paddingHorizontal: 14 },
  campoTxt: { flex: 1, minWidth: 0, color: C.text, fontSize: 18, fontWeight: '700', outlineWidth: 0, height: '100%' },
  bandeja: { backgroundColor: '#121214', borderTopWidth: 1, borderTopColor: C.divider },
  bandejaIn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 18, width: '100%', maxWidth: 520, alignSelf: 'center' },
  bandejaError: { paddingHorizontal: 18, paddingBottom: 8, width: '100%', maxWidth: 520, alignSelf: 'center' },
  mini: { borderRadius: 11, borderWidth: 2, borderColor: '#121214' },
  listo: { height: 44, paddingHorizontal: 20, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  listoTxt: { color: C.onAccent, fontWeight: '700', fontSize: 15 },
  velo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  hoja: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 18, gap: 10, width: '100%', maxWidth: 520, alignSelf: 'center' },
  agarre: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center' },
  quitar: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  quitarTxt: { color: C.muted, fontSize: 22 },
  opc: { paddingVertical: 11, gap: 6 },
  tag: { fontSize: 11, fontWeight: '700', color: C.accent },
  miniO: { borderRadius: 10, borderWidth: 2, borderColor: C.surface },
});
