// TEMPORAL: guarda las medidas de pantalla que reporta cada celular (para arreglar la barra en el iPhone 13 Pro Max).
// No muestra nada. Se quita cuando la barra quede bien en todos.
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export function medirPantalla() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  setTimeout(async () => {
    try {
      const sonda = document.createElement('div');
      sonda.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      document.body.appendChild(sonda);
      const cs = getComputedStyle(sonda);
      const raiz = document.getElementById('root')?.getBoundingClientRect();
      const barra = document.getElementById('barra')?.getBoundingClientRect();
      const datos = {
        ua: navigator.userAgent,
        instalada: window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
        claseInstalada: document.documentElement.classList.contains('instalada'),
        alto: document.documentElement.style.getPropertyValue('--alto'),
        innerHeight: window.innerHeight, innerWidth: window.innerWidth, outerHeight: window.outerHeight,
        screen: [screen.width, screen.height], dpr: window.devicePixelRatio,
        visual: window.visualViewport ? [Math.round(window.visualViewport.width), Math.round(window.visualViewport.height), Math.round(window.visualViewport.offsetTop)] : null,
        docClient: document.documentElement.clientHeight,
        seguro: { arriba: cs.paddingTop, abajo: cs.paddingBottom },
        raiz: raiz ? [Math.round(raiz.top), Math.round(raiz.height)] : null,
        barra: barra ? [Math.round(barra.top), Math.round(barra.bottom), Math.round(barra.height)] : null,
      };
      sonda.remove();
      await supabase.from('diagnostico_pantalla').insert({ datos });
    } catch { /* es solo para medir */ }
  }, 2000);
}
