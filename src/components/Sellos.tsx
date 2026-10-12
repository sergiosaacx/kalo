import { StyleSheet, Text, View } from 'react-native';
import type { AlimentoDB } from '../data/alimentos';
import { SELLO_TXT, advertencia, sellos } from '../logic/salud';
import { C } from '../theme';

// Sellos negros de advertencia (criterios de la Resolución 2492 de 2022). mini: en el buscador.
export function Sellos({ a, mini }: { a: AlimentoDB; mini?: boolean }) {
  const lista = sellos(a);
  if (!lista.length) return null;
  return (
    <View style={s.fila}>
      {lista.map(x => (
        <View key={x} style={[s.sello, mini && s.mini]}>
          <Text style={[s.txt, mini && s.txtMini]}>{mini ? SELLO_TXT[x][1] : SELLO_TXT[x][0]}</Text>
        </View>
      ))}
    </View>
  );
}

// Advertencia en rojo para lo que tiene evidencia fuerte de daño (gaseosas, alcohol, embutidos, mucho sodio)
export function Advertencia({ a }: { a: AlimentoDB }) {
  const adv = advertencia(a);
  if (!adv) return null;
  return (
    <View style={s.adv}>
      <Text style={s.advTit}>{adv.titulo}</Text>
      <Text style={s.advTxt}>{adv.texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sello: { backgroundColor: '#000', borderWidth: 2, borderColor: '#fff', borderRadius: 10, paddingVertical: 5, paddingHorizontal: 9, maxWidth: 160 },
  mini: { borderWidth: 1.5, borderRadius: 6, paddingVertical: 1, paddingHorizontal: 5 },
  txt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' },
  txtMini: { fontSize: 9 },
  adv: { backgroundColor: '#2A1414', borderWidth: 1, borderColor: '#E5534B', borderRadius: 16, paddingVertical: 11, paddingHorizontal: 13, gap: 3 },
  advTit: { color: '#FF8A84', fontSize: 14.5, fontWeight: '700' },
  advTxt: { color: C.soft, fontSize: 12.5, lineHeight: 18 },
});
