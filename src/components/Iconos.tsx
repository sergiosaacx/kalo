// Íconos de línea de la barra de abajo (opción E de la propuesta de la barra)
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { color: string; size?: number };
const base = (color: string) => ({ stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });

export const IconoHoy = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={8} {...base(color)} /><Path d="M12 7v5l3 2" {...base(color)} /></Svg>
);
export const IconoMenu = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x={4} y={5} width={16} height={15} rx={2.5} {...base(color)} /><Path d="M4 10h16M9 3v4M15 3v4" {...base(color)} /></Svg>
);
export const IconoGasto = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 .2 1.6 1 2.6 2 3 .3-3-1-5.5.5-8z" {...base(color)} /></Svg>
);
export const IconoPerfil = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx={12} cy={8.5} r={3.8} {...base(color)} /><Path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" {...base(color)} /></Svg>
);
export const IconoMas = ({ color, size = 26 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.4} strokeLinecap="round" /></Svg>
);
export const IconoCampana = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" {...base(color)} /><Path d="M10 20a2 2 0 0 0 4 0" {...base(color)} /></Svg>
);
