import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CATEGORIAS, MINERALES, VITAMINAS, fotoDe, nutrientes, sinTildes, useAlimentos, type AlimentoDB } from '../data/alimentos';
import { fmt } from '../logic/energia';
import { C } from '../theme';

const fq = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');

function Miniatura({ a, size }: { a: AlimentoDB; size: number }) {
  const uri = fotoDe(a);
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size > 50 ? 14 : 12, backgroundColor: C.surface2 }} />
    : <View style={{ width: size, height: size, borderRadius: size > 50 ? 14 : 12, backgroundColor: C.surface2 }} />;
}

export function Alimentos() {
  const { lista, error } = useAlimentos();
  const [query, setQuery] = useState('');
  const [abierto, setAbierto] = useState<AlimentoDB | null>(null);

  const resultados = useMemo(() => {
    if (!lista) return [];
    const q = sinTildes(query.trim());
    return q ? lista.filter(a => a.busqueda.includes(q)) : lista;
  }, [lista, query]);

  if (abierto) return <Ficha a={abierto} volver={() => setAbierto(null)} />;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2, paddingTop: 4 }}>
        <Text style={s.muted13}>{lista ? `${lista.length} alimentos` : 'Cargando…'}</Text>
        <Text style={s.h1}>Alimentos</Text>
      </View>
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
                <Text style={s.kcal}>{fmt(n.kcal)}</Text>
              </Pressable>
            );
          })}
          {resultados.length > 80 && <Text style={[s.muted12, { paddingTop: 10 }]}>Escribe para ver los demás ({resultados.length - 80} más).</Text>}
        </View>
      )}
    </View>
  );
}

function Ficha({ a, volver }: { a: AlimentoDB; volver: () => void }) {
  const [mult, setMult] = useState(1);
  const n = nutrientes(a, mult);
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
        <View style={s.rowEntre}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.hero50}>{fmt(n.kcal)}</Text>
            <Text style={s.muted13}>kcal · {fq(mult)} × {a.porcion_base.texto} ({fmt(n.g)} g)</Text>
          </View>
          <View style={s.stepper}>
            <Pressable onPress={() => setMult(m => Math.max(0.5, m - 0.5))} style={s.stepBtn}><Text style={s.stepTxt}>−</Text></Pressable>
            <Text style={[s.b15, { minWidth: 34, textAlign: 'center' }]}>{fq(mult)}</Text>
            <Pressable onPress={() => setMult(m => m + 0.5)} style={s.stepBtn}><Text style={s.stepTxt}>+</Text></Pressable>
          </View>
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
  input: { backgroundColor: C.surface2, borderRadius: 14, minHeight: 48, paddingHorizontal: 16, color: C.text, fontSize: 15 },
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
});
