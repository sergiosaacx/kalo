import { createElement, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Boton, u } from '../components/ui';
import { MOMENTOS, horaTexto, horarioDe, type ComidaHora } from '../data/comidas';
import { activarNotificaciones, estadoNotif } from '../data/notificaciones';
import { useSesion, type PerfilActivo } from '../data/sesion';
import { C } from '../theme';

export function Interruptor({ on, cambiar }: { on: boolean; cambiar: () => void }) {
  return (
    <Pressable onPress={cambiar} hitSlop={6} style={[s.sw, on && { backgroundColor: C.accent }]}>
      <View style={[s.swBola, on ? { left: 21, backgroundColor: C.onAccent } : null]} />
    </Pressable>
  );
}

// En el iPhone abre la rueda de horas nativa (la app es web instalada)
export function HoraInput({ valor, apagado, cambiar }: { valor: string; apagado: boolean; cambiar: (h: string) => void }) {
  if (Platform.OS !== 'web') return <Text style={s.hora}>{horaTexto(valor)}</Text>;
  return (
    <View style={[s.horaCaja, apagado && s.horaApagada]}>
      <Text style={[s.hora, apagado && { color: C.muted }]}>{horaTexto(valor)}</Text>
      {createElement('input', {
        type: 'time', value: valor, 'aria-label': 'Hora',
        onChange: (e: { target: { value: string } }) => e.target.value && cambiar(e.target.value),
        style: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', border: 0, cursor: 'pointer' },
      })}
    </View>
  );
}

// Tarjeta de acceso en Perfil
export function TarjetaComidas({ p, abrir }: { p: PerfilActivo; abrir: () => void }) {
  const on = horarioDe(p.comidas).filter(c => c.on);
  return (
    <Pressable onPress={abrir} style={[u.card, { gap: 6 }]}>
      <Text style={s.muted13}>Mis comidas</Text>
      <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>{on.length} {on.length === 1 ? 'comida' : 'comidas'} al día</Text>
      <Text style={s.muted13} numberOfLines={2}>{on.map(c => `${MOMENTOS[c.id].nombre} ${horaTexto(c.hora)}`).join(' · ')}</Text>
      <Text style={[s.muted13, { color: p.recordar ? C.success : C.muted }]}>{p.recordar ? 'Kalo te pregunta a cada hora' : 'Recordatorios apagados'}</Text>
      <Text style={[s.link, { fontSize: 14 }]}>Cambiar comidas y horas →</Text>
    </Pressable>
  );
}

export function MisComidas({ volver }: { volver: () => void }) {
  const { activo, actualizarPerfil } = useSesion();
  const p = activo!;
  const horario = horarioDe(p.comidas);
  const [notif, setNotif] = useState(estadoNotif());
  const [activando, setActivando] = useState(false);

  const guardar = (cambio: Partial<ComidaHora> & { id: ComidaHora['id'] }) =>
    actualizarPerfil(p.id, { comidas: horario.map(c => (c.id === cambio.id ? { ...c, ...cambio } : c)) });
  const total = horario.filter(c => c.on).length;

  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={volver} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>‹ Perfil</Text></Pressable>
      <View style={{ gap: 2, marginTop: -6 }}>
        <Text style={s.muted13}>{p.nombre}</Text>
        <Text style={u.h1}>Mis comidas</Text>
      </View>

      <View style={[u.card, { paddingVertical: 4 }]}>
        {horario.map((c, i) => (
          <View key={c.id} style={[s.fila, i > 0 && s.borde]}>
            <Interruptor on={c.on} cambiar={() => guardar({ id: c.id, on: !c.on })} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.nombre, !c.on && { color: C.muted }]}>{MOMENTOS[c.id].nombre}</Text>
              {c.id === 'media' && <Text style={s.muted12}>Se anota en Snacks</Text>}
            </View>
            <HoraInput valor={c.hora} apagado={!c.on} cambiar={h => guardar({ id: c.id, hora: h })} />
          </View>
        ))}
      </View>

      <View style={[u.card, s.entre]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nombre}>Recordarme a cada hora</Text>
          <Text style={s.muted12}>Una notificación por comida: «{p.nombre}, ¿ya desayunaste?»</Text>
        </View>
        <Interruptor on={!!p.recordar} cambiar={() => actualizarPerfil(p.id, { recordar: !p.recordar, comidas: horario })} />
      </View>

      {p.recordar && notif !== 'activadas' && (
        <View style={[u.card, { gap: 10 }]}>
          <Text style={u.soft}>
            {notif === 'preguntar' ? 'Para que te lleguen, activa las notificaciones en este celular.'
              : notif === 'bloqueadas' ? 'Las notificaciones están bloqueadas en este celular. Actívalas en Ajustes › Notificaciones › Kalo.'
                : notif === 'instalar' ? 'Para recibirlas en el iPhone, abre Kalo desde la pantalla de inicio (Compartir › Agregar a inicio).'
                  : 'Este navegador no permite notificaciones.'}
          </Text>
          {notif === 'preguntar' && (
            <Boton texto="Activar notificaciones" cargando={activando} onPress={async () => {
              setActivando(true); const r = await activarNotificaciones(); setActivando(false); setNotif(r.estado);
            }} />
          )}
        </View>
      )}

      <Text style={[s.muted12, { paddingHorizontal: 4 }]}>
        {total} {total === 1 ? 'comida' : 'comidas'} al día. Toca una hora para cambiarla. Las horas son de Colombia.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12, color: C.muted },
  link: { fontSize: 15, fontWeight: '600', color: C.accent },
  nombre: { fontSize: 15, fontWeight: '700', color: C.text },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 58 },
  borde: { borderTopWidth: 1, borderTopColor: C.divider },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sw: { width: 46, height: 28, borderRadius: 14, backgroundColor: C.surface3 },
  swBola: { position: 'absolute', top: 3, left: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: C.muted },
  horaCaja: { position: 'relative', backgroundColor: C.surface3, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11 },
  horaApagada: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: C.border },
  hora: { fontSize: 16, fontWeight: '700', color: C.text },
});
