import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Boton, u } from './ui';
import { activarNotificaciones, estadoNotif, marcarPreguntado, type EstadoNotif } from '../data/notificaciones';
import { C } from '../theme';

export const TEXTO_NOTIF = 'Así Kalo te puede mandar recordatorios y avisos a este celular. Puedes cambiarlo cuando quieras en Perfil.';

// Letrero al abrir Kalo en un celular que aún no ha respondido (p. ej. la misma cuenta en otro celular)
export function LetreroNotificaciones({ onCerrar }: { onCerrar: () => void }) {
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activar = async () => {
    setActivando(true);
    const r = await activarNotificaciones();
    setActivando(false);
    if (r.error) setError(r.error); else onCerrar();
  };
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={s.velo} />
      <View style={s.hoja}>
        <View style={s.agarre} />
        <Text style={[u.h1, { fontSize: 24 }]}>Activa las notificaciones</Text>
        <Text style={u.soft}>{TEXTO_NOTIF}</Text>
        {error && <Text style={u.error}>{error}</Text>}
        <Boton texto="Activar notificaciones" onPress={activar} cargando={activando} />
        <Boton texto="Ahora no" tipo="borde" onPress={() => { marcarPreguntado(); onCerrar(); }} />
      </View>
    </View>
  );
}

// Tarjeta en Perfil: el estado en este celular y, si falta, el botón para activarlas
export function NotificacionesPerfil() {
  const [estado, setEstado] = useState<EstadoNotif>(estadoNotif());
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activar = async () => {
    setActivando(true);
    const r = await activarNotificaciones();
    setActivando(false);
    setEstado(r.estado);
    setError(r.error);
  };
  const txt: Record<EstadoNotif, string> = {
    activadas: 'Activadas en este celular.',
    preguntar: 'Aún no las has activado en este celular.',
    bloqueadas: 'Las rechazaste en este celular. Para activarlas ve a Ajustes › Notificaciones › Kalo.',
    instalar: 'Para recibirlas en el iPhone abre Kalo desde la pantalla de inicio: en Safari toca Compartir › Agregar a inicio.',
    'no-soportado': 'Este navegador no permite notificaciones.',
  };
  return (
    <View style={[u.card, { gap: 12 }]}>
      <Text style={s.overline}>Notificaciones</Text>
      <Text style={[u.soft, estado === 'activadas' && { color: C.success }]}>{txt[estado]}</Text>
      {error && <Text style={u.error}>{error}</Text>}
      {estado === 'preguntar' && <Boton texto="Activar notificaciones" onPress={activar} cargando={activando} />}
    </View>
  );
}

const s = StyleSheet.create({
  overline: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.muted },
  velo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  hoja: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, paddingTop: 12, paddingBottom: 22, paddingHorizontal: 18, gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  agarre: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center' },
});
