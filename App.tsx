import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ComidaId } from './src/data/plan';
import { SesionProvider, useSesion } from './src/data/sesion';
import { Alimentos } from './src/screens/Alimentos';
import { Entrar } from './src/screens/Entrar';
import { Hoy } from './src/screens/Hoy';
import { Onboarding } from './src/screens/Onboarding';
import { Perfil } from './src/screens/Perfil';
import { C } from './src/theme';

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
  const { cargando, sesion, perfiles } = useSesion();
  const [tab, setTab] = useState<string>('hoy');
  const [destino, setDestino] = useState<ComidaId | null>(null);
  const [nuevo, setNuevo] = useState(false);

  if (cargando) return <View style={s.centro}><ActivityIndicator color={C.accent} /></View>;
  if (!sesion) return <Entrar />;
  if (perfiles.length === 0) return <Onboarding primero />;
  if (nuevo) return <Onboarding primero={false} onCancelar={() => setNuevo(false)} />;

  const irA = (t: string) => { setDestino(null); setTab(t); };
  return (
    <>
      <ScrollView key={tab + (destino ?? '')} style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {tab === 'hoy' ? (
          <Hoy irA={irA} agregarA={c => { setDestino(c); setTab('alimentos'); }} />
        ) : tab === 'alimentos' ? (
          <Alimentos destino={destino} onAgregado={() => irA('hoy')} />
        ) : tab === 'perfil' ? (
          <Perfil nuevoPerfil={() => setNuevo(true)} />
        ) : (
          <View style={s.pronto}>
            <Text style={s.prontoTit}>{TABS.find(t => t[0] === tab)?.[1]}</Text>
            <Text style={s.prontoTxt}>Esta pantalla llega en las próximas entregas.</Text>
          </View>
        )}
      </ScrollView>
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
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28, width: '100%', maxWidth: 520, alignSelf: 'center' },
  pronto: { paddingTop: 60, gap: 8 },
  prontoTit: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.56 },
  prontoTxt: { fontSize: 15, color: C.soft },
  tabbar: { backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.divider },
  tabs: { flexDirection: 'row', width: '100%', maxWidth: 520, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 0, paddingBottom: 10, minHeight: 52 },
  tabMark: { width: 24, height: 4, borderRadius: 2 },
  tabTxt: { fontSize: 12, fontWeight: '600' },
});
