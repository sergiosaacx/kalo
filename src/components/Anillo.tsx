import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C } from '../theme';

// Anillo de 212 px con interior de 178 px (handoff › Hoy).
export function Anillo({ progreso, children }: { progreso: number; children: React.ReactNode }) {
  const size = 212, grosor = 17, r = (size - grosor) / 2, circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progreso));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.surface3} strokeWidth={grosor} fill="none" />
        {p > 0 && (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.accent} strokeWidth={grosor} fill="none"
            strokeDasharray={`${circ * p} ${circ}`} />
        )}
      </Svg>
      {children}
    </View>
  );
}
