// Pesos anotados de un perfil (public.registros_peso: uno por día; anotar dos veces el mismo día deja el último)
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RegistroPeso } from '../logic/peso';

export function usePesos(perfilId: string | undefined) {
  const [lista, setLista] = useState<RegistroPeso[] | null>(null);

  const cargar = useCallback(async () => {
    if (!perfilId) return;
    const { data } = await supabase.from('registros_peso').select('fecha, peso_kg').eq('perfil_id', perfilId).order('fecha');
    setLista(((data ?? []) as { fecha: string; peso_kg: number }[]).map(r => ({ fecha: r.fecha, peso: Number(r.peso_kg) })));
  }, [perfilId]);

  useEffect(() => { setLista(null); cargar(); }, [cargar]);

  const guardar = useCallback(async (fecha: string, peso: number) => {
    if (!perfilId) return 'Sin perfil.';
    const { error } = await supabase.from('registros_peso')
      .upsert({ perfil_id: perfilId, fecha, peso_kg: peso }, { onConflict: 'perfil_id,fecha' });
    if (error) return 'No pudimos guardar el peso. Revisa tu conexión e inténtalo de nuevo.';
    await cargar();
    return null;
  }, [perfilId, cargar]);

  return { lista, guardar };
}
