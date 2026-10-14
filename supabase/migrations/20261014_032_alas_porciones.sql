-- Kalo · alas de pollo: la porción era «1 trozo» de 85 g de carne (más de dos alas enteras). Ahora va por partes reales, sin hueso:
-- ala entera 34 g (USDA: 1 ala asada sin hueso), alita (el muslito) 18 g, puntica 6 g (casi todo piel).
-- Lo ya anotado se convierte para que conserve sus gramos (cantidad va en porciones base).
update public.plan_items set cantidad = cantidad * 85.0 / 34.0 where alimento_id = 'alas-pollo';
update public.alimentos set
  porcion_base = '{"texto": "1 ala entera (sin hueso)", "gramos": 34}'::jsonb,
  porciones = '[{"texto": "1 ala entera (sin hueso)", "gramos": 34}, {"texto": "1 alita (el muslito del ala)", "gramos": 18}, {"texto": "1 puntica", "gramos": 6}, {"texto": "100 g", "gramos": 100}]'::jsonb,
  sinonimos = array['alitas', 'punticas de ala', 'puntas de ala'],
  busqueda = 'alas de pollo alitas punticas de ala puntas de ala'
where id = 'alas-pollo';
