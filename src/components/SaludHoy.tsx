import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { u } from './ui';
import { IconoCampana } from './Iconos';
import { type Aviso, type Dia, type Limites } from '../logic/salud';
import { C } from '../theme';

const ROJO = '#E5534B';
const f = (n: number) => Math.round(n).toLocaleString('es-CO');

// «Tu salud hoy»: lo que conviene poco contra su máximo y lo que conviene mucho contra su mínimo
export function TarjetaSalud({ d, l }: { d: Dia; l: Limites }) {
  const barra = (nombre: string, v: number, lim: number, unidad: string, tipo: 'max' | 'min') => {
    const pct = Math.min(1, v / lim);
    const color = tipo === 'min' ? C.success : v >= lim ? ROJO : v >= lim * 0.85 ? C.fat : C.accent;
    return (
      <View key={nombre} style={{ gap: 4 }}>
        <View style={s.entre}>
          <Text style={s.nombre}>{nombre}</Text>
          <Text style={[s.valor, tipo === 'max' && v >= lim * 0.85 && { color }]}>{f(v)} {tipo === 'max' ? '/' : 'de'} {f(lim)} {unidad}</Text>
        </View>
        <View style={s.track}><View style={[s.fill, { width: `${Math.max(2, pct * 100)}%`, backgroundColor: color }]} /></View>
      </View>
    );
  };
  return (
    <View style={[u.card, { gap: 11 }]}>
      <Text style={s.tit}>Tu salud hoy</Text>
      {barra('Sodio', d.sodio, l.sodio, 'mg', 'max')}
      {barra('Azúcar libre', d.azucar, l.azucar, 'g', 'max')}
      {barra('Grasa saturada', d.grasaSat, l.grasaSat, 'g', 'max')}
      {barra('Fibra', d.fibra, l.fibra, 'g', 'min')}
      {barra('Frutas y verduras', d.frutasVerduras, l.frutasVerduras, 'g', 'min')}
      <Text style={s.nota}>Límites de la OMS para tus calorías. El azúcar libre es la añadida (azúcar, panela, miel, jugos, dulces), no la de la fruta entera.</Text>
    </View>
  );
}

// Campanita junto a la foto: cuántos avisos hay hoy y, al tocarla, la lista
export function Campanita({ avisos, abierta, tocar }: { avisos: Aviso[]; abierta: boolean; tocar: () => void }) {
  const pasado = avisos.some(a => a.nivel === 'pasado');
  return (
    <Pressable onPress={tocar} style={[s.campana, abierta && { backgroundColor: C.surface3 }]} accessibilityLabel="Avisos de hoy" hitSlop={4}>
      <IconoCampana color={avisos.length ? C.text : C.muted} size={22} />
      {avisos.length > 0 && <View style={[s.badge, { backgroundColor: pasado ? ROJO : C.fat }]}><Text style={s.badgeTxt}>{avisos.length}</Text></View>}
    </Pressable>
  );
}

export function ListaAvisos({ avisos }: { avisos: Aviso[] }) {
  return (
    <View style={s.panel}>
      <Text style={s.panelTit}>Avisos de hoy</Text>
      {avisos.length === 0 ? <Text style={s.nota}>Todo en orden: no te has pasado de azúcar libre, sodio ni grasa saturada.</Text>
        : avisos.map((a, k) => (
          <View key={k} style={[s.aviso, k > 0 && { borderTopWidth: 1, borderTopColor: C.divider }]}>
            <View style={[s.punto, { backgroundColor: a.nivel === 'pasado' ? ROJO : C.fat }]} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[s.avisoTit, { color: a.nivel === 'pasado' ? '#FF8A84' : C.fat }]}>{a.titulo}</Text>
              <Text style={s.avisoTxt}>{a.texto}</Text>
            </View>
          </View>
        ))}
    </View>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  tit: { fontSize: 16, fontWeight: '700', color: C.text },
  nombre: { fontSize: 13.5, color: C.text },
  valor: { fontSize: 13.5, fontWeight: '700', color: C.text },
  track: { height: 7, borderRadius: 4, backgroundColor: C.surface3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  nota: { fontSize: 12, color: C.muted, lineHeight: 17 },
  campana: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.bg },
  badgeTxt: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  panel: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 14, gap: 8 },
  panelTit: { fontSize: 15, fontWeight: '700', color: C.text },
  aviso: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  punto: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  avisoTit: { fontSize: 14, fontWeight: '700' },
  avisoTxt: { fontSize: 12.5, color: C.soft, lineHeight: 18 },
});
