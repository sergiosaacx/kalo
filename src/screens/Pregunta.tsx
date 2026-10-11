import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAlimentos } from '../data/alimentos';
import { bandeja } from '../data/bandeja';
import { MOMENTOS, horaTexto, horarioDe, responder, type Momento } from '../data/comidas';
import { useOpciones } from '../data/opciones';
import { useSesion } from '../data/sesion';
import { fmt } from '../logic/energia';
import { C } from '../theme';
import { Miniatura, itemsDe, kcalDe } from './Alimentos';

// «¿Ya desayunaste?»: la abre la notificación (o Kalo al abrirse si quedó sin responder)
export function Pregunta({ momento, fecha, onOpcion, onOtra, onCerrar }: {
  momento: Momento; fecha: string;
  onOpcion: () => void; onOtra: () => void; onCerrar: () => void;
}) {
  const { activo } = useSesion();
  const { lista } = useAlimentos();
  const { lista: opciones } = useOpciones();
  const [ocupado, setOcupado] = useState(false);
  const m = MOMENTOS[momento];
  const porId = useMemo(() => new Map((lista ?? []).map(a => [a.id, a])), [lista]);
  const hora = horarioDe(activo?.comidas).find(c => c.id === momento)?.hora;
  const mias = (opciones ?? []).filter(o => o.comida === m.comida && o.fuente !== 'kalo' && o.items.length > 0);

  const no = async (estado: 'pospuesto' | 'saltado') => {
    if (!activo) return;
    setOcupado(true);
    await responder(activo.id, fecha, momento, estado);
    onCerrar();
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={[s.muted13, { paddingTop: 10 }]}>{m.nombre}{hora ? ` · ${horaTexto(hora)}` : ''}{activo ? ` · ${activo.nombre}` : ''}</Text>
      <Text style={s.preg}>{m.pregunta}</Text>

      <Text style={s.sep}>Sí, comí…</Text>
      {!lista || !opciones ? <ActivityIndicator color={C.accent} /> : mias.map(o => {
        const its = itemsDe(o, porId);
        return (
          <Pressable key={o.id} onPress={() => { bandeja.agregarVarios(its, `${o.nombre} · ${its.length} ${its.length === 1 ? 'alimento' : 'alimentos'} en la bandeja`); onOpcion(); }} style={s.opt}>
            <View style={{ flexDirection: 'row' }}>
              {its.slice(0, 3).map((it, k) => <View key={k} style={[s.mini, k > 0 && { marginLeft: -9 }]}><Miniatura a={it.alimento} size={28} /></View>)}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.optTit} numberOfLines={1}>{o.nombre}</Text>
              <Text style={s.muted12}>Tu opción · {fmt(kcalDe(its))} kcal</Text>
            </View>
            <Text style={s.flecha}>›</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onOtra} style={s.opt}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.optTit}>{mias.length ? 'Otra cosa' : 'Sí, contarle qué comí'}</Text>
          <Text style={s.muted12}>Buscar alimentos u opciones de Kalo</Text>
        </View>
        <Text style={s.flecha}>›</Text>
      </Pressable>

      <Text style={s.sep}>No…</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => no('pospuesto')} disabled={ocupado} style={s.btnNo}><Text style={s.btnNoTxt}>Recuérdame en 30 min</Text></Pressable>
        <Pressable onPress={() => no('saltado')} disabled={ocupado} style={s.btnNo}><Text style={s.btnNoTxt}>{m.no}</Text></Pressable>
      </View>
      <Pressable onPress={onCerrar} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={s.muted13}>Cerrar</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12.5, color: C.muted },
  preg: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6, color: C.text, lineHeight: 34 },
  sep: { fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, paddingTop: 6, paddingHorizontal: 2 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 14, minHeight: 60 },
  optTit: { fontSize: 15.5, fontWeight: '700', color: C.text },
  flecha: { fontSize: 22, color: C.muted },
  mini: { borderRadius: 10, borderWidth: 2, borderColor: C.surface },
  btnNo: { flex: 1, minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  btnNoTxt: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
