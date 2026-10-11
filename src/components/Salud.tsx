import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Boton, u } from './ui';
import { SALUD_VACIA, pctSalud, tieneCondicion, type Salud } from '../logic/energia';
import { C } from '../theme';

const PCT_MEDICO = [-15, -10, -5, 5, 10];
const pctTxt = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)} %`;

// Las cuatro opciones. Hipo e hiper se excluyen entre sí; «Ninguna» limpia lo demás.
export function ListaSalud({ valor, onCambio, fondo = C.surface }: { valor: Salud; onCambio: (s: Salud) => void; fondo?: string }) {
  const op = (on: boolean, titulo: string, sub: string | null, tocar: () => void) => (
    <Pressable key={titulo} onPress={tocar} style={[s.chk, { backgroundColor: fondo, borderColor: fondo }, on && s.chkOn]}>
      <View style={[s.caja, on && s.cajaOn]}>{on && <Text style={s.visto}>✓</Text>}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.chkTit}>{titulo}</Text>
        {sub && <Text style={s.chkSub}>{sub}</Text>}
      </View>
    </Pressable>
  );
  const tiroides = (t: 'hipo' | 'hiper') => onCambio({ ...valor, ninguna: false, tiroides: valor.tiroides === t ? null : t, medicamento: valor.tiroides === t ? null : valor.medicamento });
  return (
    <View style={{ gap: 8 }}>
      {op(valor.tiroides === 'hipo', 'Hipotiroidismo', 'Tiroides lenta', () => tiroides('hipo'))}
      {op(valor.tiroides === 'hiper', 'Hipertiroidismo', 'Tiroides acelerada', () => tiroides('hiper'))}
      {op(valor.conMedico, 'Mi médico me dio un ajuste', 'Un porcentaje de metabolismo', () => onCambio({ ...valor, ninguna: false, conMedico: !valor.conMedico, medico: valor.conMedico ? null : valor.medico }))}
      {op(valor.ninguna, 'Ninguna', null, () => onCambio({ ...SALUD_VACIA, ninguna: !valor.ninguna }))}
    </View>
  );
}

export const necesitaPreguntas = (v: Salud) => v.tiroides !== null || v.conMedico;

// Lo que falta saber de lo marcado
export function PreguntasSalud({ valor, onCambio, fondo = C.surface }: { valor: Salud; onCambio: (s: Salud) => void; fondo?: string }) {
  const chip = (on: boolean, l: string, tocar: () => void) => (
    <Pressable key={l} onPress={tocar} style={[s.chip, on && s.chipOn]}><Text style={[s.chipTxt, on && { color: C.onAccent }]}>{l}</Text></Pressable>
  );
  return (
    <View style={{ gap: 10 }}>
      {valor.tiroides && (
        <View style={[s.sub, { backgroundColor: fondo }]}>
          <Text style={s.preg}>¿Tomas medicamento para la tiroides?</Text>
          <Text style={s.chkSub}>{valor.tiroides === 'hipo' ? 'Levotiroxina (Eutirox, Synthroid…)' : 'Metimazol, propiltiouracilo…'}</Text>
          <View style={s.chips}>
            {([['si', 'Sí'], ['no', 'No'], ['nose', 'No sé']] as const).map(([id, l]) => chip(valor.medicamento === id, l, () => onCambio({ ...valor, medicamento: id })))}
          </View>
          {valor.tiroides === 'hiper' && (
            <Text style={s.chkSub}>
              {valor.medicamento === 'si' ? 'Con medicamento el metabolismo suele quedar normal.' : 'Sin tratar, el cuerpo quema más y el cálculo puede quedarse corto. Pésate cada semana y Kalo lo afina.'}
            </Text>
          )}
        </View>
      )}
      {valor.conMedico && (
        <View style={[s.sub, { backgroundColor: fondo }]}>
          <Text style={s.preg}>¿Qué ajuste te dio tu médico?</Text>
          <Text style={s.chkSub}>Cuánto más lento o más rápido es tu metabolismo</Text>
          <View style={s.chips}>{PCT_MEDICO.map(n => chip(valor.medico === n, pctTxt(n), () => onCambio({ ...valor, medico: n })))}</View>
        </View>
      )}
    </View>
  );
}

export function errorLista(v: Salud) {
  return v.ninguna || necesitaPreguntas(v) ? null : 'Marca una opción o «Ninguna».';
}
export function errorPreguntas(v: Salud) {
  if (v.tiroides && !v.medicamento) return 'Dinos si tomas medicamento para la tiroides.';
  if (v.conMedico && v.medico == null) return 'Escoge el ajuste que te dio tu médico.';
  return null;
}

// Por qué cambió el cálculo, en una frase
export function motivoSalud(v?: Salud | null) {
  const pct = pctSalud(v);
  if (!v || pct === 0) return null;
  return v.conMedico && v.medico != null ? `${pctTxt(pct)} que te dio tu médico` : `${pctTxt(pct)} por hipotiroidismo`;
}

export function resumenSalud(v?: Salud | null) {
  if (!v || !tieneCondicion(v)) return v?.ninguna ? 'Ninguna condición' : 'Sin responder';
  const partes: string[] = [];
  if (v.tiroides) partes.push(`${v.tiroides === 'hipo' ? 'Hipotiroidismo' : 'Hipertiroidismo'}${v.medicamento === 'si' ? ', con medicamento' : v.medicamento === 'no' ? ', sin medicamento' : ''}`);
  if (v.conMedico && v.medico != null) partes.push(`ajuste del médico ${pctTxt(v.medico)}`);
  return partes.join(' · ');
}

// Tarjeta en Perfil: ver y cambiar «Tu salud»
export function TarjetaSalud({ valor, guardar }: { valor?: Salud | null; guardar: (s: Salud) => Promise<string | null> }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState<Salud>(valor ?? SALUD_VACIA);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const motivo = motivoSalud(valor);
  const onGuardar = async () => {
    const e = errorLista(v) ?? errorPreguntas(v);
    setError(e);
    if (e) return;
    setGuardando(true);
    const err = await guardar(v);
    setGuardando(false);
    if (err) setError(err); else setEditando(false);
  };
  return (
    <View style={[u.card, { gap: 12 }]}>
      <Text style={s.overline}>Salud</Text>
      {!editando ? (
        <>
          <Text style={u.soft}>{resumenSalud(valor)}</Text>
          {motivo && <Text style={s.chkSub}>El metabolismo en reposo va {motivo}.</Text>}
          <Boton texto="Cambiar" tipo="borde" onPress={() => { setV(valor ?? SALUD_VACIA); setError(null); setEditando(true); }} />
        </>
      ) : (
        <>
          <Text style={s.chkSub}>Algunas condiciones hacen que el cuerpo queme más o menos calorías. Marca si tienes alguna.</Text>
          <ListaSalud valor={v} onCambio={setV} fondo={C.surface2} />
          <PreguntasSalud valor={v} onCambio={setV} fondo={C.surface2} />
          {error && <Text style={u.error}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Boton texto="Cancelar" tipo="borde" onPress={() => setEditando(false)} desactivado={guardando} /></View>
            <View style={{ flex: 1 }}><Boton texto="Guardar" onPress={onGuardar} cargando={guardando} /></View>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  overline: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.muted },
  chk: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.surface, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, minHeight: 56 },
  chkOn: { borderColor: C.accent, backgroundColor: '#2A1C16' },
  caja: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  cajaOn: { backgroundColor: C.accent, borderColor: C.accent },
  visto: { color: C.onAccent, fontSize: 14, fontWeight: '700' },
  chkTit: { fontSize: 15, fontWeight: '700', color: C.text },
  chkSub: { fontSize: 13, color: C.muted, lineHeight: 18 },
  sub: { backgroundColor: C.surface, borderRadius: 16, padding: 14, gap: 8 },
  preg: { fontSize: 15, fontWeight: '700', color: C.text },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { flexGrow: 1, minWidth: 52, alignItems: 'center', paddingVertical: 10, borderRadius: 11, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipTxt: { fontSize: 14, fontWeight: '600', color: C.text },
});
