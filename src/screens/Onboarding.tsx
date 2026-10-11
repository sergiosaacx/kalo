import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Boton, Campo, Chips, FechaNacimiento, Segmento, Stepper, u } from '../components/ui';
import { useSesion } from '../data/sesion';
import { edadDe, errorFecha, fechaValida, fmt, gasto, type Meta, type Perfil, type Sexo } from '../logic/energia';
import { TuDia } from './TuDia';
import { C } from '../theme';

type Borrador = Omit<Perfil, 'id' | 'color'>;
const INICIAL: Borrador = {
  nombre: '', edad: 30, sexo: 'F', estatura: 165, peso: 65, pesoInicial: 65, meta: 'bajar', pesoMeta: 60, ritmo: 0.5,
  trabajo: 'sentado', pasos: 6000, ejercicio: 20, sueno: 7,
};
const fq = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Registro de un perfil en 4 pasos: Bienvenida → Datos → Tu día → Meta (handoff › Onboarding)
export function Onboarding({ primero, onCancelar }: { primero: boolean; onCancelar?: () => void }) {
  const { crearPerfil } = useSesion();
  const [paso, setPaso] = useState(0);
  const [d, setD] = useState<Borrador>(INICIAL);
  const [txt, setTxt] = useState({ estatura: '165', peso: '65' });
  const [nac, setNac] = useState({ dia: '', mes: '', anio: '' });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (p: Partial<Borrador>) => setD(x => ({ ...x, ...p }));

  const num = (k: 'estatura' | 'peso', v: string) => {
    setTxt(t => ({ ...t, [k]: v }));
    const n = parseFloat(v.replace(',', '.'));
    if (!isNaN(n)) set(k === 'peso' ? { peso: n, pesoInicial: n } : { [k]: n } as Partial<Borrador>);
  };

  const validar = () => {
    if (paso === 1) {
      if (!d.nombre.trim()) return 'Escribe el nombre de esta persona.';
      const ef = errorFecha(nac.dia, nac.mes, nac.anio);
      if (ef) return ef;
      if (!(d.estatura >= 100 && d.estatura <= 230)) return 'La estatura va en centímetros, por ejemplo 165.';
      if (!(d.peso >= 30 && d.peso <= 250)) return 'El peso va en kilos, por ejemplo 65.';
    }
    return null;
  };

  const siguiente = async () => {
    const e = validar();
    setError(e);
    if (e) return;
    if (paso === 1) {
      const f = fechaValida(nac.dia, nac.mes, nac.anio)!;
      // Meta por defecto coherente con el peso escrito
      set({ fechaNacimiento: f, edad: edadDe(f), pesoMeta: d.meta === 'mantener' ? d.peso : d.meta === 'bajar' ? Math.round(d.peso - 5) : Math.round(d.peso + 3) });
    }
    if (paso < 3) return setPaso(paso + 1);
    setGuardando(true);
    const err = await crearPerfil({ ...d, nombre: d.nombre.trim(), pesoMeta: d.meta === 'mantener' ? d.peso : d.pesoMeta });
    setGuardando(false);
    if (err) setError(err);
  };

  const en = gasto({ ...d, id: '', color: '' });
  const semanas = d.meta === 'mantener' ? 0 : Math.ceil(Math.abs(d.peso - d.pesoMeta) / d.ritmo);
  const fecha = new Date(Date.now() + semanas * 7 * 864e5);

  // Paso 3: el cuestionario «Tu día» completo (con sus propios botones fijos)
  if (paso === 2) {
    return (
      <TuDia base={{ edad: d.edad, estatura: d.estatura, peso: d.peso, sexo: d.sexo }} inicial={d.rutina}
        onSalir={() => setPaso(1)} onListo={r => { set({ rutina: r }); setPaso(3); }} />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 4, backgroundColor: C.surface3, marginHorizontal: 18, borderRadius: 2, marginTop: 8 }}>
        <View style={{ height: 4, width: `${((paso + 1) / 4) * 100}%`, backgroundColor: C.accent, borderRadius: 2 }} />
      </View>
      <ScrollView key={paso} style={{ flex: 1 }} contentContainerStyle={{ padding: 18, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {paso === 0 && (
          <View style={{ gap: 14, paddingTop: 30 }}>
            <Text style={{ fontSize: 13, color: C.muted }}>Paso 1 de 4</Text>
            <Text style={[u.h1, { fontSize: 34 }]}>{primero ? 'Bienvenido a Kalo' : 'Nuevo perfil'}</Text>
            <Text style={u.soft}>Con tu estatura, peso, edad y cómo es tu día calculamos cuántas calorías gasta tu cuerpo y cuántas te tocan para llegar a tu meta.</Text>
            <Text style={u.soft}>Después puedes agregar a otras personas de tu familia, cada una con sus propios datos.</Text>
          </View>
        )}

        {paso === 1 && (
          <>
            <Text style={{ fontSize: 13, color: C.muted }}>Paso 2 de 4</Text>
            <Text style={u.h1}>Tus datos</Text>
            <Campo etiqueta="Nombre" value={d.nombre} onChangeText={v => set({ nombre: v })} placeholder="¿Cómo te llamas?" autoCapitalize="words" />
            <FechaNacimiento valor={nac} onCambio={setNac} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Campo etiqueta="Estatura" unidad="cm" value={txt.estatura} onChangeText={v => num('estatura', v)} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Campo etiqueta="Peso actual" unidad="kg" value={txt.peso} onChangeText={v => num('peso', v)} keyboardType="decimal-pad" /></View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={u.label}>Sexo biológico (cambia el cálculo del metabolismo)</Text>
              <Segmento<Sexo> opciones={[['F', 'Mujer'], ['M', 'Hombre']]} valor={d.sexo} onCambio={v => set({ sexo: v })} />
            </View>
          </>
        )}

        {paso === 3 && (
          <>
            <Text style={{ fontSize: 13, color: C.muted }}>Paso 4 de 4</Text>
            <Text style={u.h1}>Tu meta</Text>
            <Segmento<Meta> opciones={[['bajar', 'Bajar'], ['mantener', 'Mantener'], ['subir', 'Subir']]} valor={d.meta}
              onCambio={v => set({ meta: v, pesoMeta: v === 'mantener' ? d.peso : v === 'bajar' ? Math.min(d.pesoMeta, d.peso - 1) : Math.max(d.pesoMeta, d.peso + 1) })} />
            {d.meta !== 'mantener' && (
              <View style={[u.card, { gap: 10 }]}>
                <Stepper etiqueta="Peso meta" valor={fq(d.pesoMeta)} unidad="kg" menos={() => set({ pesoMeta: d.pesoMeta - 0.5 })} mas={() => set({ pesoMeta: d.pesoMeta + 0.5 })} />
                <Text style={u.label}>Ritmo por semana</Text>
                <Chips<string> opciones={[['0.25', '0,25 kg'], ['0.5', '0,5 kg'], ['0.75', '0,75 kg']]} valor={String(d.ritmo)} onCambio={v => set({ ritmo: Number(v) })} />
              </View>
            )}
            <Text style={[u.soft, { fontSize: 14 }]}>Tu cuerpo gasta unas <Text style={{ color: C.text, fontWeight: '700' }}>{fmt(en.total)} kcal</Text> al día, según tu día.</Text>
            <View style={{ backgroundColor: C.accent, borderRadius: 22, padding: 18, gap: 4 }}>
              <Text style={{ color: C.onAccent, fontSize: 13 }}>Come al día</Text>
              <Text style={{ color: C.onAccent, fontSize: 40, fontWeight: '700', letterSpacing: -1.2 }}>{fmt(en.objetivo)} kcal</Text>
              <Text style={{ color: C.onAccent, fontSize: 14 }}>
                {d.meta === 'mantener' ? 'Para mantener tu peso actual.'
                  : `Llegarías a ${fq(d.pesoMeta)} kg hacia el ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()} (${semanas} semanas).`}
              </Text>
            </View>
          </>
        )}

      </ScrollView>
      {/* Botones fijos abajo: siempre a la vista */}
      <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: C.divider, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        {error && <Text style={u.error}>{error}</Text>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(paso > 0 || onCancelar) && (
            <View style={{ flex: 1 }}><Boton texto={paso === 0 ? 'Cancelar' : 'Atrás'} tipo="borde" onPress={() => (paso === 0 ? onCancelar?.() : setPaso(paso - 1))} /></View>
          )}
          <View style={{ flex: 2 }}><Boton texto={paso === 3 ? 'Crear perfil' : paso === 0 ? 'Empezar' : 'Continuar'} onPress={siguiente} cargando={guardando} /></View>
        </View>
      </View>
    </View>
  );
}
