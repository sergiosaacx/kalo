import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LetreroNotificaciones } from './src/components/Notificaciones';
import { estadoNotif, sincronizarNotificaciones, yaPreguntado } from './src/data/notificaciones';
import { MOMENTOS, esMomento, pendienteDeHoy, type Momento } from './src/data/comidas';
import { hoyISO, type ComidaId } from './src/data/plan';
import { Pregunta } from './src/screens/Pregunta';
import { SesionProvider, useSesion } from './src/data/sesion';
import { Alimentos } from './src/screens/Alimentos';
import { Entrar } from './src/screens/Entrar';
import { Gasto } from './src/screens/Gasto';
import { Menu } from './src/screens/Menu';
import { Hoy } from './src/screens/Hoy';
import { Onboarding } from './src/screens/Onboarding';
import { Perfil } from './src/screens/Perfil';
import { TuDia } from './src/screens/TuDia';
import { C } from './src/theme';

const SIMULACRO = Platform.OS === 'web' && typeof window !== 'undefined' && /[?&]simulacro\b/.test(window.location.search);

const TABS = [['hoy', 'Hoy'], ['menu', 'Menú'], ['alimentos', 'Alimentos'], ['gasto', 'Gasto'], ['perfil', 'Perfil']] as const;

export default function App() {
  return (
    <SafeAreaProvider>
      <SesionProvider>
        <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <Raiz />
        </SafeAreaView>
      </SesionProvider>
    </SafeAreaProvider>
  );
}

function Raiz() {
  const { cargando, sesion, perfiles, activo, actualizarPerfil, activar } = useSesion();
  const [tab, setTab] = useState<string>('hoy');
  const [destino, setDestino] = useState<ComidaId | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [editandoDia, setEditandoDia] = useState(false);
  // Letrero de notificaciones: una vez por celular, si en este celular aún no se ha respondido
  const [letrero, setLetrero] = useState(false);
  const listo = !!sesion && perfiles.length > 0;
  useEffect(() => {
    if (!listo) return;
    sincronizarNotificaciones();
    if (estadoNotif() === 'preguntar' && !yaPreguntado()) setLetrero(true);
  }, [listo]);

  // «¿Ya desayunaste?»: la abre la notificación (Kalo cerrada: viene en la dirección; abierta: aviso del service worker)
  // o, al abrir Kalo, la comida que se preguntó hoy y quedó sin responder
  const [pregunta, setPregunta] = useState<{ momento: Momento; fecha: string; perfilId?: string } | null>(null);
  const [registro, setRegistro] = useState<{ momento: Momento; fecha: string; abrirBandeja: boolean } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!listo || Platform.OS !== 'web') return;
    const q = new URLSearchParams(window.location.search);
    const m = q.get('registrar');
    if (esMomento(m)) {
      setPregunta({ momento: m, fecha: q.get('fecha') ?? hoyISO(), perfilId: q.get('perfil') ?? undefined });
      window.history.replaceState(null, '', window.location.pathname);
    } else if (activo) {
      pendienteDeHoy(activo.id, hoyISO()).then(p => p && setPregunta(x => x ?? { momento: p, fecha: hoyISO(), perfilId: activo.id }));
    }
    const oir = (e: MessageEvent) => {
      const d = e.data as { tipo?: string; url?: string };
      if (d?.tipo !== 'registrar' || !d.url) return;
      const u = new URL(d.url, window.location.href).searchParams;
      const mm = u.get('registrar');
      if (esMomento(mm)) { setRegistro(null); setPregunta({ momento: mm, fecha: u.get('fecha') ?? hoyISO(), perfilId: u.get('perfil') ?? undefined }); }
    };
    navigator.serviceWorker?.addEventListener('message', oir);
    navigator.serviceWorker?.startMessages?.();
    return () => navigator.serviceWorker?.removeEventListener('message', oir);
  }, [listo]);
  // La notificación es de un perfil: si es otro de la familia, queda activo ese
  useEffect(() => {
    if (pregunta?.perfilId && activo && pregunta.perfilId !== activo.id && perfiles.some(p => p.id === pregunta.perfilId)) activar(pregunta.perfilId);
  }, [pregunta?.perfilId]);
  useEffect(() => { if (aviso) { const t = setTimeout(() => setAviso(null), 5000); return () => clearTimeout(t); } }, [aviso]);

  // …/kalo/?simulacro: el cuestionario «Tu día» para probarlo sin cuenta (no guarda nada)
  if (SIMULACRO) return <TuDia />;
  if (cargando) return <View style={s.centro}><ActivityIndicator color={C.accent} /></View>;
  if (!sesion) return <Entrar />;
  if (perfiles.length === 0) return <Onboarding primero />;
  if (nuevo) return <Onboarding primero={false} onCancelar={() => setNuevo(false)} onCreado={() => { setNuevo(false); setDestino(null); setTab('hoy'); }} />;
  // «Tu día» a pantalla completa desde la pestaña Gasto: al terminar se guarda en el perfil
  if (editandoDia && activo) {
    return (
      <TuDia base={{ edad: activo.edad, estatura: activo.estatura, peso: activo.peso, sexo: activo.sexo }} inicial={activo.rutina}
        textoListo="Guardar" onSalir={() => setEditandoDia(false)}
        onListo={async r => { await actualizarPerfil(activo.id, { rutina: r }); setEditandoDia(false); }} />
    );
  }

  const irA = (t: string) => { setDestino(null); setRegistro(null); setPregunta(null); setTab(t); };
  const anotar = (abrirBandeja: boolean) => {
    if (!pregunta) return;
    setRegistro({ momento: pregunta.momento, fecha: pregunta.fecha, abrirBandeja });
    setDestino(MOMENTOS[pregunta.momento].comida);
    setPregunta(null);
    setTab('alimentos');
  };
  return (
    <>
      {/* Alimentos lleva su propio scroll para dejar la bandeja fija abajo */}
      {pregunta ? (
        <ScrollView key="pregunta" style={{ flex: 1 }} contentContainerStyle={s.scroll}>
          <Pregunta momento={pregunta.momento} fecha={pregunta.fecha} onOpcion={() => anotar(true)} onOtra={() => anotar(false)} onCerrar={() => setPregunta(null)} />
        </ScrollView>
      ) : tab === 'alimentos' ? (
        <Alimentos key={(destino ?? '') + (registro?.momento ?? '')} destino={destino} registro={registro} abrirBandeja={registro?.abrirBandeja}
          onAgregado={a => { irA('hoy'); if (a) setAviso(a); }} />
      ) : (
      <ScrollView key={tab + (destino ?? '')} style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {aviso && tab === 'hoy' && <Text style={s.aviso}>{aviso}</Text>}
        {tab === 'hoy' ? (
          <Hoy irA={irA} agregarA={c => { setDestino(c); setTab('alimentos'); }} />
        ) : tab === 'menu' ? (
          <Menu />
        ) : tab === 'gasto' ? (
          <Gasto cambiarDia={() => setEditandoDia(true)} />
        ) : tab === 'perfil' ? (
          <Perfil nuevoPerfil={() => setNuevo(true)} />
        ) : (
          <View style={s.pronto}>
            <Text style={s.prontoTit}>{TABS.find(t => t[0] === tab)?.[1]}</Text>
            <Text style={s.prontoTxt}>Esta pantalla llega en las próximas entregas.</Text>
          </View>
        )}
      </ScrollView>
      )}
      <SafeAreaView edges={['bottom']} style={s.tabbar}>
        <View style={s.tabs}>
          {TABS.map(([id, label]) => {
            const on = tab === id;
            return (
              <Pressable key={id} onPress={() => irA(id)} style={s.tab}>
                <View style={[s.tabMark, { backgroundColor: on ? C.accent : 'transparent' }]} />
                <Text style={[s.tabTxt, { color: on ? C.text : C.muted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
      {letrero && <LetreroNotificaciones onCerrar={() => setLetrero(false)} />}
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28, width: '100%', maxWidth: 520, alignSelf: 'center' },
  pronto: { paddingTop: 60, gap: 8 },
  aviso: { backgroundColor: '#141A0E', borderWidth: 1, borderColor: C.success, color: C.success, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, fontWeight: '700', marginBottom: 12, overflow: 'hidden' },
  prontoTit: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.56 },
  prontoTxt: { fontSize: 15, color: C.soft },
  tabbar: { backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.divider },
  tabs: { flexDirection: 'row', width: '100%', maxWidth: 520, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 0, paddingBottom: 10, minHeight: 52 },
  tabMark: { width: 24, height: 4, borderRadius: 2 },
  tabTxt: { fontSize: 12, fontWeight: '600' },
});
