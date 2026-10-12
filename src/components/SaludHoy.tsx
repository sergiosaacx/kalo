import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { u } from './ui';
import { IconoCampana } from './Iconos';
import { type Aviso, type Dia, type Limites } from '../logic/salud';
import type { Notificacion } from '../data/comidas';
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

// Campanita junto a la foto: el número es lo que necesita atención (avisos de salud + preguntas sin responder)
export function Campanita({ cuantos, rojo, abierta, tocar }: { cuantos: number; rojo: boolean; abierta: boolean; tocar: () => void }) {
  return (
    <Pressable onPress={tocar} style={[s.campana, abierta && { backgroundColor: C.surface3 }]} accessibilityLabel="Notificaciones" hitSlop={4}>
      <IconoCampana color={cuantos ? C.text : C.muted} size={22} />
      {cuantos > 0 && <View style={[s.badge, { backgroundColor: rojo ? ROJO : C.fat }]}><Text style={s.badgeTxt}>{cuantos}</Text></View>}
    </Pressable>
  );
}

const PREGUNTA: Record<string, string> = {
  des: '¿Ya desayunaste?', media: '¿Ya comiste algo a media mañana?', alm: '¿Ya almorzaste?', snack: '¿Ya comiste tu snack?', cena: '¿Ya cenaste?', peso: 'Hoy toca pesarte',
};
const ESTADO: Record<string, string> = { enviado: 'Sin responder', respondido: 'Respondida', pospuesto: 'Te la recuerda en 30 min' };

// Desplegable flotante bajo la campanita, como el centro de notificaciones de cualquier app
export function Desplegable({ avisos, notifs }: { avisos: Aviso[]; notifs: Notificacion[] }) {
  const nada = avisos.length === 0 && notifs.length === 0;
  return (
    <View style={s.desp}>
      <View style={s.pico} />
      <Text style={s.panelTit}>Notificaciones</Text>
      {nada && <Text style={s.nota}>No tienes notificaciones hoy. Vas bien con el azúcar, el sodio y la grasa saturada.</Text>}
      {avisos.map((a, k) => (
        <View key={`a${k}`} style={[s.aviso, k > 0 && s.borde]}>
          <View style={[s.punto, { backgroundColor: a.nivel === 'pasado' ? ROJO : C.fat }]} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[s.avisoTit, { color: a.nivel === 'pasado' ? '#FF8A84' : C.fat }]}>{a.titulo}</Text>
            <Text style={s.avisoTxt}>{a.texto}</Text>
          </View>
        </View>
      ))}
      {notifs.map((n, k) => {
        const agua = n.momento.startsWith('agua');
        const pend = n.estado === 'enviado' && !agua;
        return (
          <View key={`n${k}`} style={[s.aviso, (avisos.length > 0 || k > 0) && s.borde]}>
            <View style={[s.punto, { backgroundColor: pend ? C.accent : C.surface3 }]} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[s.avisoTit, { color: pend ? C.text : C.soft }]}>{agua ? '¿Ya tomaste agua?' : PREGUNTA[n.momento] ?? 'Kalo'}</Text>
              <Text style={s.avisoTxt}>{n.hora}{agua ? '' : ` · ${ESTADO[n.estado] ?? ''}`}</Text>
            </View>
          </View>
        );
      })}
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
  desp: { position: 'absolute', top: 54, right: 0, width: 330, maxWidth: '100%', backgroundColor: C.surface2, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, gap: 6, zIndex: 30,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  pico: { position: 'absolute', top: -7, right: 62, width: 14, height: 14, backgroundColor: C.surface2, borderLeftWidth: 1, borderTopWidth: 1, borderColor: C.border, transform: [{ rotate: '45deg' }] },
  borde: { borderTopWidth: 1, borderTopColor: C.divider },
  panelTit: { fontSize: 15, fontWeight: '700', color: C.text },
  aviso: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  punto: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  avisoTit: { fontSize: 14, fontWeight: '700' },
  avisoTxt: { fontSize: 12.5, color: C.soft, lineHeight: 18 },
});
