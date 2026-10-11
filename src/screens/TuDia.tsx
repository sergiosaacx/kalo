import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Boton, Campo, Chips, FechaNacimiento, Segmento, u } from '../components/ui';
import {
  CASA, EJERCICIOS, EXTRA_INICIAL, OFICIOS, RESTO, RUTINA_INICIAL, TRABAJO_COMO, TRANSPORTES, gastoPorRutina, hora12, horasEntre, horasJornada, horasSueno,
  type Casa, type Ejercicio, type Intensidad, type Ocupacion, type Resto, type Rutina, type TrabajoExtra, type Transporte,
} from '../logic/actividad';
import { edadDe, errorFecha, fechaValida, fmt, gasto, type Salud, type Sexo } from '../logic/energia';
import { reconocer } from '../data/actividades';
import { C } from '../theme';

type Pantalla = 'datos' | 'sueno' | 'ocupacion' | 'oficio' | 'horario' | 'transporte' | 'estudio' | 'extra' | 'extraHorario' | 'casa' | 'resto' | 'ejercicio' | 'resultado';
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const fq = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');

function secuencia(r: Rutina, conDatos: boolean): Pantalla[] {
  const s: Pantalla[] = conDatos ? ['datos', 'sueno', 'ocupacion'] : ['sueno', 'ocupacion'];
  if (r.ocupacion === 'trabajo' || r.ocupacion === 'ambos') s.push('oficio');
  if (r.ocupacion === 'trabajo' || r.ocupacion === 'ambos' || r.ocupacion === 'estudio') s.push('horario', 'transporte');
  if (r.ocupacion === 'ambos') s.push('estudio');
  s.push('extra');
  if (r.extra) s.push('extraHorario');
  s.push('casa', 'resto', 'ejercicio', 'resultado');
  return s;
}

// Días de la semana, se tocan para marcar o quitar
function Dias({ valor, onCambio }: { valor: boolean[]; onCambio: (d: boolean[]) => void }) {
  return (
    <View style={[u.card, { gap: 10 }]}>
      <Text style={u.label}>¿Qué días? Toca para marcar o quitar</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DIAS.map((d, k) => (
          <Pressable key={k} onPress={() => onCambio(valor.map((x, j) => (j === k ? !x : x)))}
            style={[s.dia, valor[k] && { backgroundColor: C.accent, borderColor: C.accent }]}>
            <Text style={[s.diaTxt, { color: valor[k] ? C.onAccent : C.text }]}>{d}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Reloj: la hora sube y baja de una en una; los minutos se escogen con un toque
function Reloj({ etiqueta, valor, onCambio }: { etiqueta: string; valor: number; onCambio: (m: number) => void }) {
  const h = Math.floor(valor / 60), m = valor % 60;
  const hora = (d: number) => onCambio((((h + d) % 24 + 24) % 24) * 60 + m);
  return (
    <View style={[u.card, { gap: 8, padding: 14 }]}>
      <Text style={u.label}>{etiqueta}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => hora(-1)} style={u.stepBtn}><Text style={u.stepTxt}>−</Text></Pressable>
        <Text style={s.hora}>{hora12(valor)}</Text>
        <Pressable onPress={() => hora(1)} style={u.stepBtn}><Text style={u.stepTxt}>+</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 15, 30, 45].map(mm => (
          <Pressable key={mm} onPress={() => onCambio(h * 60 + mm)} style={[s.min, m === mm && { backgroundColor: C.accent, borderColor: C.accent }]}>
            <Text style={[s.minTxt, { color: m === mm ? C.onAccent : C.text }]}>:{String(mm).padStart(2, '0')}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Chips de minutos con «Otro» para escribir el número exacto
function Minutos({ valor, opciones, onCambio }: { valor: number; opciones: number[]; onCambio: (m: number) => void }) {
  const [otro, setOtro] = useState(!opciones.includes(valor));
  const [txt, setTxt] = useState(opciones.includes(valor) ? '' : String(valor));
  const etiqueta = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} ${m === 60 ? 'hora' : 'horas'}`);
  return (
    <View style={{ gap: 10 }}>
      <Chips<string> valor={otro ? 'otro' : String(valor)}
        onCambio={v => { if (v === 'otro') setOtro(true); else { setOtro(false); onCambio(Number(v)); } }}
        opciones={[...opciones.map(m => [String(m), etiqueta(m)] as [string, string]), ['otro', 'Otro']]} />
      {otro && (
        <Campo etiqueta="¿Cuántos minutos?" unidad="min" value={txt} keyboardType="number-pad" placeholder="Ej. 7" autoFocus
          onChangeText={v => { setTxt(v); const n = parseInt(v, 10); if (n > 0 && n <= 600) onCambio(n); }} />
      )}
    </View>
  );
}

// Cuadros en dos columnas (opciones cortas de una sola respuesta)
function Cuadros<T extends string>({ opciones, valor, onCambio }: { opciones: [T, string, string?][]; valor: T | null; onCambio: (v: T) => void }) {
  return (
    <View style={s.cuadros}>
      {opciones.map(([id, l, sub]) => {
        const on = id === valor;
        return (
          <Pressable key={id} onPress={() => onCambio(id)} style={[s.cuadro, on && s.cuadroOn]}>
            <Text style={[s.cuadroTxt, on && { color: C.accent }]} numberOfLines={2}>{l}</Text>
            {sub ? <Text style={s.cuadroSub} numberOfLines={1}>{sub}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// Buscador para listas largas: muestra pocas opciones a la vez y, si no está, deja usar lo escrito.
// Así la lista puede crecer sin que la pantalla crezca.
function Buscador({ items, valor, otroTexto, onEscoger, onOtro, placeholder, visibles = 8 }: {
  items: { id: string; nombre: string; ej: string }[]; valor: string | null; otroTexto: string;
  onEscoger: (id: string) => void; onOtro: (texto: string) => void; placeholder: string; visibles?: number;
}) {
  const [q, setQ] = useState('');
  const [todos, setTodos] = useState(false);
  const n = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtrados = q.trim() ? items.filter(it => n(`${it.nombre} ${it.ej}`).includes(n(q.trim()))) : items;
  const escogido = items.find(it => it.id === valor);
  // El escogido siempre a la vista, aunque no esté entre los primeros
  const vista = todos ? filtrados : filtrados.slice(0, visibles);
  if (escogido && !q.trim() && !vista.includes(escogido)) vista[vista.length - 1] = escogido;
  return (
    <View style={{ gap: 10 }}>
      <TextInput value={q} onChangeText={setQ} placeholder={placeholder} placeholderTextColor={C.muted} style={s.buscar} autoCorrect={false} />
      {valor === 'otro' && otroTexto ? (
        <View style={[s.cuadro, s.cuadroOn, { width: '100%' }]}>
          <Text style={[s.cuadroTxt, { color: C.accent }]}>«{otroTexto}»</Text>
          <Text style={s.cuadroSub}>Lo que escribiste · para cambiarlo, escribe arriba</Text>
        </View>
      ) : null}
      {/* Con «Otro» ya escogido no hace falta la lista: para cambiar, se vuelve a escribir */}
      {(valor !== 'otro' || q.trim() !== '') && (
        <Cuadros<string> opciones={vista.map(it => [it.id, it.nombre, it.ej] as [string, string, string])} valor={valor} onCambio={id => { onEscoger(id); setQ(''); }} />
      )}
      {q.trim() !== '' && (
        <Pressable onPress={() => { onOtro(q.trim()); setQ(''); }} style={[s.cuadro, { width: '100%', borderStyle: 'dashed', borderColor: C.border }]}>
          <Text style={s.cuadroTxt}>{filtrados.length ? 'No es ninguno: usar ' : 'Usar '}«{q.trim()}»</Text>
          <Text style={s.cuadroSub}>Kalo lo reconoce y calcula su gasto</Text>
        </Pressable>
      )}
      {(valor !== 'otro' || q.trim() !== '') && filtrados.length > visibles && (
        <Pressable onPress={() => setTodos(!todos)} style={s.verMas}>
          <Text style={s.verMasTxt}>{todos ? 'Ver menos' : `Ver más (${filtrados.length - visibles})`}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Lista de opciones grandes, una por fila (para preguntas de una sola respuesta)
function Opciones<T extends string>({ opciones, valor, onCambio }: { opciones: [T, string, string?][]; valor: T | null; onCambio: (v: T) => void }) {
  return (
    <View style={{ gap: 8 }}>
      {opciones.map(([id, l, sub]) => {
        const on = id === valor;
        return (
          <Pressable key={id} onPress={() => onCambio(id)} style={[s.opcion, on && { borderColor: C.accent, backgroundColor: '#2A1C16' }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.opcionTxt}>{l}</Text>
              {sub ? <Text style={s.opcionSub}>{sub}</Text> : null}
            </View>
            <View style={[s.radio, on && { borderColor: C.accent, backgroundColor: C.accent }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

// Sin «base» es el simulacro (pide los datos y no guarda). Con «base» (datos del perfil) se usa en el
// registro y en la pestaña Gasto: arranca en el sueño y al final entrega la rutina con onListo.
export function TuDia({ onSalir, base, inicial, onListo, textoListo = 'Continuar' }: {
  onSalir?: () => void;
  base?: { edad: number; estatura: number; peso: number; sexo: Sexo; salud?: Salud | null };
  inicial?: Rutina;
  onListo?: (r: Rutina) => void | Promise<void>;
  textoListo?: string;
}) {
  const [r, setR] = useState<Rutina>({ ...RUTINA_INICIAL, ...inicial });
  const [guardando, setGuardando] = useState(false);
  const [datos, setDatos] = useState({ estatura: '165', peso: '65', sexo: 'F' as Sexo });
  const [nac, setNac] = useState({ dia: '', mes: '', anio: '' });
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<Ejercicio | null>(null);
  const [revisando, setRevisando] = useState(false);
  const set = (p: Partial<Rutina>) => setR(x => ({ ...x, ...p }));
  const setExtra = (p: Partial<TrabajoExtra>) => setR(x => ({ ...x, extra: { ...(x.extra ?? EXTRA_INICIAL), ...p } }));

  const pasos = secuencia(r, !base);
  const pantalla = pasos[Math.min(i, pasos.length - 1)];
  const total = pasos.length - 1; // sin contar el resultado

  const fechaNac = fechaValida(nac.dia, nac.mes, nac.anio);
  const edad = base?.edad ?? (fechaNac ? edadDe(fechaNac) : 30);
  const estatura = base?.estatura ?? parseFloat(datos.estatura), peso = base?.peso ?? parseFloat(datos.peso.replace(',', '.'));
  const perfil = { id: '', nombre: '', edad, sexo: base?.sexo ?? datos.sexo, estatura, peso, pesoInicial: peso, meta: 'mantener' as const, pesoMeta: peso, ritmo: 0.5, trabajo: 'pie' as const, pasos: 6000, ejercicio: 20, sueno: 7, color: '', salud: base?.salud };
  const listo = async () => { if (!onListo) return; setGuardando(true); await onListo(r); setGuardando(false); };

  const validar = (): string | null => {
    if (pantalla === 'datos') {
      const ef = errorFecha(nac.dia, nac.mes, nac.anio);
      if (ef) return ef;
      if (!(estatura >= 100 && estatura <= 230)) return 'La estatura va en centímetros, por ejemplo 165.';
      if (!(peso >= 30 && peso <= 250)) return 'El peso va en kilos, por ejemplo 65.';
    }
    if (pantalla === 'sueno' && (horasSueno(r) < 3 || horasSueno(r) > 14)) return 'Revisa las horas: así dormirías ' + fq(horasSueno(r)) + ' horas.';
    if (pantalla === 'oficio' && !r.oficio) return 'Escoge el trabajo que más se parezca al tuyo.';
    if (pantalla === 'oficio' && r.oficio === 'otro' && !r.oficioOtro.trim()) return 'Escribe en qué trabajas.';
    if (pantalla === 'extra' && r.extra && !r.extra.oficio) return 'Escoge qué haces, o toca «No».';
    if (pantalla === 'extra' && r.extra?.oficio === 'otro' && !r.extra.otro.trim()) return 'Escribe qué haces.';
    if (pantalla === 'extraHorario' && r.extra && !r.extra.dias.some(Boolean)) return 'Toca al menos un día.';
    if (pantalla === 'extraHorario' && r.extra && horasEntre(r.extra.entrada, r.extra.salida) < 0.25) return 'Revisa la hora de inicio y de fin.';
    if (pantalla === 'horario' && !r.dias.some(Boolean)) return 'Toca al menos un día.';
    if (pantalla === 'horario' && horasJornada(r) < 1) return 'Revisa la hora de entrada y de salida.';
    return null;
  };
  const siguiente = async () => {
    const e = validar(); setError(e);
    if (e) return;
    // «Otro trabajo»: el catálogo o la IA reconocen lo que escribió, antes de seguir
    if (pantalla === 'oficio' && r.oficio === 'otro' && r.oficioMet === undefined) {
      setRevisando(true);
      const rec = await reconocer(r.oficioOtro, 'trabajo');
      setRevisando(false);
      if (rec) set({ oficioMet: rec.met, oficioReconocido: rec.nombre });
    }
    if (pantalla === 'extra' && r.extra?.oficio === 'otro' && r.extra.met === undefined) {
      setRevisando(true);
      const rec = await reconocer(r.extra.otro, 'trabajo');
      setRevisando(false);
      if (rec) setExtra({ met: rec.met, reconocido: rec.nombre });
    }
    setI(i + 1);
  };
  const agregarEjercicio = async () => {
    if (!nuevo) return;
    if (nuevo.tipo === 'otro' && !nuevo.nombre?.trim()) return setError('Escribe qué actividad haces.');
    setError(null);
    let ej = nuevo;
    if (nuevo.tipo === 'otro') {
      setRevisando(true);
      const rec = await reconocer(nuevo.nombre!, 'ejercicio');
      setRevisando(false);
      if (rec) ej = { ...nuevo, met: rec.met, reconocido: rec.nombre };
    }
    set({ ejercicios: [...r.ejercicios, ej] });
    setNuevo(null);
  };
  const atras = () => { setError(null); if (i === 0) onSalir?.(); else setI(i - 1); };

  return (
    <View style={{ flex: 1 }}>
      {pantalla !== 'resultado' && (
        <View style={s.barra}><View style={[s.barraFill, { width: `${((i + 1) / total) * 100}%` }]} /></View>
      )}
      <ScrollView key={pantalla + (nuevo ? '-nuevo' : '')} style={{ flex: 1 }} contentContainerStyle={s.cont} keyboardShouldPersistTaps="handled">
        {pantalla !== 'resultado' && <Text style={s.paso}>Pregunta {i + 1} de {total}</Text>}

        {pantalla === 'datos' && (<>
          <Text style={s.titulo}>Primero, tus datos</Text>
          <Text style={u.soft}>Con esto sabemos cuánto gasta tu cuerpo en reposo.</Text>
          <FechaNacimiento valor={nac} onCambio={setNac} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Campo etiqueta="Estatura" unidad="cm" value={datos.estatura} onChangeText={v => setDatos({ ...datos, estatura: v })} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Campo etiqueta="Peso" unidad="kg" value={datos.peso} onChangeText={v => setDatos({ ...datos, peso: v })} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={u.label}>Sexo biológico</Text>
            <Segmento<Sexo> opciones={[['F', 'Mujer'], ['M', 'Hombre']]} valor={datos.sexo} onCambio={v => setDatos({ ...datos, sexo: v })} />
          </View>
        </>)}

        {pantalla === 'sueno' && (<>
          <Text style={s.titulo}>¿A qué hora te levantas y a qué hora te acuestas?</Text>
          <Text style={u.soft}>Piensa en un día normal entre semana.</Text>
          <Reloj etiqueta="Me levanto a las" valor={r.levanta} onCambio={v => set({ levanta: v })} />
          <Reloj etiqueta="Me acuesto a las" valor={r.acuesta} onCambio={v => set({ acuesta: v })} />
          <Text style={s.nota}>Duermes unas <Text style={s.notaB}>{fq(horasSueno(r))} horas</Text>.</Text>
        </>)}

        {pantalla === 'ocupacion' && (<>
          <Text style={s.titulo}>¿Trabajas o estudias?</Text>
          <Opciones<Ocupacion> valor={r.ocupacion} onCambio={v => set({ ocupacion: v, casa: v === 'hogar' ? 'todo' : r.casa })} opciones={[
            ['trabajo', 'Trabajo'], ['estudio', 'Estudio'], ['ambos', 'Trabajo y estudio'],
            ['hogar', 'Me dedico al hogar'], ['ninguna', 'Pensionado o sin trabajo ahora'],
          ]} />
        </>)}

        {pantalla === 'oficio' && (<>
          <Text style={s.titulo}>¿En qué trabajas?</Text>
          <Buscador items={OFICIOS} valor={r.oficio} otroTexto={r.oficioOtro} placeholder="Busca tu trabajo: mesero, conductor…"
            onEscoger={id => set({ oficio: id })}
            onOtro={t => set({ oficio: 'otro', oficioOtro: t, oficioMet: undefined, oficioReconocido: undefined })} />
          {r.oficio === 'otro' && (<>
            {r.oficioReconocido && <Text style={s.nota}>Kalo lo reconoce como <Text style={s.notaB}>{r.oficioReconocido}</Text>.</Text>}
            <Text style={u.label}>¿Cómo es ese trabajo la mayor parte del tiempo?</Text>
            <Cuadros<string> valor={r.oficioComo} onCambio={v => set({ oficioComo: v })} opciones={TRABAJO_COMO.map(([id, l]) => [id, l])} />
          </>)}
        </>)}

        {pantalla === 'horario' && (<>
          <Text style={s.titulo}>{r.ocupacion === 'estudio' ? '¿Qué horario de clases tienes?' : '¿Qué horario tienes?'}</Text>
          <Reloj etiqueta={r.ocupacion === 'estudio' ? 'Entro a clase a las' : 'Entro a las'} valor={r.entrada} onCambio={v => set({ entrada: v })} />
          <Reloj etiqueta="Salgo a las" valor={r.salida} onCambio={v => set({ salida: v })} />
          <Dias valor={r.dias} onCambio={d => set({ dias: d })} />
          <Text style={s.nota}><Text style={s.notaB}>{fq(horasJornada(r))} horas</Text>, {r.dias.filter(Boolean).length} días a la semana.</Text>
        </>)}

        {pantalla === 'transporte' && (<>
          <Text style={s.titulo}>¿Cómo llegas y cuánto te demoras?</Text>
          <Cuadros<Transporte> valor={r.transporte} onCambio={v => set({ transporte: v })} opciones={TRANSPORTES.map(([id, l]) => [id, l])} />
          {r.transporte !== 'casa' && (<>
            <Text style={u.label}>Tiempo de ida y vuelta, sumando los dos</Text>
            <Minutos valor={r.trayectoMin} onCambio={m => set({ trayectoMin: m })} opciones={[10, 15, 30, 45, 60, 90, 120, 180]} />
          </>)}
        </>)}

        {pantalla === 'estudio' && (<>
          <Text style={s.titulo}>¿Cuánto estudias?</Text>
          <Text style={u.label}>Horas de estudio al día (clases y tareas)</Text>
          <Chips<string> valor={String(r.estudioHoras)} onCambio={v => set({ estudioHoras: Number(v) })} opciones={[['2', '2 h'], ['3', '3 h'], ['4', '4 h'], ['6', '6 h']]} />
          <Text style={u.label}>Días a la semana</Text>
          <Chips<string> valor={String(r.estudioDias)} onCambio={v => set({ estudioDias: Number(v) })} opciones={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]} />
        </>)}

        {pantalla === 'extra' && (<>
          <Text style={s.titulo}>{r.ocupacion === 'hogar' || r.ocupacion === 'ninguna' ? '¿Haces algún trabajo o negocio aparte?' : '¿Tienes otro trabajo, negocio o proyecto aparte?'}</Text>
          {!r.extra && <Text style={u.soft}>Por ejemplo, un emprendimiento en la noche, clases los sábados o programar desde la casa.</Text>}
          <Segmento<string> opciones={[['no', 'No'], ['si', 'Sí']]} valor={r.extra ? 'si' : 'no'}
            onCambio={v => set({ extra: v === 'si' ? (r.extra ?? EXTRA_INICIAL) : null })} />
          {r.extra && (<>
            <Buscador items={OFICIOS} valor={r.extra.oficio} otroTexto={r.extra.otro} visibles={6} placeholder="¿Qué haces? Ej. programar, vender por internet"
              onEscoger={id => setExtra({ oficio: id })}
              onOtro={t => setExtra({ oficio: 'otro', otro: t, met: undefined, reconocido: undefined })} />
            {r.extra.reconocido && <Text style={s.nota}>Kalo lo reconoce como <Text style={s.notaB}>{r.extra.reconocido}</Text>.</Text>}
          </>)}
        </>)}

        {pantalla === 'extraHorario' && r.extra && (<>
          <Text style={s.titulo}>¿En qué horario lo haces?</Text>
          <Reloj etiqueta="Empiezo a las" valor={r.extra.entrada} onCambio={v => setExtra({ entrada: v })} />
          <Reloj etiqueta="Termino a las" valor={r.extra.salida} onCambio={v => setExtra({ salida: v })} />
          <Dias valor={r.extra.dias} onCambio={d => setExtra({ dias: d })} />
          <Text style={s.nota}><Text style={s.notaB}>{fq(horasEntre(r.extra.entrada, r.extra.salida))} horas</Text>, {r.extra.dias.filter(Boolean).length} días a la semana.</Text>
        </>)}

        {pantalla === 'resto' && (<>
          <Text style={s.titulo}>El resto del tiempo en casa, ¿cómo lo pasas?</Text>
          <Text style={u.soft}>Lo que queda del día, sin contar el trabajo, el oficio ni el ejercicio.</Text>
          <Opciones<Resto> valor={r.resto} onCambio={v => set({ resto: v })} opciones={RESTO.map(([id, l, ej]) => [id, l, ej])} />
        </>)}

        {pantalla === 'casa' && (<>
          <Text style={s.titulo}>¿Y en la casa?</Text>
          <Text style={u.soft}>Cocinar, lavar, barrer, planchar, hacer mercado.</Text>
          <Opciones<Casa> valor={r.casa} onCambio={v => set({ casa: v })} opciones={CASA.map(([id, l]) => [id, l])} />
          <Text style={u.label}>¿Cuidas niños pequeños?</Text>
          <Segmento<string> opciones={[['no', 'No'], ['si', 'Sí']]} valor={r.ninos ? 'si' : 'no'} onCambio={v => set({ ninos: v === 'si' })} />
        </>)}

        {pantalla === 'ejercicio' && nuevo && (<>
          <Text style={s.titulo}>Agregar una actividad</Text>
          <Buscador items={EJERCICIOS.filter(x => x.id !== 'otro').map(x => ({ id: x.id, nombre: x.nombre, ej: '' }))} visibles={4}
            valor={nuevo.tipo} otroTexto={nuevo.nombre ?? ''} placeholder="Busca: correr, pesas, cuerda, fútbol…"
            onEscoger={id => setNuevo({ ...nuevo, tipo: id, nombre: undefined })} onOtro={t => setNuevo({ ...nuevo, tipo: 'otro', nombre: t })} />
          <Text style={u.label}>Intensidad</Text>
          <Segmento<Intensidad> valor={nuevo.intensidad} onCambio={v => setNuevo({ ...nuevo, intensidad: v })}
            opciones={[['suave', 'Suave', 'puedes cantar'], ['moderada', 'Moderada', 'hablas, no cantas'], ['fuerte', 'Fuerte', 'casi sin aire']]} />
          <Text style={u.label}>Cuánto dura cada vez</Text>
          <Minutos valor={nuevo.minutos} onCambio={m => setNuevo({ ...nuevo, minutos: m })} opciones={[15, 30, 45, 60, 90, 120]} />
          <Text style={u.label}>Días a la semana</Text>
          <Chips<string> valor={String(nuevo.dias)} onCambio={v => setNuevo({ ...nuevo, dias: Number(v) })}
            opciones={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7']]} />
        </>)}

        {pantalla === 'ejercicio' && !nuevo && (<>
          <Text style={s.titulo}>¿Haces ejercicio?</Text>
          <Text style={u.soft}>Agrega cada actividad que hagas en la semana. Si no haces, sigue sin agregar nada.</Text>
          {r.ejercicios.map((e, k) => (
            <View key={k} style={[u.card, { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.opcionTxt}>{e.tipo === 'otro' && e.nombre ? e.nombre : EJERCICIOS.find(x => x.id === e.tipo)?.nombre}</Text>
                <Text style={s.opcionSub}>{e.intensidad} · {e.minutos} min · {e.dias} {e.dias === 1 ? 'día' : 'días'} a la semana</Text>
                {e.reconocido && <Text style={s.opcionSub}>Kalo lo reconoce como {e.reconocido}</Text>}
              </View>
              <Pressable onPress={() => set({ ejercicios: r.ejercicios.filter((_, j) => j !== k) })} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>
          ))}
          <Boton texto={r.ejercicios.length ? '+ Agregar otra actividad' : '+ Agregar una actividad'} tipo="borde"
            onPress={() => setNuevo({ tipo: 'caminar', intensidad: 'moderada', minutos: 30, dias: 3 })} />
        </>)}

        {pantalla === 'resultado' && <Resultado basal={gasto(perfil).basal} viejo={base ? null : gasto(perfil).total} r={r} />}

      </ScrollView>

      {/* Botones fijos abajo: siempre a la vista */}
      <View style={s.pie}>
        {error && <Text style={u.error}>{error}</Text>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {nuevo ? (<>
            <View style={{ flex: 1 }}><Boton texto="Cancelar" tipo="borde" onPress={() => { setNuevo(null); setError(null); }} /></View>
            <View style={{ flex: 2 }}><Boton texto="Agregar" onPress={agregarEjercicio} cargando={revisando} /></View>
          </>) : (<>
            <View style={{ flex: 1 }}><Boton texto={pantalla === 'resultado' && !onListo ? 'Volver a empezar' : 'Atrás'} tipo="borde"
              onPress={() => (pantalla === 'resultado' && !onListo ? (setI(0), setR(RUTINA_INICIAL)) : atras())} /></View>
            {pantalla !== 'resultado' && (
              <View style={{ flex: 2 }}><Boton texto={pantalla === 'ejercicio' ? (r.ejercicios.length ? 'Ver mi resultado' : 'No hago ejercicio') : 'Continuar'} onPress={siguiente} cargando={revisando} /></View>
            )}
            {pantalla === 'resultado' && onListo && (
              <View style={{ flex: 2 }}><Boton texto={textoListo} onPress={listo} cargando={guardando} /></View>
            )}
          </>)}
        </View>
      </View>
    </View>
  );
}

const COLORES: Record<string, string> = { sueno: '#6E6C68', jornada: C.accent, extra: '#B85A35', estudio: '#F3B193', transporte: C.carbs, casa: C.fat, ejercicio: C.success, resto: '#3A3A3E' };

// Resultado del gasto: se usa al final del cuestionario y en la pestaña Gasto
export function Resultado({ basal, viejo = null, r, titulo = 'Tu cuerpo gasta al día' }: { basal: number; viejo?: number | null; r: Rutina; titulo?: string }) {
  const g = gastoPorRutina(basal, r);
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.titulo}>{titulo}</Text>
      <View style={{ backgroundColor: C.accent, borderRadius: 22, padding: 18, gap: 2 }}>
        <Text style={{ color: C.onAccent, fontSize: 48, fontWeight: '700', letterSpacing: -1.4 }}>{fmt(g.total)} kcal</Text>
        <Text style={{ color: C.onAccent, fontSize: 14 }}>Promedio de la semana, sumando días de trabajo y días libres.</Text>
      </View>
      <View style={[u.card, { gap: 4 }]}>
        <Text style={u.label}>Incluye tu metabolismo basal</Text>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '700' }}>{fmt(basal)} kcal</Text>
        <Text style={{ color: C.muted, fontSize: 13, lineHeight: 19 }}>
          Es lo que gasta tu cuerpo en reposo total, solo para mantenerte vivo. Las otras {fmt(g.total - basal)} kcal son lo que suman tus actividades del día.
        </Text>
      </View>
      {g.sobran > 0 && <Text style={u.error}>Tus actividades suman {fq(g.sobran)} horas más que el día. Revisa el horario, el trayecto o el ejercicio.</Text>}
      <View style={[u.card, { gap: 12 }]}>
        <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' }}>
          {g.partes.map(p => <View key={p.clave} style={{ flex: p.kcal, backgroundColor: COLORES[p.clave] }} />)}
        </View>
        {g.partes.map(p => (
          <View key={p.clave} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORES[p.clave] }} />
            <Text style={{ flex: 1, color: C.text, fontSize: 14 }}>{p.nombre}</Text>
            <Text style={{ color: C.muted, fontSize: 13, width: 70, textAlign: 'right' }}>{fq(p.horas)} h/día</Text>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', width: 76, textAlign: 'right' }}>{fmt(p.kcal)} kcal</Text>
          </View>
        ))}
      </View>
      {viejo !== null && (<>
        <View style={[u.card, { gap: 4 }]}>
          <Text style={u.label}>Con el cálculo de ahora («De pie», 6.000 pasos, 20 min de ejercicio)</Text>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: '700' }}>{fmt(viejo)} kcal</Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>Diferencia: {fmt(Math.abs(g.total - viejo))} kcal al día.</Text>
        </View>
        <Text style={[u.soft, { fontSize: 13 }]}>Esto es un simulacro: no se guarda nada.</Text>
      </>)}
    </View>
  );
}

const s = StyleSheet.create({
  cont: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  titulo: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, color: C.text, lineHeight: 29 },
  pie: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: C.divider, backgroundColor: C.bg, width: '100%', maxWidth: 520, alignSelf: 'center' },
  cuadros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cuadro: { width: '48.5%', minHeight: 52, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.surface, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  cuadroOn: { borderColor: C.accent, backgroundColor: '#2A1C16' },
  cuadroTxt: { fontSize: 14, fontWeight: '600', color: C.text },
  cuadroSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  verMas: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  verMasTxt: { fontSize: 13, fontWeight: '600', color: C.accent },
  buscar: { backgroundColor: C.surface2, borderRadius: 14, minHeight: 46, paddingHorizontal: 14, color: C.text, fontSize: 16, outlineWidth: 0 },
  barra: { height: 4, backgroundColor: C.surface3, marginHorizontal: 18, borderRadius: 2, marginTop: 8 },
  barraFill: { height: 4, backgroundColor: C.accent, borderRadius: 2 },
  paso: { fontSize: 13, color: C.muted },
  hora: { flex: 1, textAlign: 'center', fontSize: 26, fontWeight: '700', color: C.text, letterSpacing: -0.5 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.surface, paddingHorizontal: 14, paddingVertical: 10, minHeight: 50 },
  opcionTxt: { fontSize: 16, fontWeight: '600', color: C.text },
  opcionSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#4A4A4E' },
  min: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  minTxt: { fontSize: 14, fontWeight: '600' },
  dia: { flex: 1, aspectRatio: 1, maxWidth: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  diaTxt: { fontSize: 15, fontWeight: '700' },
  nota: { fontSize: 15, color: C.soft },
  notaB: { color: C.text, fontWeight: '700' },
});
