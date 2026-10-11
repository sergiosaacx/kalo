import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Boton, Campo, FechaNacimiento, Segmento, u } from '../components/ui';
import { NotificacionesPerfil } from '../components/Notificaciones';
import { useSesion, type PerfilActivo } from '../data/sesion';
import { edadDe, errorFecha, fechaValida, type Sexo } from '../logic/energia';
import { C } from '../theme';

// Perfiles de la familia + datos del perfil activo (handoff › Perfil)
export function Perfil({ nuevoPerfil }: { nuevoPerfil: () => void }) {
  const { perfiles, activo, activar, actualizarPerfil, salir, sesion } = useSesion();
  if (!activo) return null;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2, paddingTop: 4 }}>
        <Text style={{ fontSize: 13, color: C.muted }}>{sesion?.user.email}</Text>
        <Text style={u.h1}>Perfiles</Text>
      </View>

      <View style={[u.card, { padding: 8 }]}>
        {perfiles.map(p => {
          const on = p.id === activo.id;
          return (
            <Pressable key={p.id} onPress={() => activar(p.id)} style={[s.fila, on && { borderColor: C.accent }]}>
              <View style={[s.avatar, { backgroundColor: p.color }]}><Text style={s.avatarTxt}>{p.nombre.charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.nombre}>{p.nombre}</Text>
                <Text style={s.sub}>{p.estatura} cm · {p.peso.toLocaleString('es-CO')} kg</Text>
              </View>
              {on && <Text style={s.activo}>Activo</Text>}
            </Pressable>
          );
        })}
        <Pressable onPress={nuevoPerfil} style={[s.fila, { justifyContent: 'center' }]}>
          <Text style={{ color: C.accent, fontSize: 15, fontWeight: '600' }}>+ Nuevo perfil</Text>
        </Pressable>
      </View>

      <Datos key={activo.id} p={activo} guardar={cambios => actualizarPerfil(activo.id, cambios)} />

      <NotificacionesPerfil />

      <Boton texto="Cerrar sesión" tipo="texto" onPress={salir} />
    </View>
  );
}

function Datos({ p, guardar }: { p: PerfilActivo; guardar: (c: Partial<PerfilActivo>) => Promise<string | null> }) {
  const [f, setF] = useState({ nombre: p.nombre, estatura: String(p.estatura), peso: String(p.peso).replace('.', ','), sexo: p.sexo });
  const [aa, mm, dd] = (p.fechaNacimiento ?? '--').split('-');
  const [nac, setNac] = useState({ dia: dd ? String(Number(dd)) : '', mes: mm ? String(Number(mm)) : '', anio: aa ?? '' });
  const fechaNueva = fechaValida(nac.dia, nac.mes, nac.anio);
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; txt: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (estado?.tipo === 'ok') { const t = setTimeout(() => setEstado(null), 2500); return () => clearTimeout(t); } }, [estado]);

  const cambiado = f.nombre !== p.nombre || fechaNueva !== (p.fechaNacimiento ?? null) || f.estatura !== String(p.estatura)
    || parseFloat(f.peso.replace(',', '.')) !== p.peso || f.sexo !== p.sexo;

  const onGuardar = async () => {
    const estatura = parseFloat(f.estatura), peso = parseFloat(f.peso.replace(',', '.'));
    if (!f.nombre.trim()) return setEstado({ tipo: 'error', txt: 'Escribe un nombre.' });
    const ef = errorFecha(nac.dia, nac.mes, nac.anio);
    if (ef || !fechaNueva) return setEstado({ tipo: 'error', txt: ef ?? 'Revisa la fecha de nacimiento.' });
    if (!(estatura >= 100 && estatura <= 230)) return setEstado({ tipo: 'error', txt: 'La estatura va en centímetros, por ejemplo 165.' });
    if (!(peso >= 30 && peso <= 250)) return setEstado({ tipo: 'error', txt: 'El peso va en kilos, por ejemplo 65.' });
    setGuardando(true);
    const err = await guardar({ nombre: f.nombre.trim(), fechaNacimiento: fechaNueva, edad: edadDe(fechaNueva), estatura, peso, sexo: f.sexo });
    setGuardando(false);
    setEstado(err ? { tipo: 'error', txt: err } : { tipo: 'ok', txt: 'Guardado' });
  };

  return (
    <View style={[u.card, { gap: 12 }]}>
      <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.muted }}>Datos de {p.nombre}</Text>
      <Campo etiqueta="Nombre" value={f.nombre} onChangeText={v => setF({ ...f, nombre: v })} autoCapitalize="words" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Campo etiqueta="Estatura" unidad="cm" value={f.estatura} onChangeText={v => setF({ ...f, estatura: v })} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Campo etiqueta="Peso" unidad="kg" value={f.peso} onChangeText={v => setF({ ...f, peso: v })} keyboardType="decimal-pad" /></View>
      </View>
      <FechaNacimiento valor={nac} onCambio={setNac} />
      <Segmento<Sexo> opciones={[['F', 'Mujer'], ['M', 'Hombre']]} valor={f.sexo} onCambio={v => setF({ ...f, sexo: v })} />
      {estado && <Text style={estado.tipo === 'ok' ? { color: C.success, fontSize: 14 } : u.error}>{estado.txt}</Text>}
      <Boton texto="Guardar cambios" onPress={onGuardar} cargando={guardando} desactivado={!cambiado} />
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', minHeight: 60 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.onAccent, fontSize: 16, fontWeight: '700' },
  nombre: { fontSize: 16, fontWeight: '700', color: C.text },
  sub: { fontSize: 13, color: C.muted },
  activo: { fontSize: 12, fontWeight: '700', color: C.accent },
});
