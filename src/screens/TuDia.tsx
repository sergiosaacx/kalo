import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Boton, Campo, Chips, Segmento, u } from '../components/ui';
import {
  CASA, EJERCICIOS, OFICIOS, RUTINA_INICIAL, TRABAJO_COMO, TRANSPORTES, gastoPorRutina, hora12, horasJornada, horasSueno,
  type Casa, type Ejercicio, type Intensidad, type Ocupacion, type Rutina, type Transporte,
} from '../logic/actividad';
import { fmt, gasto, type Sexo } from '../logic/energia';
import { C } from '../theme';

type Pantalla = 'datos' | 'sueno' | 'ocupacion' | 'oficio' | 'horario' | 'transporte' | 'estudio' | 'casa' | 'ejercicio' | 'resultado';
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const fq = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');

function secuencia(r: Rutina): Pantalla[] {
  const s: Pantalla[] = ['datos', 'sueno', 'ocupacion'];
  if (r.ocupacion === 'trabajo' || r.ocupacion === 'ambos') s.push('oficio');
  if (r.ocupacion === 'trabajo' || r.ocupacion === 'ambos' || r.ocupacion === 'estudio') s.push('horario', 'transporte');
  if (r.ocupacion === 'ambos') s.push('estudio');
  s.push('casa', 'ejercicio', 'resultado');
  return s;
}

// Reloj: la hora sube y baja de una en una; los minutos se escogen con un toque
function Reloj({ etiqueta, valor, onCambio }: { etiqueta: string; valor: number; onCambio: (m: number) => void }) {
  const h = Math.floor(valor / 60), m = valor % 60;
  const hora = (d: number) => onCambio((((h + d) % 24 + 24) % 24) * 60 + m);
  return (
    <View style={[u.card, { gap: 12 }]}>
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

export function TuDia({ onSalir }: { onSalir?: () => void }) {
  const [r, setR] = useState<Rutina>(RUTINA_INICIAL);
  const [datos, setDatos] = useState({ edad: '30', estatura: '165', peso: '65', sexo: 'F' as Sexo });
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<Ejercicio | null>(null);
  const set = (p: Partial<Rutina>) => setR(x => ({ ...x, ...p }));

  const pasos = secuencia(r);
  const pantalla = pasos[Math.min(i, pasos.length - 1)];
  const total = pasos.length - 1; // sin contar el resultado

  const edad = parseInt(datos.edad, 10), estatura = parseFloat(datos.estatura), peso = parseFloat(datos.peso.replace(',', '.'));
  const perfil = { id: '', nombre: '', edad, sexo: datos.sexo, estatura, peso, pesoInicial: peso, meta: 'mantener' as const, pesoMeta: peso, ritmo: 0.5, trabajo: 'pie' as const, pasos: 6000, ejercicio: 20, sueno: 7, color: '' };

  const validar = (): string | null => {
    if (pantalla === 'datos') {
      if (!(edad >= 10 && edad <= 100)) return 'La edad debe estar entre 10 y 100 años.';
      if (!(estatura >= 100 && estatura <= 230)) return 'La estatura va en centímetros, por ejemplo 165.';
      if (!(peso >= 30 && peso <= 250)) return 'El peso va en kilos, por ejemplo 65.';
    }
    if (pantalla === 'sueno' && (horasSueno(r) < 3 || horasSueno(r) > 14)) return 'Revisa las horas: así dormirías ' + fq(horasSueno(r)) + ' horas.';
    if (pantalla === 'oficio' && !r.oficio) return 'Escoge el trabajo que más se parezca al tuyo.';
    if (pantalla === 'oficio' && r.oficio === 'otro' && !r.oficioOtro.trim()) return 'Escribe en qué trabajas.';
    if (pantalla === 'horario' && !r.dias.some(Boolean)) return 'Toca al menos un día.';
    if (pantalla === 'horario' && horasJornada(r) < 1) return 'Revisa la hora de entrada y de salida.';
    return null;
  };
  const siguiente = () => { const e = validar(); setError(e); if (!e) setI(i + 1); };
  const atras = () => { setError(null); if (i === 0) onSalir?.(); else setI(i - 1); };

  return (
    <View style={{ flex: 1 }}>
      {pantalla !== 'resultado' && (
        <View style={s.barra}><View style={[s.barraFill, { width: `${((i + 1) / total) * 100}%` }]} /></View>
      )}
      <ScrollView key={pantalla} contentContainerStyle={s.cont} keyboardShouldPersistTaps="handled">
        {pantalla !== 'resultado' && <Text style={s.paso}>Pregunta {i + 1} de {total}</Text>}

        {pantalla === 'datos' && (<>
          <Text style={u.h1}>Primero, tus datos</Text>
          <Text style={u.soft}>Con esto sabemos cuánto gasta tu cuerpo en reposo.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Campo etiqueta="Edad" unidad="años" value={datos.edad} onChangeText={v => setDatos({ ...datos, edad: v })} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Campo etiqueta="Estatura" unidad="cm" value={datos.estatura} onChangeText={v => setDatos({ ...datos, estatura: v })} keyboardType="number-pad" /></View>
          </View>
          <Campo etiqueta="Peso" unidad="kg" value={datos.peso} onChangeText={v => setDatos({ ...datos, peso: v })} keyboardType="decimal-pad" />
          <View style={{ gap: 6 }}>
            <Text style={u.label}>Sexo biológico</Text>
            <Segmento<Sexo> opciones={[['F', 'Mujer'], ['M', 'Hombre']]} valor={datos.sexo} onCambio={v => setDatos({ ...datos, sexo: v })} />
          </View>
        </>)}

        {pantalla === 'sueno' && (<>
          <Text style={u.h1}>¿A qué hora te levantas y a qué hora te acuestas?</Text>
          <Text style={u.soft}>Piensa en un día normal entre semana.</Text>
          <Reloj etiqueta="Me levanto a las" valor={r.levanta} onCambio={v => set({ levanta: v })} />
          <Reloj etiqueta="Me acuesto a las" valor={r.acuesta} onCambio={v => set({ acuesta: v })} />
          <Text style={s.nota}>Duermes unas <Text style={s.notaB}>{fq(horasSueno(r))} horas</Text>.</Text>
        </>)}

        {pantalla === 'ocupacion' && (<>
          <Text style={u.h1}>¿Trabajas o estudias?</Text>
          <Opciones<Ocupacion> valor={r.ocupacion} onCambio={v => set({ ocupacion: v, casa: v === 'hogar' ? 'todo' : r.casa })} opciones={[
            ['trabajo', 'Trabajo'], ['estudio', 'Estudio'], ['ambos', 'Trabajo y estudio'],
            ['hogar', 'Me dedico al hogar'], ['ninguna', 'Pensionado o sin trabajo ahora'],
          ]} />
        </>)}

        {pantalla === 'oficio' && (<>
          <Text style={u.h1}>¿En qué trabajas?</Text>
          <Text style={u.soft}>Escoge el que más se parezca a lo que haces la mayor parte del tiempo.</Text>
          <Opciones<string> valor={r.oficio} onCambio={v => set({ oficio: v })}
            opciones={[...OFICIOS.map(o => [o.id, o.nombre, o.ej] as [string, string, string]), ['otro', 'Otro trabajo', 'No está en la lista: escríbelo']]} />
          {r.oficio === 'otro' && (
            <View style={[u.card, { gap: 12 }]}>
              <Campo etiqueta="¿En qué trabajas?" value={r.oficioOtro} onChangeText={v => set({ oficioOtro: v })} placeholder="Ej. fotógrafo, panadero, jardinero" autoFocus />
              <Text style={u.label}>¿Cómo es tu trabajo la mayor parte del tiempo?</Text>
              <Opciones<string> valor={r.oficioComo} onCambio={v => set({ oficioComo: v })} opciones={TRABAJO_COMO.map(([id, l, ej]) => [id, l, ej])} />
            </View>
          )}
        </>)}

        {pantalla === 'horario' && (<>
          <Text style={u.h1}>{r.ocupacion === 'estudio' ? '¿Qué horario de clases tienes?' : '¿Qué horario tienes?'}</Text>
          <Reloj etiqueta={r.ocupacion === 'estudio' ? 'Entro a clase a las' : 'Entro a las'} valor={r.entrada} onCambio={v => set({ entrada: v })} />
          <Reloj etiqueta="Salgo a las" valor={r.salida} onCambio={v => set({ salida: v })} />
          <View style={[u.card, { gap: 10 }]}>
            <Text style={u.label}>¿Qué días? Toca para marcar o quitar</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {DIAS.map((d, k) => (
                <Pressable key={k} onPress={() => set({ dias: r.dias.map((x, j) => (j === k ? !x : x)) })}
                  style={[s.dia, r.dias[k] && { backgroundColor: C.accent, borderColor: C.accent }]}>
                  <Text style={[s.diaTxt, { color: r.dias[k] ? C.onAccent : C.text }]}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Text style={s.nota}><Text style={s.notaB}>{fq(horasJornada(r))} horas</Text>, {r.dias.filter(Boolean).length} días a la semana.</Text>
        </>)}

        {pantalla === 'transporte' && (<>
          <Text style={u.h1}>¿Cómo llegas y cuánto te demoras?</Text>
          <Opciones<Transporte> valor={r.transporte} onCambio={v => set({ transporte: v })} opciones={TRANSPORTES.map(([id, l]) => [id, l])} />
          {r.transporte !== 'casa' && (<>
            <Text style={u.label}>Tiempo de ida y vuelta, sumando los dos</Text>
            <Minutos valor={r.trayectoMin} onCambio={m => set({ trayectoMin: m })} opciones={[10, 15, 30, 45, 60, 90, 120, 180]} />
          </>)}
        </>)}

        {pantalla === 'estudio' && (<>
          <Text style={u.h1}>¿Cuánto estudias?</Text>
          <Text style={u.label}>Horas de estudio al día (clases y tareas)</Text>
          <Chips<string> valor={String(r.estudioHoras)} onCambio={v => set({ estudioHoras: Number(v) })} opciones={[['2', '2 h'], ['3', '3 h'], ['4', '4 h'], ['6', '6 h']]} />
          <Text style={u.label}>Días a la semana</Text>
          <Chips<string> valor={String(r.estudioDias)} onCambio={v => set({ estudioDias: Number(v) })} opciones={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]} />
        </>)}

        {pantalla === 'casa' && (<>
          <Text style={u.h1}>¿Y en la casa?</Text>
          <Text style={u.soft}>Cocinar, lavar, barrer, planchar, hacer mercado.</Text>
          <Opciones<Casa> valor={r.casa} onCambio={v => set({ casa: v })} opciones={CASA.map(([id, l]) => [id, l])} />
          <Text style={u.label}>¿Cuidas niños pequeños?</Text>
          <Segmento<string> opciones={[['no', 'No'], ['si', 'Sí']]} valor={r.ninos ? 'si' : 'no'} onCambio={v => set({ ninos: v === 'si' })} />
        </>)}

        {pantalla === 'ejercicio' && (<>
          <Text style={u.h1}>¿Haces ejercicio?</Text>
          <Text style={u.soft}>Agrega cada actividad que hagas en la semana. Si no haces, sigue sin agregar nada.</Text>
          {r.ejercicios.map((e, k) => (
            <View key={k} style={[u.card, { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.opcionTxt}>{e.tipo === 'otro' && e.nombre ? e.nombre : EJERCICIOS.find(x => x.id === e.tipo)?.nombre}</Text>
                <Text style={s.opcionSub}>{e.intensidad} · {e.minutos} min · {e.dias} {e.dias === 1 ? 'día' : 'días'} a la semana</Text>
              </View>
              <Pressable onPress={() => set({ ejercicios: r.ejercicios.filter((_, j) => j !== k) })} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>
          ))}
          {nuevo ? (
            <View style={[u.card, { gap: 12 }]}>
              <Text style={u.label}>¿Qué haces?</Text>
              <Chips<string> valor={nuevo.tipo} onCambio={v => setNuevo({ ...nuevo, tipo: v })} opciones={EJERCICIOS.map(x => [x.id, x.nombre])} />
              {nuevo.tipo === 'otro' && (
                <Campo etiqueta="¿Cuál?" value={nuevo.nombre ?? ''} onChangeText={v => setNuevo({ ...nuevo, nombre: v })} placeholder="Ej. escalada, remo, ciclomontañismo" autoFocus />
              )}
              <Text style={u.label}>¿Con qué intensidad?</Text>
              <Opciones<Intensidad> valor={nuevo.intensidad} onCambio={v => setNuevo({ ...nuevo, intensidad: v })} opciones={[
                ['suave', 'Suave', 'Puedes ir cantando'], ['moderada', 'Moderada', 'Puedes hablar, pero no cantar'], ['fuerte', 'Fuerte', 'Casi no puedes hablar'],
              ]} />
              <Text style={u.label}>¿Cuánto dura cada vez?</Text>
              <Minutos valor={nuevo.minutos} onCambio={m => setNuevo({ ...nuevo, minutos: m })} opciones={[10, 15, 20, 30, 45, 60, 90, 120]} />
              <Text style={u.label}>¿Cuántos días a la semana?</Text>
              <Chips<string> valor={String(nuevo.dias)} onCambio={v => setNuevo({ ...nuevo, dias: Number(v) })}
                opciones={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7']]} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Boton texto="Cancelar" tipo="borde" onPress={() => setNuevo(null)} /></View>
                <View style={{ flex: 2 }}><Boton texto="Agregar" onPress={() => { set({ ejercicios: [...r.ejercicios, nuevo] }); setNuevo(null); }} /></View>
              </View>
            </View>
          ) : (
            <Boton texto={r.ejercicios.length ? '+ Agregar otra actividad' : '+ Agregar una actividad'} tipo="borde"
              onPress={() => setNuevo({ tipo: 'caminar', intensidad: 'moderada', minutos: 30, dias: 3 })} />
          )}
        </>)}

        {pantalla === 'resultado' && <Resultado basal={gasto(perfil).basal} viejo={gasto(perfil).total} r={r} />}

        {error && <Text style={u.error}>{error}</Text>}
        {!nuevo && (
          <View style={{ flexDirection: 'row', gap: 10, paddingTop: 6 }}>
            <View style={{ flex: 1 }}><Boton texto={pantalla === 'resultado' ? 'Volver a empezar' : 'Atrás'} tipo="borde"
              onPress={() => (pantalla === 'resultado' ? (setI(0), setR(RUTINA_INICIAL)) : atras())} /></View>
            {pantalla !== 'resultado' && (
              <View style={{ flex: 2 }}><Boton texto={pantalla === 'ejercicio' ? (r.ejercicios.length ? 'Ver mi resultado' : 'No hago ejercicio') : 'Continuar'} onPress={siguiente} /></View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const COLORES: Record<string, string> = { sueno: '#6E6C68', jornada: C.accent, estudio: '#F3B193', transporte: C.carbs, casa: C.fat, ejercicio: C.success, resto: '#3A3A3E' };

function Resultado({ basal, viejo, r }: { basal: number; viejo: number; r: Rutina }) {
  const g = gastoPorRutina(basal, r);
  return (
    <View style={{ gap: 14 }}>
      <Text style={u.h1}>Tu cuerpo gasta al día</Text>
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
      <View style={[u.card, { gap: 4 }]}>
        <Text style={u.label}>Con el cálculo de ahora («De pie», 6.000 pasos, 20 min de ejercicio)</Text>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '700' }}>{fmt(viejo)} kcal</Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>Diferencia: {fmt(Math.abs(g.total - viejo))} kcal al día.</Text>
      </View>
      <Text style={[u.soft, { fontSize: 13 }]}>Esto es un simulacro: no se guarda nada.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  cont: { padding: 18, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  barra: { height: 4, backgroundColor: C.surface3, marginHorizontal: 18, borderRadius: 2, marginTop: 8 },
  barraFill: { height: 4, backgroundColor: C.accent, borderRadius: 2 },
  paso: { fontSize: 13, color: C.muted },
  hora: { flex: 1, textAlign: 'center', fontSize: 30, fontWeight: '700', color: C.text, letterSpacing: -0.6 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.surface, paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
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
