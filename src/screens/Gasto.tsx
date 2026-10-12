import { Text, View } from 'react-native';
import { Boton, u } from '../components/ui';
import { useSesion } from '../data/sesion';
import { fmt, gasto } from '../logic/energia';
import { C } from '../theme';
import { Resultado } from './TuDia';
import { TarjetaGastoReal } from '../components/GastoReal';

// Pestaña Gasto: lo que gasta el cuerpo del perfil activo según «Tu día», y la meta de calorías
export function Gasto({ cambiarDia }: { cambiarDia: () => void }) {
  const { activo } = useSesion();
  if (!activo) return null;
  const en = gasto(activo);

  if (!activo.rutina) {
    return (
      <View style={{ gap: 14, paddingTop: 4 }}>
        <Text style={u.h1}>Gasto</Text>
        <TarjetaGastoReal />
        <View style={[u.card, { gap: 10 }]}>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>Cuéntale a Kalo cómo es tu día</Text>
          <Text style={u.soft}>Con tu horario, tu trabajo, cómo te mueves y el ejercicio que haces, Kalo calcula cuánto gasta tu cuerpo hora por hora. Son unas preguntas rápidas.</Text>
          <Boton texto="Completar «Tu día»" onPress={cambiarDia} />
        </View>
        <Text style={[u.soft, { fontSize: 13 }]}>Mientras tanto, tu gasto aproximado es de {fmt(en.total)} kcal al día.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14, paddingTop: 4 }}>
      <TarjetaGastoReal />
      <Resultado basal={en.basal} r={activo.rutina} titulo={en.real ? `Lo que calcula la fórmula para ${activo.nombre}` : `Lo que gasta ${activo.nombre}`} />
      <View style={{ backgroundColor: C.accent, borderRadius: 22, padding: 18, gap: 2 }}>
        <Text style={{ color: C.onAccent, fontSize: 13 }}>Para tu meta, come al día</Text>
        <Text style={{ color: C.onAccent, fontSize: 34, fontWeight: '700', letterSpacing: -1 }}>{fmt(en.objetivo)} kcal</Text>
        <Text style={{ color: C.onAccent, fontSize: 13 }}>
          {en.ajuste === 0 ? 'Para mantener tu peso.' : en.ajuste < 0 ? `${fmt(-en.ajuste)} kcal menos de lo que gastas, para bajar.` : `${fmt(en.ajuste)} kcal más de lo que gastas, para subir.`}
          {en.real ? ` Con tu gasto real (${fmt(en.total)} kcal).` : ''}
        </Text>
      </View>
      <Boton texto="Cambiar mi día" tipo="borde" onPress={cambiarDia} />
    </View>
  );
}
