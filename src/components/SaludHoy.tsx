import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Boton, u } from './ui';
import type { Meta } from '../logic/energia';
import { IconoCampana } from './Iconos';
import { type Aviso, type Dia, type Limites } from '../logic/salud';
import type { Notificacion } from '../data/comidas';
import { C } from '../theme';

const ROJO = '#E5534B';
const f = (n: number) => Math.round(n).toLocaleString('es-CO');

export type Clave = 'sodio' | 'azucar' | 'grasaSat' | 'fibra' | 'frutasVerduras' | 'proteina' | 'carbos' | 'grasa';

// Encabezado del grupo: «Tope · Mejor no pasarte» o «Meta · Mejor llegar»
export function Grupo({ tipo, texto, sub }: { tipo: 'tope' | 'meta'; texto: string; sub?: string }) {
  return (
    <View style={s.grupo}>
      <Chip tipo={tipo} />
      <Text style={s.grupoTxt}>{texto}</Text>
      {sub ? <Text style={s.grupoSub}>{sub}</Text> : null}
    </View>
  );
}
const Chip = ({ tipo }: { tipo: 'tope' | 'meta' }) => (
  <View style={[s.chip, { backgroundColor: tipo === 'tope' ? 'rgba(229,83,75,0.16)' : 'rgba(192,214,122,0.16)' }]}>
    <Text style={[s.chipTxt, { color: tipo === 'tope' ? '#FF8A84' : C.success }]}>{tipo === 'tope' ? 'TOPE' : 'META'}</Text>
  </View>
);

// Una barra con la rayita que marca el tope o la meta; al tocarla se explica
export function FilaBarra({ nombre, valor, pct, color, valorColor, tocar }: { nombre: string; valor: string; pct: number; color: string; valorColor?: string; tocar: () => void }) {
  return (
    <Pressable onPress={tocar} style={{ gap: 6, paddingVertical: 2 }} accessibilityRole="button" accessibilityLabel={`${nombre}: ${valor}. Toca para saber qué es`}>
      <View style={s.entre}>
        <Text style={s.nombre}>{nombre}</Text>
        <Text style={[s.valor, valorColor ? { color: valorColor } : null]}>{valor}</Text>
      </View>
      <View>
        <View style={s.track}><View style={[s.fill, { width: `${Math.max(2, Math.min(1, pct || 0) * 100)}%`, backgroundColor: color }]} /></View>
        <View style={s.raya} />
      </View>
    </Pressable>
  );
}

// «Tu salud hoy»: arriba lo que tiene tope (no pasarse), abajo lo que es meta (llegar)
export function TarjetaSalud({ d, l, tocar }: { d: Dia; l: Limites; tocar: (c: Clave) => void }) {
  const tope = (c: Clave, nombre: string, v: number, lim: number, unidad: string) => {
    const color = v >= lim ? ROJO : v >= lim * 0.85 ? C.fat : C.accent;
    return <FilaBarra key={c} nombre={nombre} valor={`${f(v)} / ${f(lim)} ${unidad}`} pct={v / lim} color={color} valorColor={v >= lim * 0.85 ? color : undefined} tocar={() => tocar(c)} />;
  };
  const meta = (c: Clave, nombre: string, v: number, lim: number, unidad: string) =>
    <FilaBarra key={c} nombre={nombre} valor={`${f(v)} de ${f(lim)} ${unidad}`} pct={v / lim} color={C.success} tocar={() => tocar(c)} />;
  return (
    <View style={[u.card, { gap: 11 }]}>
      <View style={s.entre}>
        <Text style={s.tit}>Tu salud hoy</Text>
        <Text style={s.toca}>Toca una barra</Text>
      </View>
      <Grupo tipo="tope" texto="Mejor no pasarte" />
      {tope('sodio', 'Sodio', d.sodio, l.sodio, 'mg')}
      {tope('azucar', 'Azúcar libre', d.azucar, l.azucar, 'g')}
      {tope('grasaSat', 'Grasa saturada', d.grasaSat, l.grasaSat, 'g')}
      <View style={s.sep} />
      <Grupo tipo="meta" texto="Mejor llegar" sub="pasarte está bien" />
      {meta('fibra', 'Fibra', d.fibra, l.fibra, 'g')}
      {meta('frutasVerduras', 'Frutas y verduras', d.frutasVerduras, l.frutasVerduras, 'g')}
    </View>
  );
}

// Lo que dice la hoja de cada barra, con los números de quien la mira
export interface Contexto { d: Dia; l: Limites; macros: Record<'proteina' | 'carbos' | 'grasa', { v: number; t: number }>; peso: number; meta: Meta }
const PARA: Record<Meta, string> = { subir: 'para subir de peso', bajar: 'para bajar de peso', mantener: 'para mantener tu peso' };

function explicar(c: Clave, x: Contexto) {
  const { d, l } = x;
  const llevas = (v: number, lim: number, un: string, tipo: 'tope' | 'meta') => {
    const falta = lim - v;
    if (tipo === 'tope') return falta >= 0 ? `Hoy llevas ${f(v)} ${un}, te quedan ${f(falta)} ${un}` : `Hoy llevas ${f(v)} ${un}, te pasaste por ${f(-falta)} ${un}`;
    return falta > 0 ? `Hoy llevas ${f(v)} ${un}, te faltan ${f(falta)} ${un}` : `Hoy llevas ${f(v)} ${un}: ya llegaste a tu meta`;
  };
  const aporto = (k: 'azucar' | 'sodio' | 'grasaSat', un: string) => {
    const top = d.de[k].slice(0, 2);
    return top.length ? `Lo que más aportó: ${top.map(a => `${a.nombre.toLowerCase()} (${f(a.valor)} ${un})`).join(' y ')}.` : 'Todavía no has comido nada que lo aporte.';
  };
  const m = x.macros;
  switch (c) {
    case 'sodio': return { nombre: 'Sodio', tipo: 'tope' as const,
      que: `Es un máximo: lo mejor es quedar por debajo de ${f(l.sodio)} mg al día, unos 5 g de sal (OMS). Mucho sodio sube la presión.`,
      hoy: llevas(d.sodio, l.sodio, 'mg', 'tope'), det: aporto('sodio', 'mg'),
      donde: 'Dónde se esconde', lista: 'Embutidos, quesos salados, caldos de cubo, paquetes, salsas y comidas de la calle.' };
    case 'azucar': return { nombre: 'Azúcar libre', tipo: 'tope' as const,
      que: `Es un máximo: el 10 % de tus calorías (OMS), que para ti son ${f(l.azucar)} g al día. Solo cuenta el azúcar añadido; el de la fruta entera y el de la leche no cuentan.`,
      hoy: llevas(d.azucar, l.azucar, 'g', 'tope'), det: aporto('azucar', 'g'),
      donde: 'Dónde se esconde', lista: 'Azúcar y panela en las bebidas, gaseosa, jugos (también los naturales), miel, postres, galletas y dulces.' };
    case 'grasaSat': return { nombre: 'Grasa saturada', tipo: 'tope' as const,
      que: `Es un máximo: el 10 % de tus calorías (OMS), que para ti son ${f(l.grasaSat)} g al día. En exceso sube el colesterol.`,
      hoy: llevas(d.grasaSat, l.grasaSat, 'g', 'tope'), det: aporto('grasaSat', 'g'),
      donde: 'Dónde se esconde', lista: 'Embutidos, queso, mantequilla, fritos, carne gorda, piel del pollo y chicharrón.' };
    case 'fibra': return { nombre: 'Fibra', tipo: 'meta' as const,
      que: `Es una meta: llegar a ${f(l.fibra)} g al día. Pasarte está bien. Ayuda a la digestión, te deja lleno más tiempo y cuida el colesterol.`,
      hoy: llevas(d.fibra, l.fibra, 'g', 'meta'), det: null,
      donde: 'Dónde la encuentras', lista: 'Fríjoles, lentejas, garbanzos, avena, frutas con cáscara, verduras y pan o arepa integral.' };
    case 'frutasVerduras': return { nombre: 'Frutas y verduras', tipo: 'meta' as const,
      que: `Es una meta: ${f(l.frutasVerduras)} g al día, unas 5 porciones (OMS). Pasarte está bien. Te dan vitaminas, minerales y fibra.`,
      hoy: llevas(d.frutasVerduras, l.frutasVerduras, 'g', 'meta'), det: null,
      donde: 'Para que te hagas una idea', lista: 'Una fruta mediana pesa unos 150 g y un plato de ensalada, unos 100 g.' };
    case 'proteina': return { nombre: 'Proteína', tipo: 'meta' as const,
      que: `Es una meta: llena la barra. Son 1,6 g por cada kilo que pesas (${f(x.peso)} kg → ${f(m.proteina.t)} g). ${x.meta === 'subir' ? 'Con ella, lo que subes de peso es músculo y no solo grasa.' : x.meta === 'bajar' ? 'Con ella cuidas el músculo mientras bajas y te da más llenura.' : 'Con ella cuidas tu músculo.'}`,
      hoy: llevas(m.proteina.v, m.proteina.t, 'g', 'meta'), det: null,
      donde: 'Dónde la encuentras', lista: 'Pollo, carne, huevo, pescado, atún, fríjoles, lentejas, leche, queso y yogur.' };
    case 'carbos': return { nombre: 'Carbohidratos', tipo: 'meta' as const,
      que: `Es una meta: llena la barra. Son tu energía y la parte más grande de tus calorías ${PARA[x.meta]}. Si un día te pasas un poco aquí y te falta grasa, no pasa nada: lo que cuenta es el total de calorías.`,
      hoy: llevas(m.carbos.v, m.carbos.t, 'g', 'meta'), det: null,
      donde: 'Dónde los encuentras', lista: 'Arroz, arepa, papa, plátano, yuca, pan, pasta, avena y fruta.' };
    case 'grasa': return { nombre: 'Grasa', tipo: 'meta' as const,
      que: `Es una meta: llena la barra. Es el 28 % de tus calorías ${PARA[x.meta]}; el cuerpo la necesita para sus hormonas y vitaminas. Si te pasas un poco y te faltan carbohidratos, no pasa nada.`,
      hoy: llevas(m.grasa.v, m.grasa.t, 'g', 'meta'), det: null,
      donde: 'Las mejores', lista: 'Aguacate, aceite de oliva, maní, nueces, huevo y pescado. La de embutidos y fritos es la saturada: esa tiene tope.' };
  }
}

// La hoja que sale desde abajo al tocar una barra
export function HojaBarra({ clave, x, cerrar }: { clave: Clave; x: Contexto; cerrar: () => void }) {
  const e = explicar(clave, x);
  return (
    <Modal transparent animationType="fade" onRequestClose={cerrar}>
      <Pressable style={s.velo} onPress={cerrar} />
      <View style={s.hoja}>
        <View style={s.agarre} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.hojaTit}>{e.nombre}</Text>
          <Chip tipo={e.tipo} />
        </View>
        <Text style={s.hojaQue}>{e.que}</Text>
        <View style={s.dato}>
          <Text style={s.datoTit}>{e.hoy}</Text>
          {e.det ? <Text style={s.datoTxt}>{e.det}</Text> : null}
        </View>
        <View style={s.dato}>
          <Text style={s.datoTit}>{e.donde}</Text>
          <Text style={s.datoTxt}>{e.lista}</Text>
        </View>
        <Boton texto="Entendido" onPress={cerrar} />
      </View>
    </Modal>
  );
}

// Campanita junto a la foto: el número es lo que necesita atención (avisos de salud + preguntas sin responder)
export function Campanita({ cuantos, rojo, abierta, tocar }: { cuantos: number; rojo: boolean; abierta: boolean; tocar: () => void }) {
  return (
    <Pressable onPress={tocar} style={[s.campana, abierta && { backgroundColor: C.surface3 }]} accessibilityLabel="Notificaciones" hitSlop={4}>
      <IconoCampana color={cuantos ? C.text : C.muted} size={22} />
      {cuantos > 0 && <View style={[s.badge, { backgroundColor: rojo ? ROJO : C.fat }]}><Text style={s.badgeTxt}>{cuantos}</Text></View>}
    </Pressable>
  );
}

const PREGUNTA: Record<string, string> = {
  des: '¿Ya desayunaste?', media: '¿Ya comiste algo a media mañana?', alm: '¿Ya almorzaste?', snack: '¿Ya comiste tu snack?', cena: '¿Ya cenaste?', peso: 'Hoy toca pesarte',
};
const ESTADO: Record<string, string> = { enviado: 'Sin responder', respondido: 'Respondida', pospuesto: 'Te la recuerda en 30 min' };

// Desplegable flotante bajo la campanita, como el centro de notificaciones de cualquier app
export function Desplegable({ avisos, notifs }: { avisos: Aviso[]; notifs: Notificacion[] }) {
  const nada = avisos.length === 0 && notifs.length === 0;
  return (
    <View style={s.desp}>
      <View style={s.pico} />
      <Text style={s.panelTit}>Notificaciones</Text>
      {nada && <Text style={s.nota}>No tienes notificaciones hoy. Vas bien con el azúcar, el sodio y la grasa saturada.</Text>}
      {avisos.map((a, k) => (
        <View key={`a${k}`} style={[s.aviso, k > 0 && s.borde]}>
          <View style={[s.punto, { backgroundColor: a.nivel === 'pasado' ? ROJO : C.fat }]} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[s.avisoTit, { color: a.nivel === 'pasado' ? '#FF8A84' : C.fat }]}>{a.titulo}</Text>
            <Text style={s.avisoTxt}>{a.texto}</Text>
          </View>
        </View>
      ))}
      {notifs.map((n, k) => {
        const agua = n.momento.startsWith('agua');
        const pend = n.estado === 'enviado' && !agua;
        return (
          <View key={`n${k}`} style={[s.aviso, (avisos.length > 0 || k > 0) && s.borde]}>
            <View style={[s.punto, { backgroundColor: pend ? C.accent : C.surface3 }]} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[s.avisoTit, { color: pend ? C.text : C.soft }]}>{agua ? '¿Ya tomaste agua?' : PREGUNTA[n.momento] ?? 'Kalo'}</Text>
              <Text style={s.avisoTxt}>{n.hora}{agua ? '' : ` · ${ESTADO[n.estado] ?? ''}`}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  tit: { fontSize: 16, fontWeight: '700', color: C.text },
  nombre: { fontSize: 13.5, color: C.text },
  valor: { fontSize: 13.5, fontWeight: '700', color: C.text },
  track: { height: 7, borderRadius: 4, backgroundColor: C.surface3, overflow: 'hidden' },
  raya: { position: 'absolute', right: 0, top: -4, bottom: -4, width: 2, borderRadius: 1, backgroundColor: C.soft },
  toca: { fontSize: 12, fontWeight: '700', color: C.accent },
  grupo: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 2 },
  grupoTxt: { fontSize: 13, fontWeight: '700', color: C.text },
  grupoSub: { fontSize: 12.5, color: C.muted },
  chip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  chipTxt: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  sep: { height: 1, backgroundColor: C.divider },
  velo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  hoja: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, paddingTop: 12, paddingBottom: 22, paddingHorizontal: 18, gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  agarre: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center' },
  hojaTit: { fontSize: 20, fontWeight: '700', color: C.text },
  hojaQue: { fontSize: 14, color: C.soft, lineHeight: 20 },
  dato: { backgroundColor: C.surface, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, gap: 3 },
  datoTit: { fontSize: 13.5, fontWeight: '700', color: C.text },
  datoTxt: { fontSize: 13, color: C.soft, lineHeight: 18 },
  fill: { height: '100%', borderRadius: 4 },
  nota: { fontSize: 12, color: C.muted, lineHeight: 17 },
  campana: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.bg },
  badgeTxt: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  desp: { position: 'absolute', top: 54, right: 0, width: 330, maxWidth: '100%', backgroundColor: C.surface2, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, gap: 6, zIndex: 30,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  pico: { position: 'absolute', top: -7, right: 62, width: 14, height: 14, backgroundColor: C.surface2, borderLeftWidth: 1, borderTopWidth: 1, borderColor: C.border, transform: [{ rotate: '45deg' }] },
  borde: { borderTopWidth: 1, borderTopColor: C.divider },
  panelTit: { fontSize: 15, fontWeight: '700', color: C.text },
  aviso: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  punto: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  avisoTit: { fontSize: 14, fontWeight: '700' },
  avisoTxt: { fontSize: 12.5, color: C.soft, lineHeight: 18 },
});
