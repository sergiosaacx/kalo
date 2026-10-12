import { Image, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

// Foto de perfil: la que subió, el avatar que escogió de Kalo, o su inicial sobre su color
export function Avatar({ p, size }: { p: { nombre: string; color: string; foto?: string | null }; size: number }) {
  if (p.foto) return <Image source={{ uri: p.foto }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surface2 }} />;
  return (
    <View style={[s.circ, { width: size, height: size, borderRadius: size / 2, backgroundColor: p.color }]}>
      <Text style={[s.txt, { fontSize: size * 0.4 }]}>{p.nombre.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  circ: { alignItems: 'center', justifyContent: 'center' },
  txt: { color: C.onAccent, fontWeight: '700' },
});
