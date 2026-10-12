import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAlimentos } from '../data/alimentos';
import { horaTexto } from '../data/comidas';
import { useOpciones } from '../data/opciones';
import { agregarVariosAlPlan, frecuenciaComidas, nombreComida, usePlanDia, type ComidaId } from '../data/plan';
import { useSesion } from '../data/sesion';
import { fmt, gasto, macrosObjetivo } from '../logic/energia';
import { armarBloques, porcionTexto, type Bloque, type Etiqueta, type Sugerencia } from '../logic/queComer';
import { nutrientes } from '../data/alimentos';
import { C } from '../theme';

// En esta hoja la comida «snack» se llama en singular, como en «Mis comidas»
const nombre = (c: ComidaId) => (c === 'snack' ? 'Snack' : nombreComida(c));

const ETIQUETA: Record<Etiqueta, { txt: string; color: string }> = {
  frecuente: { txt: 'Lo comes seguido', color: C.success },
  tuya: { txt: 'Tuya', color: C.accent },
  nuevo: { txt: 'Nuevo para ti', color: C.carbs },
};

// Hoja que abre el cuadro «Restante» de Hoy
export function QueComer({ cerrar, onAgregado }: { cerrar: () => void; onAgregado: () => void }) {
  const { activo } = useSesion();
  const { lista } = useAlimentos();
  const { lista: opciones } = useOpciones();
  const { items } = usePlanDia(activo?.id);
  const [frecuencia, setFrecuencia] = useState<Map<string, number> | null>(null);
  useEffect(() => { if (activo) frecuenciaComidas(activo.id).then(setFrecuencia); }, [activo?.id]);
  const porId = useMemo(() => new Map((lista ?? []).map(a => [a.id, a])), [lista]);

  const listo = activo && lista && opciones && items && frecuencia;
  const datos = useMemo(() => {
    if (!listo) return null;
    // Lo mismo que muestra Hoy: lo marcado como comido
    const comido = items.filter(i => i.comido && porId.has(i.alimento_id))
      .reduce((t, i) => { const n = nutrientes(porId.get(i.alimento_id)!, i.cantidad); return { k: t.k + n.kcal, p: t.p + n.p }; }, { k: 0, p: 0 });
    const objetivo = gasto(activo).objetivo;
    const restante = Math.round(objetivo - comido.k);
    const faltaProteina = Math.round(macrosObjetivo(activo, objetivo).proteina - comido.p);
    return { restante, faltaProteina, ...armarBloques({ p: activo, items, restante, faltaProteina, opciones, porId, frecuencia }) };
  }, [listo, items, opciones, frecuencia]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={s.velo} onPress={cerrar} />
      <View style={s.hoja}>
        <View style={s.agarre} />
        {!datos ? <ActivityIndicator color={C.accent} style={{ marginVertical: 40 }} /> : (
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 10, paddingRight: 6 }}>
            {datos.restante <= 0 ? (
              <View style={{ gap: 6, paddingVertical: 10 }}>
                <Text style={s.big}>Ya cubriste tus calorías de hoy</Text>
                <Text style={s.soft}>Comiste lo que te tocaba. No hace falta comer más.</Text>
              </View>
            ) : (
              <>
                <View>
                  <Text style={s.muted13}>{datos.todasHechas ? 'Ya hiciste todas tus comidas' : 'Para completar hoy'}</Text>
                  <Text style={s.big}>Te faltan {fmt(datos.restante)} kcal</Text>
                  {datos.faltaProteina > 5 && <Text style={s.muted12}>y {fmt(datos.faltaProteina)} g de proteína</Text>}
                </View>
                {datos.bloques.length > 1 && (
                  <View style={s.plan}>
                    {datos.bloques.map(b => (
                      <Text key={b.comida} style={s.planChip}>{nombre(b.comida)} <Text style={{ color: C.accent }}>{fmt(b.meta)}</Text></Text>
                    ))}
                  </View>
                )}
                {datos.bloques.map(b => (
                  <BloqueComida key={b.comida} b={b} cuantas={b.comida === 'snack' && datos.bloques.length > 1 ? 1 : 2}
                    agregar={async sg => {
                      const e = await agregarVariosAlPlan(activo!.id, b.comida, sg.items);
                      if (!e) onAgregado();
                      return e;
                    }} />
                ))}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function BloqueComida({ b, cuantas, agregar }: { b: Bloque; cuantas: number; agregar: (s: Sugerencia) => Promise<string | null> }) {
  const n = Math.min(cuantas, b.sugerencias.length);
  const [vistas, setVistas] = useState<number[]>(() => Array.from({ length: n }, (_, k) => k));
  const otra = (slot: number) => setVistas(v => {
    if (b.sugerencias.length <= v.length) return v;
    let sig = Math.max(...v);
    do { sig = (sig + 1) % b.sugerencias.length; } while (v.includes(sig));
    return v.map((x, k) => (k === slot ? sig : x));
  });
  return (
    <View style={{ gap: 8 }}>
      <View style={s.sec}>
        <Text style={s.secTit}>{b.hora ? `${nombre(b.comida)} · ${horaTexto(b.hora)}` : 'Un snack'}</Text>
        <Text style={s.muted12}>≈ {fmt(b.meta)} kcal</Text>
      </View>
      {n === 0 ? <Text style={s.muted12}>No hay opciones de {nombre(b.comida).toLowerCase()} todavía.</Text>
        : vistas.map((idx, slot) => <Tarjeta key={`${slot}-${idx}`} sg={b.sugerencias[idx]} otra={b.sugerencias.length > n ? () => otra(slot) : undefined} agregar={agregar} />)}
    </View>
  );
}

function Tarjeta({ sg, otra, agregar }: { sg: Sugerencia; otra?: () => void; agregar: (s: Sugerencia) => Promise<string | null> }) {
  const [estado, setEstado] = useState<'listo' | 'agregando' | 'agregado' | string>('listo');
  const et = ETIQUETA[sg.etiqueta];
  return (
    <View style={s.sug}>
      <View style={s.fila}>
        <Text style={s.sugTit} numberOfLines={2}>{sg.opcion.nombre}</Text>
        <Text style={s.kcal}>{fmt(sg.kcal)}</Text>
      </View>
      <Text style={s.muted12}>{porcionTexto(sg.factor)} · {fmt(sg.proteina)} g de proteína</Text>
      <View style={s.fila}>
        <Text style={[s.tag, { color: et.color, borderColor: et.color }]}>{et.txt}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {otra && estado !== 'agregado' && <Pressable onPress={otra} style={s.btnOtra} hitSlop={4}><Text style={s.btnOtraTxt}>↻</Text></Pressable>}
          <Pressable disabled={estado !== 'listo'} style={[s.btnAg, estado === 'agregado' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.success }]}
            onPress={async () => { setEstado('agregando'); const e = await agregar(sg); setEstado(e ? 'listo' : 'agregado'); }}>
            {estado === 'agregando' ? <ActivityIndicator color={C.onAccent} size="small" />
              : <Text style={[s.btnAgTxt, estado === 'agregado' && { color: C.success }]}>{estado === 'agregado' ? 'Agregado ✓' : 'Agregar'}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  velo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  hoja: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, paddingTop: 12, paddingHorizontal: 16, gap: 10, width: '100%', maxWidth: 520, alignSelf: 'center' },
  agarre: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center' },
  big: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: C.text, lineHeight: 32 },
  soft: { fontSize: 15, color: C.soft, lineHeight: 22 },
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12.5, color: C.muted },
  plan: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  planChip: { fontSize: 12.5, fontWeight: '600', color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10 },
  sec: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 4, paddingHorizontal: 2 },
  secTit: { fontSize: 15, fontWeight: '700', color: C.text },
  sug: { backgroundColor: C.surface2, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 12, gap: 6 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sugTit: { flex: 1, fontSize: 14.5, fontWeight: '700', color: C.text },
  kcal: { fontSize: 14, fontWeight: '700', color: C.text },
  tag: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden' },
  btnOtra: { minWidth: 36, height: 32, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  btnOtraTxt: { color: C.text, fontSize: 15, fontWeight: '700' },
  btnAg: { minWidth: 84, height: 32, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  btnAgTxt: { color: C.onAccent, fontSize: 13, fontWeight: '700' },
});
