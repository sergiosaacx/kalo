import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { u } from '../components/ui';
import { AlimentoPicker } from '../components/AlimentoPicker';
import { mapaCache } from '../data/alimentos';
import { useSesion, type PerfilActivo } from '../data/sesion';
import { EVITO_VACIO, GRUPOS, grupoDe, type Evito, type TipoGrupo } from '../logic/evito';
import { C } from '../theme';

const ROJO = '#E5534B';
const COLOR: Record<TipoGrupo, string> = { alergia: ROJO, evito: C.accent, prefiero: C.success };
const TITULO: Record<TipoGrupo, string> = {
  alergia: 'Alergias · Kalo te avisa y nunca te lo recomienda',
  evito: 'No me lo recomienden',
  prefiero: 'Prefiero · Kalo los pone primero',
};
const CAMPO: Record<TipoGrupo, 'alergias' | 'evito' | 'prefiero'> = { alergia: 'alergias', evito: 'evito', prefiero: 'prefiero' };

// Tarjeta de acceso en Perfil
export function TarjetaEvito({ p, abrir }: { p: PerfilActivo; abrir: () => void }) {
  const ev = p.evito ?? EVITO_VACIO;
  const nombres = (l: string[], extra: string[]) => [...l.map(id => grupoDe(id)?.nombre), ...extra.map(id => mapaCache().get(id)?.nombre)].filter(Boolean).join(', ');
  const al = nombres(ev.alergias, ev.alergiaAlimentos), evi = nombres(ev.evito, ev.evitoAlimentos), pre = nombres(ev.prefiero, []);
  const nada = !al && !evi && !pre;
  return (
    <Pressable onPress={abrir} style={[u.card, { gap: 6 }]}>
      <Text style={s.muted13}>Lo que evito</Text>
      {nada ? <Text style={u.soft}>Alergias, lo que no quieres que Kalo te recomiende y lo que prefieres.</Text> : (
        <>
          {al ? <Text style={s.linea}><Text style={{ color: ROJO, fontWeight: '700' }}>Alergias: </Text>{al}</Text> : null}
          {evi ? <Text style={s.linea}><Text style={{ color: C.accent, fontWeight: '700' }}>Evito: </Text>{evi}</Text> : null}
          {pre ? <Text style={s.linea}><Text style={{ color: C.success, fontWeight: '700' }}>Prefiero: </Text>{pre}</Text> : null}
        </>
      )}
      <Text style={[s.link, { fontSize: 14 }]}>{nada ? 'Configurar →' : 'Cambiar →'}</Text>
    </Pressable>
  );
}

export function LoQueEvito({ volver }: { volver: () => void }) {
  const { activo, actualizarPerfil } = useSesion();
  const p = activo!;
  const ev: Evito = { ...EVITO_VACIO, ...(p.evito ?? {}) };
  const [info, setInfo] = useState<string | null>(null);
  const [picker, setPicker] = useState<'alergia' | 'evito' | null>(null);
  const guardar = (nuevo: Evito) => actualizarPerfil(p.id, { evito: nuevo });

  const tocar = (tipo: TipoGrupo, id: string) => {
    const campo = CAMPO[tipo];
    const on = ev[campo].includes(id);
    guardar({ ...ev, [campo]: on ? ev[campo].filter(x => x !== id) : [...ev[campo], id] });
    if (!on && grupoDe(id)?.info) setInfo(id); else if (on && info === id) setInfo(null);
  };

  if (picker) {
    return <AlimentoPicker titulo={picker === 'alergia' ? 'Soy alérgico a…' : 'No me recomienden…'} onCerrar={() => setPicker(null)} onElegir={a => {
      const campo = picker === 'alergia' ? 'alergiaAlimentos' : 'evitoAlimentos';
      if (!ev[campo].includes(a.id)) guardar({ ...ev, [campo]: [...ev[campo], a.id] });
      setPicker(null);
    }} />;
  }

  const seccion = (tipo: TipoGrupo) => {
    const extra = tipo === 'alergia' ? ev.alergiaAlimentos : tipo === 'evito' ? ev.evitoAlimentos : [];
    const campoExtra = tipo === 'alergia' ? 'alergiaAlimentos' : 'evitoAlimentos';
    const g = info ? grupoDe(info) : null;
    return (
      <View style={{ gap: 8 }} key={tipo}>
        <Text style={s.sec}>{TITULO[tipo]}</Text>
        <View style={s.chips}>
          {GRUPOS.filter(x => x.tipo === tipo).map(x => {
            const on = ev[CAMPO[tipo]].includes(x.id);
            return (
              <Pressable key={x.id} onPress={() => tocar(tipo, x.id)} style={[s.chip, on && { backgroundColor: COLOR[tipo], borderColor: COLOR[tipo] }]}>
                <Text style={[s.chipTxt, on && { color: tipo === 'alergia' ? '#fff' : C.onAccent }]}>{x.nombre}</Text>
              </Pressable>
            );
          })}
          {extra.map(id => (
            <Pressable key={id} onPress={() => guardar({ ...ev, [campoExtra]: extra.filter(x => x !== id) })} style={[s.chip, { backgroundColor: COLOR[tipo], borderColor: COLOR[tipo] }]}>
              <Text style={[s.chipTxt, { color: tipo === 'alergia' ? '#fff' : C.onAccent }]}>{mapaCache().get(id)?.nombre ?? id}  ×</Text>
            </Pressable>
          ))}
          {tipo !== 'prefiero' && (
            <Pressable onPress={() => setPicker(tipo)} style={[s.chip, { borderStyle: 'dashed' }]}><Text style={[s.chipTxt, { color: C.soft }]}>+ Otro</Text></Pressable>
          )}
        </View>
        {g && g.tipo === tipo && g.info && (
          <View style={s.info}><Text style={s.infoTxt}><Text style={{ color: C.text, fontWeight: '700' }}>{g.nombre}: </Text>{g.info}</Text></View>
        )}
      </View>
    );
  };

  return (
    <View style={{ gap: 16 }}>
      <Pressable onPress={volver} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>‹ Perfil</Text></Pressable>
      <View style={{ gap: 2, marginTop: -6 }}>
        <Text style={s.muted13}>{p.nombre}</Text>
        <Text style={u.h1}>Lo que evito</Text>
      </View>
      {seccion('alergia')}
      {seccion('evito')}
      {seccion('prefiero')}
      <Text style={s.muted12}>Es información general con fuente (OMS). Para una alergia, manda lo que diga el médico. Cada perfil de la familia tiene lo suyo.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  muted13: { fontSize: 13, color: C.muted },
  muted12: { fontSize: 12, color: C.muted, lineHeight: 17 },
  link: { fontSize: 15, fontWeight: '600', color: C.accent },
  linea: { fontSize: 14, color: C.text, lineHeight: 20 },
  sec: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 11 },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.text },
  info: { backgroundColor: C.surface2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  infoTxt: { fontSize: 13, color: C.soft, lineHeight: 19 },
});
