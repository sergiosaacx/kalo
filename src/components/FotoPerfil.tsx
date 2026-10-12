import { createElement, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { supabase } from '../lib/supabase';
import { useSesion, type PerfilActivo } from '../data/sesion';
import { C } from '../theme';

// Avatares de Kalo (para quien no quiere subir foto): objetos de fuerza, salud y disciplina en 3D (aprobados 12-oct)
const BASE = 'https://sergiosaacx.github.io/kalo/avatares/';
export const AVATARES: { id: string; url: string }[] = ['pesa', 'corazon', 'mancuerna', 'rayo', 'reloj', 'diana', 'medalla', 'gota', 'latido', 'escudo', 'brujula', 'infinito']
  .map(id => ({ id, url: `${BASE}${id}.jpg` }));

// Reduce la foto a 256 × 256 (recorte cuadrado al centro) antes de subirla
async function achicar(archivo: File): Promise<Blob> {
  const img = await createImageBitmap(archivo);
  const lado = Math.min(img.width, img.height);
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 256;
  lienzo.getContext('2d')!.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
  return await new Promise<Blob>((ok, mal) => lienzo.toBlob(b => (b ? ok(b) : mal(new Error('sin imagen'))), 'image/jpeg', 0.85));
}

// En «Datos»: la foto grande y cómo cambiarla (subir una, escoger un avatar o volver a la inicial)
export function FotoPerfil({ p }: { p: PerfilActivo }) {
  const { sesion, actualizarPerfil } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subir = async (archivo: File) => {
    if (!sesion) return;
    setSubiendo(true); setError(null);
    try {
      const blob = await achicar(archivo);
      const ruta = `${sesion.user.id}/${p.id}-${Date.now()}.jpg`;
      const { error: e } = await supabase.storage.from('fotos-perfil').upload(ruta, blob, { contentType: 'image/jpeg', upsert: true });
      if (e) throw e;
      const { data } = supabase.storage.from('fotos-perfil').getPublicUrl(ruta);
      await actualizarPerfil(p.id, { foto: data.publicUrl });
      setAbierto(false);
    } catch {
      setError('No pudimos subir la foto. Revisa tu conexión e inténtalo de nuevo.');
    }
    setSubiendo(false);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar p={p} size={64} />
        <Pressable onPress={() => setAbierto(v => !v)} style={s.btn}><Text style={s.btnTxt}>{abierto ? 'Cerrar' : 'Cambiar foto'}</Text></Pressable>
      </View>
      {abierto && (
        <View style={{ gap: 10 }}>
          <View style={[s.btn, s.btnP, { alignSelf: 'stretch', alignItems: 'center' }]}>
            {subiendo ? <ActivityIndicator color={C.onAccent} /> : <Text style={[s.btnTxt, { color: C.onAccent }]}>Subir una foto</Text>}
            {Platform.OS === 'web' && !subiendo && createElement('input', {
              type: 'file', accept: 'image/*', 'aria-label': 'Subir una foto',
              onChange: (e: { target: { files?: FileList | null } }) => { const f = e.target.files?.[0]; if (f) subir(f); },
              style: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' },
            })}
          </View>
          {AVATARES.length > 0 && (
            <>
              <Text style={s.muted13}>O escoge un avatar</Text>
              <View style={s.grilla}>
                {AVATARES.map(a => (
                  <Pressable key={a.id} onPress={() => { actualizarPerfil(p.id, { foto: a.url }); setAbierto(false); }} style={[s.av, p.foto === a.url && { borderColor: C.accent }]}>
                    <Image source={{ uri: a.url }} style={{ width: '100%', height: '100%', borderRadius: 30 }} />
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {p.foto && <Pressable onPress={() => { actualizarPerfil(p.id, { foto: null }); setAbierto(false); }} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={s.link}>Quitar foto y usar mi inicial</Text></Pressable>}
          {error && <Text style={{ color: '#FF8A84', fontSize: 13 }}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { position: 'relative', minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: C.border, justifyContent: 'center', paddingHorizontal: 14 },
  btnP: { backgroundColor: C.accent, borderColor: C.accent, minHeight: 46 },
  btnTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  muted13: { fontSize: 13, color: C.muted },
  link: { fontSize: 14, fontWeight: '600', color: C.accent },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  av: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'transparent' },
});
