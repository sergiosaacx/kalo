// Piezas que se repiten en varias pantallas de Kalo (handoff › tokens y componentes)
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { C } from '../theme';

export function Boton({ texto, onPress, tipo = 'principal', cargando, desactivado }: {
  texto: string; onPress: () => void; tipo?: 'principal' | 'borde' | 'texto'; cargando?: boolean; desactivado?: boolean;
}) {
  const off = desactivado || cargando;
  return (
    <Pressable onPress={off ? undefined : onPress}
      style={[u.boton, tipo === 'principal' && { backgroundColor: C.accent }, tipo === 'borde' && { borderWidth: 1, borderColor: C.border }, off && { opacity: 0.45 }]}>
      {cargando ? <ActivityIndicator color={tipo === 'principal' ? C.onAccent : C.text} />
        : <Text style={[u.botonTxt, { color: tipo === 'principal' ? C.onAccent : tipo === 'texto' ? C.accent : C.text }]}>{texto}</Text>}
    </Pressable>
  );
}

// Segmentado (Hoy | Semana…) o chips de selección
export function Segmento<T extends string>({ opciones, valor, onCambio }: { opciones: [T, string, string?][]; valor: T; onCambio: (v: T) => void }) {
  return (
    <View style={u.segment}>
      {opciones.map(([id, l, sub]) => {
        const on = id === valor;
        return (
          <Pressable key={id} onPress={() => onCambio(id)} style={[u.segBtn, on && { backgroundColor: C.accent }]}>
            <Text style={[u.segTxt, { color: on ? C.onAccent : C.text }]}>{l}</Text>
            {sub ? <Text style={[u.segSub, { color: on ? C.onAccent : C.muted }]}>{sub}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips<T extends string>({ opciones, valor, onCambio }: { opciones: [T, string][]; valor: T; onCambio: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {opciones.map(([id, l]) => {
        const on = id === valor;
        return (
          <Pressable key={id} onPress={() => onCambio(id)} style={[u.chip, on && { backgroundColor: C.accent, borderColor: C.accent }]}>
            <Text style={[u.chipTxt, { color: on ? C.onAccent : C.text }]}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ etiqueta, valor, unidad, menos, mas }: { etiqueta: string; valor: string; unidad: string; menos: () => void; mas: () => void }) {
  return (
    <View style={u.stepRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={u.label}>{etiqueta}</Text>
        <Text style={u.stepVal}>{valor} <Text style={u.unidad}>{unidad}</Text></Text>
      </View>
      <Pressable onPress={menos} style={u.stepBtn}><Text style={u.stepTxt}>−</Text></Pressable>
      <Pressable onPress={mas} style={u.stepBtn}><Text style={u.stepTxt}>+</Text></Pressable>
    </View>
  );
}

export function Campo({ etiqueta, unidad, ...props }: TextInputProps & { etiqueta: string; unidad?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={u.label}>{etiqueta}</Text>
      <View style={u.inputWrap}>
        <TextInput placeholderTextColor={C.muted} style={u.input} {...props} />
        {unidad ? <Text style={u.unidad}>{unidad}</Text> : null}
      </View>
    </View>
  );
}

// Fecha de nacimiento en tres campos (día, mes, año). No se muestra la edad.
export function FechaNacimiento({ valor, onCambio }: {
  valor: { dia: string; mes: string; anio: string }; onCambio: (v: { dia: string; mes: string; anio: string }) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={u.label}>Fecha de nacimiento</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([['dia', 'Día', 'DD', 2, 1], ['mes', 'Mes', 'MM', 2, 1], ['anio', 'Año', 'AAAA', 4, 1.6]] as const).map(([k, l, ph, max, flex]) => (
          <View key={k} style={{ flex }}>
            <View style={u.inputWrap}>
              <TextInput value={valor[k]} onChangeText={t => onCambio({ ...valor, [k]: t.replace(/\D/g, '').slice(0, max) })}
                placeholder={ph} placeholderTextColor={C.muted} keyboardType="number-pad" maxLength={max} style={u.input} accessibilityLabel={l} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export const u = StyleSheet.create({
  boton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  botonTxt: { fontSize: 16, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  segTxt: { fontSize: 14, fontWeight: '600' },
  segSub: { fontSize: 11, marginTop: 1 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  chipTxt: { fontSize: 13, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  stepVal: { fontSize: 20, fontWeight: '700', color: C.text },
  stepBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: C.text, fontSize: 20, fontWeight: '600' },
  label: { fontSize: 13, color: C.muted },
  unidad: { fontSize: 14, color: C.muted, fontWeight: '400' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: 14, paddingHorizontal: 16, gap: 8 },
  // outlineWidth 0: en la web el navegador pinta un borde blanco al escribir
  input: { flex: 1, minHeight: 50, color: C.text, fontSize: 16, minWidth: 0, outlineWidth: 0 },
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 18 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.56, color: C.text },
  soft: { fontSize: 15, color: C.soft, lineHeight: 22 },
  error: { fontSize: 14, color: C.accentLight, lineHeight: 20 },
});
