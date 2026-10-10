import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Hoy } from './src/screens/Hoy';
import { C } from './src/theme';

const TABS = [['hoy', 'Hoy'], ['menu', 'Menú'], ['alimentos', 'Alimentos'], ['gasto', 'Gasto'], ['perfil', 'Perfil']] as const;

export default function App() {
  const [tab, setTab] = useState<string>('hoy');
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <ScrollView key={tab} style={{ flex: 1 }} contentContainerStyle={s.scroll}>
          {tab === 'hoy' ? (
            <Hoy irA={setTab} />
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
                <Pressable key={id} onPress={() => setTab(id)} style={s.tab}>
                  <View style={[s.tabMark, { backgroundColor: on ? C.accent : 'transparent' }]} />
                  <Text style={[s.tabTxt, { color: on ? C.text : C.muted }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
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
