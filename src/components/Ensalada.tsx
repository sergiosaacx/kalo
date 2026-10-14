// «Ensalada a tu gusto»: se escogen las verduras que trae (poco, porción o mucho) y el aliño, y entra al día como una sola cosa.
// Se guarda como un ítem del alimento «ensalada» (sin nutrientes propios) con sus partes como añadidos.
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { nutrientes, type AlimentoDB, type Anadido } from '../data/alimentos';
import type { AnadidoBandeja } from '../data/bandeja';
import { fmt } from '../logic/energia';
import { AlimentoPicker } from './AlimentoPicker';
import { Boton, u } from './ui';
import { C } from '../theme';

export const ENSALADA_ID = 'ensalada';

// La porción de cada verdura EN UNA ENSALADA (no la del catálogo): «Poco» es la mitad y «Mucho» el doble
const VERDURAS: { id: string; nombre: string; g: number; texto: string }[] = [
  { id: 'lechuga-crespa', nombre: 'Lechuga', g: 40, texto: '1 taza' },
  { id: 'tomate', nombre: 'Tomate', g: 60, texto: '½ tomate' },
  { id: 'pepino', nombre: 'Pepino', g: 50, texto: '½ taza en rodajas' },
  { id: 'cebolla-morada', nombre: 'Cebolla', g: 20, texto: 'unos aros' },
  { id: 'zanahoria', nombre: 'Zanahoria', g: 30, texto: '¼ de zanahoria rallada' },
  { id: 'repollo', nombre: 'Repollo', g: 35, texto: '½ taza picado' },
  { id: 'aguacate', nombre: 'Aguacate', g: 50, texto: '¼ de aguacate' },
  { id: 'pimenton-rojo', nombre: 'Pimentón', g: 30, texto: 'unas tiras' },
  { id: 'remolacha-cocida', nombre: 'Remolacha', g: 40, texto: 'unas rodajas' },
];
const ALINOS: { id: string; nombre: string; g: number; texto: string }[] = [
  { id: 'aceite-oliva', nombre: 'Aceite de oliva', g: 4.5, texto: '1 cucharadita' },
  { id: 'limon-exprimido', nombre: 'Limón', g: 15, texto: '½ limón' },
  { id: 'sal', nombre: 'Sal', g: 0.5, texto: '1 pizca' },
  { id: 'vinagreta', nombre: 'Vinagreta', g: 15, texto: '1 cucharada' },
  { id: 'salsa-rosada', nombre: 'Salsa rosada', g: 16, texto: '1 cucharada' },
];
export const ES_ALINO = new Set(ALINOS.map(a => a.id));

type Nivel = 0.5 | 1 | 2;
interface Parte { id: string; nombre: string; porcion: number; texto: string; nivel: Nivel | null; gramos: number }
const porcionDe = (a: AlimentoDB) => VERDURAS.find(v => v.id === a.id) ?? { id: a.id, nombre: a.nombre, g: a.porcion_base.gramos, texto: a.porcion_base.texto };
const nuevaParte = (a: AlimentoDB): Parte => { const p = porcionDe(a); return { id: a.id, nombre: p.nombre, porcion: p.g, texto: p.texto, nivel: 1, gramos: p.g }; };

// Lo guardado (porciones del catálogo) → partes con su nivel (o gramos sueltos si no cuadra con ninguno)
function desdeGuardado(anadidos: Anadido[] | null | undefined, porId: Map<string, AlimentoDB>) {
  const partes: Parte[] = [];
  const alinos = new Set<string>();
  for (const x of anadidos ?? []) {
    const a = porId.get(x.alimento_id);
    if (!a) continue;
    if (ES_ALINO.has(a.id)) { alinos.add(a.id); continue; }
    const p = nuevaParte(a);
    const g = Math.round(x.cantidad * a.porcion_base.gramos * 10) / 10;
    const n = ([0.5, 1, 2] as Nivel[]).find(k => Math.abs(k * p.porcion - g) < 0.6);
    partes.push({ ...p, nivel: n ?? null, gramos: g });
  }
  return { partes, alinos };
}

export function ArmarEnsalada({ porId, inicial, titulo, botonTxt, etiquetaNombre, volver, onListo, ocupado, extra }: {
  porId: Map<string, AlimentoDB>;
  inicial?: { nombre?: string | null; anadidos?: Anadido[] | null } | null;
  titulo: string; botonTxt: string; etiquetaNombre: string;
  volver: () => void;
  onListo: (r: { nombre: string; anadidos: AnadidoBandeja[]; resumen: string }) => void;
  ocupado?: boolean; extra?: ReactNode;
}) {
  const ini = desdeGuardado(inicial?.anadidos, porId);
  const [partes, setPartes] = useState<Parte[]>(ini.partes);
  const [alinos, setAlinos] = useState<Set<string>>(ini.alinos);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [picker, setPicker] = useState(false);
  const [gramosDe, setGramosDe] = useState<string | null>(null); // la parte a la que se le escriben los gramos

  const tiene = (id: string) => partes.some(p => p.id === id);
  const alternar = (id: string) => {
    const a = porId.get(id);
    if (!a) return;
    setPartes(ps => (ps.some(p => p.id === id) ? ps.filter(p => p.id !== id) : [...ps, nuevaParte(a)]));
  };
  const nivel = (id: string, n: Nivel) => setPartes(ps => ps.map(p => (p.id === id ? { ...p, nivel: n, gramos: p.porcion * n } : p)));
  const gramos = (id: string, g: number) => setPartes(ps => ps.map(p => (p.id === id ? { ...p, nivel: null, gramos: g } : p)));
  const alternarAlino = (id: string) => setAlinos(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Lo que se guarda: cada parte en porciones del catálogo
  const lista: AnadidoBandeja[] = [
    ...partes.filter(p => p.gramos > 0 && porId.has(p.id)).map(p => {
      const a = porId.get(p.id)!;
      return { alimento: a, cantidad: p.gramos / a.porcion_base.gramos, texto: `${fmt(p.gramos)} g` };
    }),
    ...ALINOS.filter(x => alinos.has(x.id) && porId.has(x.id)).map(x => {
      const a = porId.get(x.id)!;
      return { alimento: a, cantidad: x.g / a.porcion_base.gramos, texto: x.texto };
    }),
  ];
  const kcal = lista.reduce((t, x) => t + nutrientes(x.alimento, x.cantidad).kcal, 0);
  const gVerdura = partes.reduce((t, p) => t + p.gramos, 0);
  const resumen = partes.map(p => p.nombre.toLowerCase()).join(', ');
  const alinoTxt = ALINOS.filter(x => alinos.has(x.id)).map(x => `${x.nombre.toLowerCase()} ${x.texto}`).join(' · ');

  if (picker) {
    return <AlimentoPicker titulo="Agregar a la ensalada…" onCerrar={() => setPicker(false)} onElegir={a => { if (!tiene(a.id)) setPartes(ps => [...ps, nuevaParte(a)]); setPicker(false); }} />;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={s.entre}>
        <Text style={s.h1}>{titulo}</Text>
        <Pressable onPress={volver} style={{ minHeight: 40, justifyContent: 'center' }}><Text style={s.link}>‹ Volver</Text></Pressable>
      </View>

      <View style={[u.card, { gap: 10, padding: 14 }]}>
        <Text style={s.sec}>¿Qué trae?</Text>
        <View style={s.chips}>
          {VERDURAS.filter(v => porId.has(v.id)).map(v => (
            <Pressable key={v.id} onPress={() => alternar(v.id)} style={[s.chip, tiene(v.id) && s.chipOn]}>
              <Text style={[s.chipTxt, tiene(v.id) && { color: C.success }]}>{v.nombre}</Text>
            </Pressable>
          ))}
          {partes.filter(p => !VERDURAS.some(v => v.id === p.id)).map(p => (
            <Pressable key={p.id} onPress={() => alternar(p.id)} style={[s.chip, s.chipOn]}>
              <Text style={[s.chipTxt, { color: C.success }]}>{p.nombre}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setPicker(true)} style={[s.chip, { borderStyle: 'dashed' }]}><Text style={[s.chipTxt, { color: C.accent }]}>+ Otra</Text></Pressable>
        </View>
        {partes.length === 0 ? <Text style={s.muted}>Toca lo que trae tu ensalada.</Text> : <Text style={s.muted}>Si quieres gramos exactos, toca el nombre.</Text>}
        {partes.map((p, k) => {
          const a = porId.get(p.id);
          return (
            <View key={p.id} style={[s.parte, k > 0 && s.borde]}>
              <View style={s.fila}>
                <Pressable onPress={() => setGramosDe(g => (g === p.id ? null : p.id))} style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.nom} numberOfLines={1}>{p.nombre}</Text>
                  <Text style={s.muted} numberOfLines={1}>{p.nivel === 1 ? p.texto : `${fmt(p.gramos)} g`}</Text>
                </Pressable>
                <View style={s.niveles}>
                  {([[0.5, 'Poco'], [1, 'Porción'], [2, 'Mucho']] as [Nivel, string][]).map(([n, l]) => (
                    <Pressable key={n} onPress={() => nivel(p.id, n)} style={[s.nivel, p.nivel === n && { backgroundColor: C.accent }]}>
                      <Text style={[s.nivelTxt, p.nivel === n && { color: C.onAccent }]}>{l}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={s.kc}>{a ? fmt(nutrientes(a, p.gramos / a.porcion_base.gramos).kcal) : ''}</Text>
              </View>
              {gramosDe === p.id && (
                <View style={[u.inputWrap, { marginTop: 8 }]}>
                  <TextInput defaultValue={String(Math.round(p.gramos))} keyboardType="numeric" style={u.input} autoFocus selectTextOnFocus
                    onChangeText={t => { const g = Number(t.replace(',', '.')); if (g >= 0) gramos(p.id, g); }} />
                  <Text style={u.unidad}>gramos</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={[u.card, { gap: 10, padding: 14 }]}>
        <Text style={s.sec}>Aliño</Text>
        <View style={s.chips}>
          {ALINOS.filter(x => porId.has(x.id)).map(x => (
            <Pressable key={x.id} onPress={() => alternarAlino(x.id)} style={[s.chip, alinos.has(x.id) && s.chipOn]}>
              <Text style={[s.chipTxt, alinos.has(x.id) && { color: C.success }]}>{x.nombre}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setAlinos(new Set())} style={[s.chip, alinos.size === 0 && s.chipOn]}>
            <Text style={[s.chipTxt, alinos.size === 0 && { color: C.success }]}>Nada</Text>
          </Pressable>
        </View>
        {alinoTxt !== '' && <Text style={s.muted}>{alinoTxt}</Text>}
      </View>

      <View style={s.total}>
        <Text style={s.totalTxt}>Tu ensalada · {fmt(gVerdura)} g</Text>
        <Text style={s.totalKcal}>{fmt(kcal)} kcal</Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={s.muted}>{etiquetaNombre}</Text>
        <View style={u.inputWrap}>
          <TextInput value={nombre} onChangeText={setNombre} placeholder="Ensalada de la casa" placeholderTextColor={C.muted} style={u.input} />
        </View>
      </View>

      <Boton texto={botonTxt} cargando={ocupado} desactivado={partes.length === 0}
        onPress={() => onListo({ nombre: nombre.trim(), anadidos: lista, resumen })} />
      {extra}
    </View>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 4 },
  h1: { fontSize: 24, fontWeight: '700', color: C.text, flex: 1 },
  link: { fontSize: 15, fontWeight: '600', color: C.accent },
  sec: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.muted, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  chipOn: { borderColor: C.success, backgroundColor: 'rgba(192,214,122,0.14)' },
  chipTxt: { fontSize: 13.5, fontWeight: '600', color: C.text },
  parte: { paddingVertical: 8 },
  borde: { borderTopWidth: 1, borderTopColor: C.divider },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nom: { fontSize: 14.5, fontWeight: '600', color: C.text },
  muted: { fontSize: 12.5, color: C.muted },
  niveles: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden' },
  nivel: { paddingHorizontal: 8, paddingVertical: 7 },
  nivelTxt: { fontSize: 12, fontWeight: '700', color: C.muted },
  kc: { width: 34, textAlign: 'right', fontSize: 13.5, fontWeight: '700', color: C.text },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', backgroundColor: C.surface2, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 },
  totalTxt: { fontSize: 13.5, color: C.soft },
  totalKcal: { fontSize: 16, fontWeight: '700', color: C.text },
});
