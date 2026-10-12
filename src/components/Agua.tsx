import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { u } from './ui';
import { VASO, litros, metaAgua, useAgua } from '../data/agua';
import { useSesion } from '../data/sesion';
import { C } from '../theme';

const AGUA = C.carbs; // azul de Kalo

// Tarjeta del agua en Hoy: cada toque suma un vaso; tocar un vaso lleno lo quita
export function TarjetaAgua({ fecha, editable }: { fecha: string; editable: boolean }) {
  const { activo, actualizarPerfil } = useSesion();
  const p = activo!;
  const { ml, sumar } = useAgua(p.id, fecha);
  const [otra, setOtra] = useState(false);
  const [cantidad, setCantidad] = useState('300');
  const [meta, setMeta] = useState(false);
  const objetivo = metaAgua(p);
  const total = ml ?? 0;
  const vasos = Math.ceil(objetivo / VASO), llenos = Math.min(vasos, Math.floor(total / VASO));
  const faltan = Math.max(0, Math.ceil((objetivo - total) / VASO));
  const n = Number(cantidad.replace(',', '.'));

  return (
    <View style={[u.card, { gap: 10 }]}>
      <View style={s.entre}>
        <Text style={s.tit}>Agua</Text>
        <Pressable onPress={() => editable && setMeta(v => !v)} hitSlop={6}>
          <Text style={s.muted13}><Text style={{ color: AGUA, fontWeight: '700', fontSize: 15 }}>{litros(total)}</Text> de {litros(objetivo)} L</Text>
        </Pressable>
      </View>
      <View style={s.vasos}>
        {Array.from({ length: Math.max(vasos, llenos) }, (_, k) => (
          <Pressable key={k} disabled={!editable || k >= llenos} onPress={() => sumar(-VASO)} style={s.vaso}>
            {k < llenos && <View style={s.agua} />}
          </Pressable>
        ))}
      </View>
      {editable && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => sumar(VASO)} style={[s.btn, s.btnP]}><Text style={[s.btnTxt, { color: C.onAccent }]}>+ 1 vaso</Text></Pressable>
          <Pressable onPress={() => sumar(500)} style={s.btn}><Text style={s.btnTxt}>+ ½ litro</Text></Pressable>
          <Pressable onPress={() => setOtra(v => !v)} style={s.btn}><Text style={s.btnTxt}>Otra cantidad</Text></Pressable>
        </View>
      )}
      {otra && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput value={cantidad} onChangeText={t => setCantidad(t.replace(/[^0-9]/g, ''))} inputMode="numeric" keyboardType="number-pad" style={s.input} selectTextOnFocus />
          <Text style={s.muted13}>ml</Text>
          <Pressable disabled={!(n > 0 && n <= 3000)} onPress={() => { sumar(Math.round(n)); setOtra(false); }} style={[s.btn, s.btnP, { flex: 0, paddingHorizontal: 16 }, !(n > 0 && n <= 3000) && { opacity: 0.4 }]}>
            <Text style={[s.btnTxt, { color: C.onAccent }]}>Agregar</Text>
          </Pressable>
        </View>
      )}
      {meta && (
        <View style={[s.entre, { borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 10 }]}>
          <Text style={s.muted13}>Tu meta de agua</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => actualizarPerfil(p.id, { aguaMeta: Math.max(VASO * 4, objetivo - VASO) })} style={s.mini}><Text style={s.miniTxt}>−</Text></Pressable>
            <Text style={[s.tit, { fontSize: 15 }]}>{litros(objetivo)} L</Text>
            <Pressable onPress={() => actualizarPerfil(p.id, { aguaMeta: objetivo + VASO })} style={s.mini}><Text style={s.miniTxt}>+</Text></Pressable>
          </View>
        </View>
      )}
      <Text style={s.muted12}>{faltan > 0 ? `Te faltan ${faltan} ${faltan === 1 ? 'vaso' : 'vasos'}. Un vaso = 250 ml.` : 'Cumpliste tu meta de agua.'}{editable ? ' Toca los litros para cambiar la meta.' : ''}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  tit: { fontSize: 16, fontWeight: '700', color: C.text },
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12, color: C.muted },
  vasos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  vaso: { width: 26, height: 34, borderWidth: 2, borderColor: AGUA, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  agua: { height: '80%', backgroundColor: AGUA, opacity: 0.85 },
  btn: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  btnP: { backgroundColor: AGUA, borderColor: AGUA },
  btnTxt: { fontSize: 13.5, fontWeight: '700', color: C.text },
  input: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: C.surface2, color: C.text, fontSize: 16, paddingHorizontal: 12, outlineWidth: 0 } as object,
  mini: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  miniTxt: { color: C.text, fontSize: 16, fontWeight: '600' },
});
