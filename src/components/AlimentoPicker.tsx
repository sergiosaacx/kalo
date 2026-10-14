import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { coincide, nutrientes, sinTildes, useAlimentos, type AlimentoDB } from '../data/alimentos';
import { fmt } from '../logic/energia';
import { C } from '../theme';
import { Boton } from './ui';

// Buscar un alimento y escogerlo (para agregarlo a una comida o a una opción)
export function AlimentoPicker({ titulo, onElegir, onCerrar }: { titulo: string; onElegir: (a: AlimentoDB) => void; onCerrar: () => void }) {
  const { lista } = useAlimentos();
  const [q, setQ] = useState('');
  const res = useMemo(() => {
    if (!lista) return [];
    const t = sinTildes(q.trim());
    return (t ? lista.filter(a => coincide(a.busqueda, t)) : lista).slice(0, 40);
  }, [lista, q]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.fila}>
        <Text style={s.titulo}>{titulo}</Text>
        <Pressable onPress={onCerrar} style={s.cerrar}><Text style={{ color: C.accent, fontWeight: '600', fontSize: 15 }}>Cerrar</Text></Pressable>
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder="Busca: arroz, pollo, banano…" placeholderTextColor={C.muted} style={s.input} autoFocus autoCorrect={false} />
      <View style={s.card}>
        {res.map((a, i) => (
          <Pressable key={a.id} onPress={() => onElegir(a)} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: C.divider }]}>
            {a.foto_url ? <Image source={{ uri: a.foto_url }} style={s.thumb} /> : <View style={s.thumb} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.nombre} numberOfLines={1}>{a.nombre}</Text>
              <Text style={s.sub} numberOfLines={1}>{a.porcion_base.texto}</Text>
            </View>
            <Text style={s.kcal}>{fmt(nutrientes(a, 1).kcal)}</Text>
            <Text style={s.mas}>+</Text>
          </Pressable>
        ))}
        {lista && res.length === 0 && <Text style={[s.sub, { padding: 10 }]}>No encontramos «{q}».</Text>}
      </View>
      <Boton texto="Cerrar" tipo="borde" onPress={onCerrar} />
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  titulo: { fontSize: 22, fontWeight: '700', color: C.text, flex: 1 },
  cerrar: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
  input: { backgroundColor: C.surface2, borderRadius: 14, minHeight: 48, paddingHorizontal: 16, color: C.text, fontSize: 16, outlineWidth: 0 },
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface2 },
  nombre: { fontSize: 15, fontWeight: '600', color: C.text },
  sub: { fontSize: 12, color: C.muted },
  kcal: { fontSize: 14, fontWeight: '700', color: C.text },
  mas: { fontSize: 22, color: C.accent, width: 24, textAlign: 'center' },
});
