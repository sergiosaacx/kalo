// Tokens del handoff de Kalo. Los oklch del diseño van convertidos a hex
// porque React Native (iOS/Android) no entiende oklch.
export const C = {
  bg: '#0B0B0C',
  surface: '#17171A',
  surface2: '#212125',
  surface3: '#26262A',
  divider: '#232327',
  border: '#3A3A3E',
  text: '#F4F2EF',
  muted: '#8E8C88',
  soft: '#C9C6C0',
  accent: '#E8774A',
  accentLight: '#F0A07E',
  carbs: '#53B6EB', // oklch(0.74 0.12 235)
  fat: '#DEC358', // oklch(0.82 0.13 95)
  success: '#C0D67A', // oklch(0.84 0.12 120)
  onAccent: '#0B0B0C',
};

export const AVATAR_COLORS = [C.accent, '#7AC8F5', C.success, '#E9ADE3'];

export const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
