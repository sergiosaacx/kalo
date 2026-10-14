import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Boton, Chips, Segmento, u } from '../components/ui';
import { CATEGORIAS, MINERALES, VITAMINAS, fotoDe, mapaCache, nutrientes, nutrientesItem, coincide, sinTildes, useAlimentos, type AlimentoDB, type Anadido } from '../data/alimentos';
import { anadidosParaGuardar, bandeja, kcalBandeja, useBandeja, type AnadidoBandeja, type ItemBandeja } from '../data/bandeja';
import { guardarOpcion, tiempoTexto, useOpciones, type Opcion } from '../data/opciones';
import { AlimentoPicker } from '../components/AlimentoPicker';
import { ACEITE_CASA_G, FRITOS, sugerencias, type Unidad } from '../logic/anadidos';
import { choques, revisarItems } from '../logic/evito';
import { Advertencia, Sellos } from '../components/Sellos';
import { NOMBRE, UNIDAD, cruzaLimite, limitesDe, saludDelDia } from '../logic/salud';
import { gasto } from '../logic/energia';
import { MOMENTOS, responder, type Momento } from '../data/comidas';
import { COMIDAS, agregarVariosAlPlan, comidaDeAhora, editarItem, hoyISO, moverItems, nombreComida, quitarItem, usePlanDia, type ComidaId, type ItemPlan } from '../data/plan';
import { useSesion } from '../data/sesion';
import { fmt } from '../logic/energia';
import { C } from '../theme';

const fq = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');

import { ArmarEnsalada, ENSALADA_ID } from '../components/Ensalada';

export function Miniatura({ a, size }: { a: AlimentoDB; size: number }) {
  const uri = fotoDe(a);
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size > 50 ? 14 : 12, backgroundColor: C.surface2 }} />
    : <View style={{ width: size, height: size, borderRadius: size > 50 ? 14 : 12, backgroundColor: C.surface2 }} />;
}

// Pantalla con su propio scroll: la bandeja queda fija abajo, encima de las pestañas
// registro: se está respondiendo «¿Ya desayunaste?» → lo que se guarde queda comido y el recordatorio respondido
export function Alimentos({ destino, onAgregado, registro, abrirBandeja }: {
  destino: ComidaId | null; onAgregado: (aviso?: string) => void;
  registro?: { momento: Momento; fecha: string } | null; abrirBandeja?: boolean;
}) {
  const { activo } = useSesion();
  const { lista, error } = useAlimentos();
  const { items, ultimo } = useBandeja();
  const [query, setQuery] = useState('');
  const [abierto, setAbierto] = useState<AlimentoDB | null>(null);
  const [comida, setComida] = useState<ComidaId>(destino ?? comidaDeAhora());
  const [hoja, setHoja] = useState(!!abrirBandeja);
  const [guardando, setGuardando] = useState(false);
  const [errorListo, setErrorListo] = useState<string | null>(null);
  // Lo que se va a agregar desde la ficha (cantidad en porciones base + cómo se lee)
  const [elegido, setElegido] = useState<Elegido | null>(null);
  // «Mis opciones»: una opción completa entra a la bandeja de una vez
  const [vista, setVista] = useState<'alimentos' | 'opciones'>('alimentos');
  const [opcion, setOpcion] = useState<Opcion | null>(null);
  // «Ensalada a tu gusto» abierta: nueva, o una guardada para usarla otra vez
  const [armando, setArmando] = useState<{ opcion?: Opcion } | null>(null);
  const { lista: opciones, recargar: recargarOpciones } = useOpciones();
  const porId = useMemo(() => new Map((lista ?? []).map(a => [a.id, a])), [lista]);
  // Lo ya comido ese día, para avisar si lo de la bandeja hace pasar un límite (azúcar libre, sodio, grasa saturada)
  const { items: delDia } = usePlanDia(activo?.id, registro?.fecha ?? hoyISO());

  const resultados = useMemo(() => {
    if (!lista) return [];
    const q = sinTildes(query.trim());
    return q ? lista.filter(a => coincide(a.busqueda, q)) : lista;
  }, [lista, query]);

  const enBandeja = new Set(items.map(it => it.alimento.id));
  const totalKcal = items.reduce((t, it) => t + kcalBandeja(it), 0);
  // Tus opciones guardadas también salen al buscar (p. ej. «Mi batido»)
  const misOpciones = useMemo(() => {
    const q = sinTildes(query.trim());
    return q && opciones ? opciones.filter(o => o.fuente !== 'kalo' && o.items.length > 0 && !esEnsalada(o) && sinTildes(o.nombre).includes(q)) : [];
  }, [opciones, query]);
  // Tus ensaladas guardadas: salen al buscar «ensalada»
  const ensaladas = useMemo(() => (opciones ?? []).filter(esEnsalada), [opciones]);
  const verEnsaladas = sinTildes(query.trim()).length >= 3 && 'ensalada'.startsWith(sinTildes(query.trim()).split(/\s+/)[0]);
  const nombre = nombreComida(comida).toLowerCase();

  const agregar = () => {
    if (!abierto || !elegido) return;
    const it: ItemBandeja = { alimento: abierto, cantidad: elegido.cantidad, texto: elegido.texto, anadidos: elegido.anadidos };
    bandeja.agregar(it);
    // «Guardarlo como mío»: queda como opción propia de esta comida (sale en «Mis opciones» y al buscar)
    if (elegido.guardarComo) {
      guardarOpcion({ comida, nombre: elegido.guardarComo, items: [{ alimento_id: abierto.id, cantidad: it.cantidad, anadidos: anadidosParaGuardar(it) }], tiempo_min: null, dificultad: null })
        .then(() => recargarOpciones());
    }
    setAbierto(null);
  };
  const listo = async () => {
    if (!activo || items.length === 0) return;
    setGuardando(true);
    setErrorListo(null);
    const e = await agregarVariosAlPlan(activo.id, comida, items.map(it => ({ alimento_id: it.alimento.id, cantidad: it.cantidad, anadidos: anadidosParaGuardar(it), nombre: it.nombre ?? null })), registro?.fecha ?? hoyISO(), !!registro);
    setGuardando(false);
    if (e) { setErrorListo(e); return; }
    if (registro) await responder(activo.id, registro.fecha, registro.momento, 'respondido');
    const aviso = registro ? `${MOMENTOS[registro.momento].nombre} anotado · ${fmt(totalKcal)} kcal` : undefined;
    bandeja.vaciar();
    setHoja(false);
    onAgregado(aviso);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView key={abierto?.id ?? 'lista'} style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {armando && porId.has(ENSALADA_ID) ? (
          <ArmarEnsalada porId={porId} inicial={armando.opcion ? { nombre: armando.opcion.nombre, anadidos: armando.opcion.items[0]?.anadidos } : null}
            titulo="Ensalada a tu gusto" botonTxt={`Agregar al ${nombre}`} etiquetaNombre="Guardarla como… (si le pones nombre, la próxima vez es un toque)"
            volver={() => setArmando(null)}
            onListo={r => {
              const it: ItemBandeja = { alimento: porId.get(ENSALADA_ID)!, cantidad: 1, texto: r.resumen, anadidos: r.anadidos, nombre: r.nombre || 'Ensalada' };
              bandeja.agregar(it);
              if (r.nombre) {
                const misma = armando.opcion && armando.opcion.nombre === r.nombre ? armando.opcion.id : undefined;
                guardarOpcion({ id: misma, comida, nombre: r.nombre, items: [{ alimento_id: ENSALADA_ID, cantidad: 1, anadidos: anadidosParaGuardar(it) }], tiempo_min: null, dificultad: null })
                  .then(() => recargarOpciones());
              }
              setArmando(null);
            }} />
        ) : abierto ? <Ficha a={abierto} perfilId={activo?.id} volver={() => setAbierto(null)} onMedida={setElegido} /> : (
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
            {verEnsaladas && porId.has(ENSALADA_ID) && (
              <View style={[s.card, { paddingVertical: 4 }]}>
                <Text style={[s.muted12, { paddingTop: 8 }]}>Tus ensaladas</Text>
                {ensaladas.map(o => {
                  const its = itemsDe(o, porId);
                  const partes = (o.items[0]?.anadidos ?? []).map(x => porId.get(x.alimento_id)?.nombre.toLowerCase()).filter(Boolean);
                  return (
                    <Pressable key={o.id} onPress={() => setArmando({ opcion: o })} style={[s.row, s.rowBorde]}>
                      <Miniatura a={porId.get(ENSALADA_ID)!} size={56} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={s.b15} numberOfLines={1}>{o.nombre}</Text>
                        <Text style={s.muted12} numberOfLines={2}>{partes.join(', ')}</Text>
                      </View>
                      <Text style={s.kcal}>{fmt(kcalDe(its))}</Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => setArmando({})} style={[s.row, s.rowBorde]}>
                  <Miniatura a={porId.get(ENSALADA_ID)!} size={56} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={[s.b15, { color: C.accent }]} numberOfLines={1}>+ Ensalada a tu gusto</Text>
                    <Text style={s.muted12} numberOfLines={1}>Ármala con lo que trae</Text>
                  </View>
                </Pressable>
              </View>
            )}
            {misOpciones.length > 0 && (
              <View style={[s.card, { paddingVertical: 4 }]}>
                <Text style={[s.muted12, { paddingTop: 8 }]}>Tus opciones</Text>
                {misOpciones.slice(0, 5).map((o, i) => {
                  const its = itemsDe(o, porId);
                  return (
                    <Pressable key={o.id} onPress={() => setOpcion(o)} style={[s.row, i > 0 && s.rowBorde]}>
                      {its[0] ? <Miniatura a={its[0].alimento} size={56} /> : null}
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={s.b15} numberOfLines={1}>{o.nombre}</Text>
                        <Text style={s.muted12} numberOfLines={1}>Tuya · {nombreComida(o.comida)}</Text>
                      </View>
                      <Text style={s.kcal}>{fmt(kcalDe(its))}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {error ? <Text style={s.soft}>{error}</Text> : !lista ? (
              <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} />
            ) : resultados.length === 0 ? (
              <Text style={s.soft}>No encontramos «{query}». Prueba con otro nombre.</Text>
            ) : (
              <View style={s.card}>
                {resultados.filter(a => !(verEnsaladas && a.id === ENSALADA_ID)).slice(0, 80).map((a, i) => {
                  const n = nutrientes(a, 1);
                  return (
                    <Pressable key={a.id} onPress={() => (a.id === ENSALADA_ID ? setArmando({}) : setAbierto(a))} style={[s.row, i > 0 && s.rowBorde]}>
                      <Miniatura a={a} size={56} />
                      {a.id === ENSALADA_ID ? (
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={s.b15} numberOfLines={1}>{a.nombre}</Text>
                          <Text style={s.muted12} numberOfLines={1}>Ármala con lo que trae</Text>
                        </View>
                      ) : (
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={s.b15} numberOfLines={1}>{a.nombre}</Text>
                        <Text style={s.muted12} numberOfLines={1}>{a.porcion_base.texto} · {fmt(a.porcion_base.gramos)} g</Text>
                        <Text style={s.muted12}>P {fq(n.p)} · C {fq(n.c)} · G {fq(n.gr)}</Text>
                        <Sellos a={a} mini />
                      </View>
                      )}
                      {a.id === ENSALADA_ID ? null : enBandeja.has(a.id) ? <Text style={s.ya}>En la bandeja</Text> : <Text style={s.kcal}>{fmt(n.kcal)}</Text>}
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
                        <Text style={s.b15} numberOfLines={1}>{it.nombre ?? it.alimento.nombre}</Text>
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

      {!armando && (abierto || items.length > 0) && (
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
                    <Text style={s.b15} numberOfLines={1}>{it.nombre ?? it.alimento.nombre}</Text>
                    <Text style={s.muted12} numberOfLines={1}>{it.texto}{FRITOS.has(it.alimento.id) ? ' · ya incluye el aceite' : ''}</Text>
                    {[it.alimento, ...(it.anadidos ?? []).map(x => x.alimento)].some(x => choques(x, activo?.evito).alergia.length > 0) && <Text style={s.alergiaTxt}>Alergia</Text>}
                    {(it.anadidos ?? []).map((x, k) => (
                      <Text key={k} style={s.extra} numberOfLines={1}>+ {x.alimento.nombre.toLowerCase()} {x.texto} · {fmt(nutrientes(x.alimento, x.cantidad).kcal)} kcal</Text>
                    ))}
                  </View>
                  <Text style={s.kcal}>{fmt(kcalBandeja(it))}</Text>
                  <Pressable onPress={() => { bandeja.quitar(i); if (items.length === 1) setHoja(false); }} style={s.quitar} hitSlop={6}>
                    <Text style={s.quitarTxt}>×</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            {activo && delDia && (() => {
              const comido = delDia.filter(i => i.comido);
              const nuevos = items.map(it => ({ alimento_id: it.alimento.id, cantidad: it.cantidad, anadidos: anadidosParaGuardar(it) }));
              const l = limitesDe(gasto(activo).objetivo);
              const cruza = cruzaLimite(saludDelDia(comido, porId), saludDelDia([...comido, ...nuevos], porId), l);
              if (!cruza.length) return null;
              const f = (n: number) => Math.round(n).toLocaleString('es-CO');
              return (
                <View style={s.ojo}>
                  <Text style={s.ojoTit}>Con esto pasarías {cruza.map(c => `${c.m === 'grasaSat' ? 'la' : 'el'} ${NOMBRE[c.m]}`).join(' y ')} de hoy</Text>
                  <Text style={s.ojoTxt}>{cruza.map(c => `Llegarías a ${f(c.valor)} de ${f(c.limite)} ${UNIDAD[c.m]} de ${NOMBRE[c.m]}.`).join(' ')} Tú decides.</Text>
                </View>
              );
            })()}
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
export const itemsDe = (o: Opcion, porId: Map<string, AlimentoDB>): ItemBandeja[] => o.items
  .filter(i => porId.has(i.alimento_id))
  .map(i => {
    const a = porId.get(i.alimento_id)!;
    const anadidos = (i.anadidos ?? []).filter(x => porId.has(x.alimento_id))
      .map(x => { const b = porId.get(x.alimento_id)!; return { alimento: b, cantidad: x.cantidad, texto: `${fmt(b.porcion_base.gramos * x.cantidad)} g` }; });
    return { alimento: a, cantidad: i.cantidad, texto: textoCantidad(a, i.cantidad), anadidos, nombre: a.id === ENSALADA_ID ? o.nombre : undefined };
  });
export const kcalDe = (its: ItemBandeja[]) => its.reduce((t, it) => t + kcalBandeja(it), 0);
// «Pasar a»: la comida donde queda lo que se está editando (se aplica al guardar)
function PasarA({ actual, destino, cambiar }: { actual: ComidaId; destino: ComidaId; cambiar: (c: ComidaId) => void }) {
  return (
    <View style={[s.card, { gap: 8, padding: 14 }]}>
      <Text style={s.overline}>Pasar a</Text>
      <Chips<ComidaId> opciones={COMIDAS} valor={destino} onCambio={cambiar} />
      <Text style={s.muted12}>{destino === actual ? `Está en ${nombreComida(actual).toLowerCase()}. Toca otra comida para pasarlo.` : `Queda en ${nombreComida(destino).toLowerCase()} con su medida y añadidos.`}</Text>
    </View>
  );
}
// Guarda los cambios y, si escogió otra comida, lo pasa allá
async function pasarSiCambio(it: ItemPlan, perfilId: string | undefined, destino: ComidaId) {
  if (destino === it.comida || !perfilId) return null;
  return moverItems(perfilId, it.fecha ?? hoyISO(), [it.id], destino);
}

// Una ensalada guardada: una opción propia con un solo ítem «ensalada»
const esEnsalada = (o: Opcion) => o.fuente !== 'kalo' && o.items.length === 1 && o.items[0].alimento_id === ENSALADA_ID;

// Editar desde Hoy una ensalada ya anotada: se abre armada, igual que al crearla
function EditarEnsalada({ it, cerrar }: { it: ItemPlan; cerrar: (cambio: boolean) => void }) {
  const { lista } = useAlimentos();
  const { activo } = useSesion();
  const [destino, setDestino] = useState<ComidaId>(it.comida);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const porId = useMemo(() => new Map((lista ?? []).map(a => [a.id, a])), [lista]);
  if (!lista) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />;
  const comida = nombreComida(it.comida).toLowerCase();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <ArmarEnsalada porId={porId} inicial={{ nombre: it.nombre, anadidos: it.anadidos }} titulo={it.nombre ?? 'Ensalada'} botonTxt="Guardar cambios" etiquetaNombre="Nombre"
        ocupado={ocupado} volver={() => cerrar(false)}
        onListo={async r => {
          setOcupado(true);
          const e = await editarItem(it.id, { alimento_id: ENSALADA_ID, cantidad: 1, anadidos: r.anadidos.map(x => ({ alimento_id: x.alimento.id, cantidad: x.cantidad })), nombre: r.nombre || 'Ensalada' })
            ?? await pasarSiCambio(it, activo?.id, destino);
          setOcupado(false);
          if (e) setError(e); else cerrar(true);
        }}
        extra={(
          <>
            <PasarA actual={it.comida} destino={destino} cambiar={setDestino} />
            {error && <Text style={u.error}>{error}</Text>}
            <Boton texto={`Quitar del ${comida}`} tipo="borde" onPress={async () => {
              setOcupado(true);
              const e = await quitarItem(it.id);
              setOcupado(false);
              if (e) setError(e); else cerrar(true);
            }} />
          </>
        )} />
    </ScrollView>
  );
}

// Editar desde Hoy algo ya anotado: cambiar medida y añadidos, cambiarlo por otro alimento o quitarlo
export function EditarItem({ it, cerrar }: { it: ItemPlan; cerrar: (cambio: boolean) => void }) {
  const { activo } = useSesion();
  const { lista } = useAlimentos();
  const [a, setA] = useState<AlimentoDB | null>(null);
  const [inicial, setInicial] = useState<{ cantidad: number; anadidos?: Anadido[] | null }>({ cantidad: it.cantidad, anadidos: it.anadidos });
  const [elegido, setElegido] = useState<Elegido | null>(null);
  const [picker, setPicker] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destino, setDestino] = useState<ComidaId>(it.comida);
  useEffect(() => { if (lista && !a) setA(lista.find(x => x.id === it.alimento_id) ?? null); }, [lista]);
  if (it.alimento_id === ENSALADA_ID) return <EditarEnsalada it={it} cerrar={cerrar} />;
  if (!a) return <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />;
  const comida = nombreComida(it.comida).toLowerCase();

  const guardar = async () => {
    if (!elegido) return;
    setOcupado(true);
    const e = await editarItem(it.id, { alimento_id: a.id, cantidad: elegido.cantidad, anadidos: anadidosParaGuardar({ alimento: a, cantidad: elegido.cantidad, texto: '', anadidos: elegido.anadidos }) })
      ?? await pasarSiCambio(it, activo?.id, destino);
    setOcupado(false);
    if (e) return setError(e);
    cerrar(true);
  };
  const quitar = async () => {
    setOcupado(true);
    const e = await quitarItem(it.id);
    setOcupado(false);
    if (e) return setError(e);
    cerrar(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView key={a.id} style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {picker ? (
          <AlimentoPicker titulo={`Cambiar ${a.nombre.toLowerCase()} por…`} onCerrar={() => setPicker(false)} onElegir={b => {
            // Mismo tamaño de porción (p. ej. arepa blanca → amarilla): se queda la cantidad; si no, 1 porción. Los añadidos se quedan.
            const nueva = b.porcion_base.gramos === a.porcion_base.gramos ? (elegido?.cantidad ?? it.cantidad) : 1;
            // «Aceite como en la casa» va por porción: se recalcula con la nueva cantidad
            const anadidos = elegido?.anadidos?.map((x, k) => ({
              alimento_id: x.alimento.id,
              cantidad: elegido.recordar?.[k]?.casa ? (ACEITE_CASA_G * nueva * (elegido.recordar[k].unidades || 1)) / x.alimento.porcion_base.gramos : x.cantidad,
            })) ?? inicial.anadidos;
            setInicial({ cantidad: nueva, anadidos });
            setA(b);
            setPicker(false);
          }} />
        ) : (
          <Ficha key={a.id} a={a} perfilId={activo?.id} volverTxt="‹ Hoy" volver={() => cerrar(false)} onMedida={setElegido} inicial={inicial}
            extra={(
              <>
                <PasarA actual={it.comida} destino={destino} cambiar={setDestino} />
                <Pressable onPress={() => setPicker(true)} style={s.cambiar}>
                  <Text style={[s.link, { fontSize: 14 }]}>Cambiar por otro alimento</Text>
                </Pressable>
              </>
            )} />
        )}
      </ScrollView>
      {!picker && (
        <View style={s.bandeja}>
          <View style={s.bandejaIn}>
            <Pressable onPress={quitar} disabled={ocupado} style={s.btnQuitar}><Text style={s.btnQuitarTxt}>Quitar del {comida}</Text></Pressable>
            <Pressable onPress={guardar} disabled={ocupado || !elegido} style={[s.listo, { flex: 1 }, !elegido && { opacity: 0.4 }]}>
              {ocupado ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.listoTxt}>Guardar cambios</Text>}
            </Pressable>
          </View>
          {error && <Text style={[u.error, s.bandejaError]}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

// Aviso rojo cuando algo lleva lo que le da alergia a la persona
function AvisoAlergia({ nombre, cosas }: { nombre: string; cosas: string[] }) {
  return (
    <View style={s.alerta}>
      <Text style={s.alertaTit}>{nombre}: alergia a {[...new Set(cosas)].join(', ')}</Text>
      <Text style={s.alertaTxt}>Kalo no te lo recomienda. Si igual lo agregas, queda anotado.</Text>
    </View>
  );
}

// Los añadidos NO se recuerdan de una vez para otra: el alimento sale limpio. Solo vuelven si se guardó como preparación propia
// («Guardarlo como mío» → sale en «Mis opciones» y al buscar). Recuerdo = cómo se escogió cada añadido en esta ficha.
interface Recuerdo { alimento_id: string; unidades: number; casa?: boolean }

interface Elegido { cantidad: number; texto: string; anadidos?: AnadidoBandeja[]; recordar?: Recuerdo[]; guardarComo?: string | null }
// Un añadido en la ficha: en unidades de cocina (cucharaditas) o en porciones del alimento si es «otra cosa»
interface AnadidoFicha { alimento: AlimentoDB; unidad: Unidad; unidades: number; casa?: boolean; generico?: boolean }

// Solo las opciones propias de esa comida; las de Kalo quedan detrás de un botón para que las propias no se pierdan
function ListaOpciones({ opciones, comida, porId, abrir }: { opciones: Opcion[] | null; comida: ComidaId; porId: Map<string, AlimentoDB>; abrir: (o: Opcion) => void }) {
  const { activo } = useSesion();
  const [deKalo, setDeKalo] = useState(false);
  if (!opciones || porId.size === 0) return <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} />;
  const deLa = opciones.filter(o => o.comida === comida && o.items.length > 0);
  const bloquea = (o: Opcion) => revisarItems(o.items, porId, activo?.evito).bloquea;
  const mias = deLa.filter(o => o.fuente !== 'kalo'), kalo = deLa.filter(o => o.fuente === 'kalo').sort((a, b) => Number(bloquea(a)) - Number(bloquea(b)));
  const nombre = nombreComida(comida).toLowerCase();
  const tarjeta = (lista: Opcion[]) => (
    <View style={[s.card, { paddingVertical: 4 }]}>
      {lista.map((o, i) => {
        const its = itemsDe(o, porId);
        const rev = revisarItems(o.items, porId, activo?.evito);
        return (
          <Pressable key={o.id} onPress={() => abrir(o)} style={[s.opc, i > 0 && s.rowBorde, rev.bloquea && { opacity: 0.55 }]}>
            <View style={s.rowEntre}>
              <Text style={[s.b15, { flex: 1 }]} numberOfLines={2}>{o.nombre}</Text>
              <Text style={s.kcal}>{fmt(kcalDe(its))}</Text>
            </View>
            {rev.conAlergia.length > 0 ? <Text style={s.alergiaTxt}>Lleva {rev.conAlergia[0].nombre.toLowerCase()} · alergia</Text>
              : rev.conEvito.length > 0 ? <Text style={s.evitoTxt}>Lleva {rev.conEvito[0].nombre.toLowerCase()} · lo evitas</Text> : null}
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
  return (
    <View style={{ gap: 12 }}>
      {mias.length > 0 ? tarjeta(mias) : <Text style={s.soft}>Aún no tienes opciones de {nombre} guardadas. Puedes crearlas en Menú.</Text>}
      {kalo.length > 0 && (deKalo ? (
        <>
          <View style={s.rowEntre}>
            <Text style={s.muted13}>Opciones de Kalo</Text>
            <Pressable onPress={() => setDeKalo(false)} hitSlop={8}><Text style={[s.link, { fontSize: 14 }]}>Ocultar</Text></Pressable>
          </View>
          {tarjeta(kalo)}
        </>
      ) : <Boton texto={`Ver opciones de Kalo (${kalo.length})`} tipo="borde" onPress={() => setDeKalo(true)} />)}
    </View>
  );
}

// La opción abierta: sus alimentos y «Agregar los N a la bandeja»
function HojaOpcion({ o, porId, cerrar }: { o: Opcion; porId: Map<string, AlimentoDB>; cerrar: () => void }) {
  const { activo } = useSesion();
  const its = itemsDe(o, porId);
  const rev = revisarItems(o.items, porId, activo?.evito);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={s.velo} onPress={cerrar} />
      <View style={s.hoja}>
        <View style={s.agarre} />
        <View style={[s.rowEntre, { alignItems: 'baseline' }]}>
          <Text style={[s.h1, { fontSize: 21, flex: 1 }]} numberOfLines={2}>{o.nombre}</Text>
          <Text style={s.muted13}>{fmt(kcalDe(its))} kcal</Text>
        </View>
        {rev.conAlergia.length > 0 && activo && <AvisoAlergia nombre={activo.nombre} cosas={rev.conAlergia.map(a => a.nombre.toLowerCase())} />}
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={[s.card, { backgroundColor: C.surface2, paddingVertical: 4 }]}>
          {its.map((it, i) => (
            <View key={i} style={[s.row, i > 0 && s.rowBorde]}>
              <Miniatura a={it.alimento} size={46} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={s.b15} numberOfLines={1}>{it.alimento.nombre}</Text>
                <Text style={s.muted12} numberOfLines={1}>{it.texto}</Text>
              </View>
              <Text style={s.kcal}>{fmt(kcalBandeja(it))}</Text>
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

function desdeGuardado(guardados: Anadido[], sug: ReturnType<typeof sugerencias>, cantidad: number, _g: number): AnadidoFicha[] {
  const mapa = mapaCache();
  return guardados.flatMap(x => {
    const b = mapa.get(x.alimento_id);
    if (!b) return [];
    const gramos = x.cantidad * b.porcion_base.gramos;
    const casa = sug.find(s => s.alimento_id === x.alimento_id && s.casa);
    if (casa && cantidad > 0 && Math.abs(gramos / (ACEITE_CASA_G * cantidad) - Math.round(gramos / (ACEITE_CASA_G * cantidad))) < 0.01)
      return [{ alimento: b, unidad: casa.unidad, unidades: Math.max(1, Math.round(gramos / (ACEITE_CASA_G * cantidad))), casa: true }];
    const sg = sug.find(s => s.alimento_id === x.alimento_id && !s.casa);
    if (sg) return [{ alimento: b, unidad: sg.unidad, unidades: Math.round((gramos / sg.unidad.gramos) * 2) / 2 }];
    return [{ alimento: b, unidad: porcionUnidad(b), unidades: x.cantidad, generico: true }];
  });
}

const porcionUnidad = (b: AlimentoDB): Unidad => ({ gramos: b.porcion_base.gramos, una: b.porcion_base.texto, varias: b.porcion_base.texto });

// inicial: lo que ya estaba anotado (al editar desde Hoy). Si la cantidad no cae en pasos de ½, abre en «Mi medida» con sus gramos.
function Ficha({ a, perfilId, volver, onMedida, inicial, volverTxt = '‹ Alimentos', extra }: {
  a: AlimentoDB; perfilId?: string; volver: () => void; onMedida: (m: Elegido | null) => void;
  inicial?: { cantidad: number; anadidos?: Anadido[] | null }; volverTxt?: string; extra?: ReactNode;
}) {
  const enPasos = !inicial || Math.abs(inicial.cantidad * 2 - Math.round(inicial.cantidad * 2)) < 1e-6;
  const [modo, setModo] = useState<'kalo' | 'g'>(enPasos ? 'kalo' : 'g');
  const [mult, setMult] = useState(inicial && enPasos ? Math.max(0.5, inicial.cantidad) : 1);
  const [gramos, setGramos] = useState(String(Math.round(a.porcion_base.gramos * (inicial && !enPasos ? inicial.cantidad : 1))));
  const g = Number(gramos.replace(',', '.'));
  const gOk = Number.isFinite(g) && g > 0 && g <= 3000;
  const cantidad = modo === 'g' ? (gOk ? g / a.porcion_base.gramos : 0) : mult;

  // «Añadidos»: sugerencias de la casa (panela, aceite…) + lo que la persona sume; arranca vacío (o con lo ya anotado, al editar)
  const mapa = mapaCache();
  const { activo: perfilFicha } = useSesion();
  const ev = perfilFicha?.evito;
  const sug = useMemo(() => sugerencias(a).filter(x => mapa.has(x.alimento_id) && (() => { const c = choques(mapa.get(x.alimento_id)!, ev); return c.alergia.length + c.evito.length === 0; })()), [a.id, ev]);
  const [ads, setAds] = useState<AnadidoFicha[]>(() => inicial ? desdeGuardado(inicial.anadidos ?? [], sug, inicial.cantidad, a.porcion_base.gramos) : []);
  const [picker, setPicker] = useState(false);
  const [guardar, setGuardar] = useState(false);
  const [nombreMio, setNombreMio] = useState(`Mi ${a.nombre.toLowerCase()}`);
  const cantidadDe = (x: AnadidoFicha) => (x.casa ? ACEITE_CASA_G * cantidad * x.unidades : x.unidades * x.unidad.gramos) / x.alimento.porcion_base.gramos;
  const textoDe = (x: AnadidoFicha) => x.casa ? 'como en la casa'
    : x.generico ? (x.unidades === 1 ? x.unidad.una : `${fq(x.unidades)} × ${x.unidad.una}`)
      : `${fq(x.unidades)} ${x.unidades === 1 ? x.unidad.una : x.unidad.varias}`;
  const anadidos: AnadidoBandeja[] = ads.map(x => ({ alimento: x.alimento, cantidad: cantidadDe(x), texto: textoDe(x) }));
  type Sug = (typeof sug)[number];
  const sugOn = (x: Sug) => ads.some(y => y.alimento.id === x.alimento_id && !!y.casa === !!x.casa);
  const tocarSug = (x: Sug) => setAds(v => sugOn(x)
    ? v.filter(y => !(y.alimento.id === x.alimento_id && !!y.casa === !!x.casa))
    : [...v, { alimento: mapa.get(x.alimento_id)!, unidad: x.unidad, unidades: x.inicial, casa: x.casa }]);

  const base = nutrientes(a, cantidad);
  const mapaFicha = mapa.has(a.id) ? mapa : new Map([[a.id, a], ...ads.map(x => [x.alimento.id, x.alimento] as [string, AlimentoDB])]);
  const n = nutrientesItem({ alimento_id: a.id, cantidad, anadidos: anadidos.map(x => ({ alimento_id: x.alimento.id, cantidad: x.cantidad })) }, mapaFicha);
  const texto = modo === 'g'
    ? `${fmt(g)} g`
    : `${mult === 1 ? '' : `${fq(mult)} × `}${a.porcion_base.texto} · ${fmt(base.g)} g`;
  const firma = JSON.stringify(anadidos.map(x => [x.alimento.id, x.cantidad])) + guardar + nombreMio;
  useEffect(() => {
    onMedida(cantidad > 0 ? {
      cantidad, texto, anadidos,
      recordar: ads.map(x => ({ alimento_id: x.alimento.id, unidades: x.unidades, casa: x.casa })),
      guardarComo: guardar && ads.length > 0 && nombreMio.trim() ? nombreMio.trim() : null,
    } : null);
  }, [cantidad, texto, firma]);
  if (picker) {
    return <AlimentoPicker titulo={`Añadir a ${a.nombre.toLowerCase()}`} onCerrar={() => setPicker(false)}
      onElegir={b => { setAds(v => [...v, { alimento: b, unidad: porcionUnidad(b), unidades: 1, generico: true }]); setPicker(false); }} />;
  }
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
        <Text style={s.link}>{volverTxt}</Text>
      </Pressable>
      {uri ? <Image source={{ uri }} style={s.hero} /> : <View style={s.hero} />}
      <View style={{ gap: 2 }}>
        <Text style={s.overline}>{CATEGORIAS[a.categoria] ?? a.categoria}</Text>
        <Text style={s.h1}>{a.nombre}</Text>
        {a.sinonimos.length > 0 && <Text style={s.muted13}>También: {a.sinonimos.join(', ')}</Text>}
      </View>
      <Sellos a={a} />
      <Advertencia a={a} />
      {extra}
      {(() => {
        const al = [a, ...ads.map(x => x.alimento)].filter(x => choques(x, ev).alergia.length > 0);
        const evi = choques(a, ev).evito;
        if (al.length && perfilFicha) return <AvisoAlergia nombre={perfilFicha.nombre} cosas={al.map(x => x.nombre.toLowerCase())} />;
        if (evi.length) return <Text style={s.evitoTxt}>Lo evitas: {evi.join(', ').toLowerCase()}. Kalo no te lo recomienda.</Text>;
        return null;
      })()}

      <View style={[s.card, { gap: 16 }]}>
        <View style={{ minWidth: 0 }}>
          <Text style={s.hero50}>{fmt(n.kcal)}</Text>
          <Text style={s.muted13}>{modo === 'g' ? `kcal en ${gOk ? fmt(g) : 0} g` : `kcal · ${fq(mult)} × ${a.porcion_base.texto} (${fmt(base.g)} g)`}{ads.length > 0 ? ' + añadidos' : ''}</Text>
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
            <Text style={[s.b14, { flex: 1, fontWeight: '400' }]}>{fq(mult)} × {a.porcion_base.texto} · {fmt(base.g)} g</Text>
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

      <View style={[s.card, { gap: 10 }]}>
        <Text style={s.b15}>Añadidos</Text>
        {sug.length > 0 && (
          <View style={s.sugs}>
            {sug.map(x => {
              const on = sugOn(x);
              return (
                <Pressable key={x.nombre} onPress={() => tocarSug(x)} style={[s.sugChip, on && s.sugOn]}>
                  <Text style={[s.sugTxt, on && { color: C.onAccent }]}>{x.nombre}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {FRITOS.has(a.id) && <Text style={s.muted12}>Ya incluye el aceite en que se fríe.</Text>}
        {ads.map((x, k) => (
          <View key={k} style={[s.anRow, s.rowBorde]}>
            <Miniatura a={x.alimento} size={34} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.b14, { fontWeight: '700' }]} numberOfLines={1}>{x.casa ? 'Aceite' : x.alimento.nombre}</Text>
              <Text style={s.muted12} numberOfLines={1}>{textoDe(x)}</Text>
            </View>
            {!x.casa && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable onPress={() => setAds(v => v.map((y, j) => (j === k ? { ...y, unidades: Math.max(0.5, y.unidades - (y.generico ? 0.5 : 1)) } : y)))} style={s.miniBtn}><Text style={s.miniTxt}>−</Text></Pressable>
                <Pressable onPress={() => setAds(v => v.map((y, j) => (j === k ? { ...y, unidades: y.unidades + (y.generico ? 0.5 : 1) } : y)))} style={s.miniBtn}><Text style={s.miniTxt}>+</Text></Pressable>
              </View>
            )}
            <Text style={[s.kcal, { fontSize: 13 }]}>{fmt(nutrientes(x.alimento, cantidadDe(x)).kcal)}</Text>
            <Pressable onPress={() => setAds(v => v.filter((_, j) => j !== k))} hitSlop={6} style={{ width: 20, alignItems: 'center' }}><Text style={s.quitarTxt}>×</Text></Pressable>
          </View>
        ))}
        <Pressable onPress={() => setPicker(true)} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={[s.link, { fontSize: 14 }]}>+ Añadir otra cosa</Text></Pressable>
        {ads.length > 0 && (
          <View style={{ gap: 8 }}>
            <Pressable onPress={() => setGuardar(v => !v)} style={s.guardar}>
              <View style={[s.caja, guardar && s.cajaOn]}>{guardar && <Text style={{ color: C.onAccent, fontWeight: '800', fontSize: 13 }}>✓</Text>}</View>
              <Text style={s.b14}>Guardarlo como mío</Text>
            </Pressable>
            {guardar && <TextInput value={nombreMio} onChangeText={setNombreMio} style={[s.input, { borderWidth: 1, borderColor: C.accent }]} placeholder="Nombre, p. ej. Mi batido" placeholderTextColor={C.muted} />}
          </View>
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
  alergiaTxt: { fontSize: 12, fontWeight: '700', color: '#FF8A84' },
  ojo: { backgroundColor: '#2A2210', borderWidth: 1, borderColor: C.fat, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 13, gap: 3 },
  ojoTit: { color: C.fat, fontSize: 14.5, fontWeight: '700' },
  ojoTxt: { color: C.soft, fontSize: 12.5, lineHeight: 18 },
  evitoTxt: { fontSize: 12, fontWeight: '700', color: C.accent },
  alerta: { backgroundColor: '#2A1414', borderWidth: 1, borderColor: '#E5534B', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  alertaTit: { color: '#FF8A84', fontSize: 15, fontWeight: '700' },
  alertaTxt: { color: C.soft, fontSize: 13 },
  cambiar: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12 },
  btnQuitar: { height: 44, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  btnQuitarTxt: { color: C.text, fontSize: 14, fontWeight: '700' },
  extra: { fontSize: 12, color: C.fat, fontWeight: '600' },
  sugs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sugChip: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 11 },
  sugOn: { backgroundColor: C.accent, borderColor: C.accent },
  sugTxt: { fontSize: 13, fontWeight: '600', color: C.text },
  anRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  miniBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  miniTxt: { color: C.text, fontSize: 16, fontWeight: '600' },
  guardar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  caja: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  cajaOn: { backgroundColor: C.accent, borderColor: C.accent },
  miniO: { borderRadius: 10, borderWidth: 2, borderColor: C.surface },
});
