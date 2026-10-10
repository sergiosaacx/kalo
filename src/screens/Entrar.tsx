import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Boton, Campo, u } from '../components/ui';
import { supabase } from '../lib/supabase';
import { C } from '../theme';

const LOGO = require('../../assets/marca/kalo-icono-1024.png');

// Mensajes de Supabase → español, con lo que hay que hacer
function traducir(msg: string) {
  if (/invalid login/i.test(msg)) return 'Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.';
  if (/already registered|already exists/i.test(msg)) return 'Ese correo ya tiene cuenta. Toca «Ya tengo cuenta» y entra con tu contraseña.';
  if (/password.*(short|least|characters)/i.test(msg)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/valid email|invalid.*email/i.test(msg)) return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
  if (/rate limit|too many/i.test(msg)) return 'Hiciste muchos intentos seguidos. Espera un minuto e inténtalo otra vez.';
  return 'No pudimos conectarnos. Revisa tu internet e inténtalo de nuevo.';
}

export function Entrar() {
  const [modo, setModo] = useState<'crear' | 'entrar'>('crear');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async () => {
    setError(null);
    const email = correo.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Escribe un correo válido, por ejemplo nombre@correo.com.');
    if (clave.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    setCargando(true);
    const { error: e } = modo === 'crear'
      ? await supabase.auth.signUp({ email, password: clave })
      : await supabase.auth.signInWithPassword({ email, password: clave });
    setCargando(false);
    if (e) setError(traducir(e.message));
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 28, maxWidth: 460, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Image source={LOGO} style={{ width: 84, height: 84, borderRadius: 20 }} />
          <Text style={{ fontSize: 40, fontWeight: '700', letterSpacing: -1.6, color: C.text }}>kalo</Text>
          <Text style={[u.soft, { textAlign: 'center' }]}>
            {modo === 'crear' ? 'Crea tu cuenta y la de tu familia para saber qué comes y cuánto te da cada alimento.' : 'Qué bueno verte otra vez.'}
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} placeholder="nombre@correo.com"
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
          <Campo etiqueta="Contraseña" value={clave} onChangeText={setClave} placeholder="Mínimo 8 caracteres"
            secureTextEntry autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} onSubmitEditing={enviar} />
          {error && <Text style={u.error}>{error}</Text>}
          <Boton texto={modo === 'crear' ? 'Crear cuenta' : 'Entrar'} onPress={enviar} cargando={cargando} />
        </View>

        <Pressable onPress={() => { setModo(m => (m === 'crear' ? 'entrar' : 'crear')); setError(null); }} style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: C.accent, fontSize: 15, fontWeight: '600' }}>
            {modo === 'crear' ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
