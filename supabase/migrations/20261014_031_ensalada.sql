-- Kalo · «Ensalada a tu gusto»: un ítem del plan puede tener nombre propio («Ensalada de la casa»)
-- y el alimento «ensalada» no aporta nada por sí solo: todo va en sus añadidos (las verduras y el aliño)
alter table public.plan_items add column if not exists nombre text;
insert into public.alimentos (id, nombre, sinonimos, categoria, fuente, por_100g, porcion_base, porciones, foto_url, busqueda)
select 'ensalada', 'Ensalada a tu gusto', array['ensalada', 'armar ensalada', 'mi ensalada']::text[], 'verduras',
  'Kalo: se arma con las verduras y el aliño que trae', '{"kcal": 0, "proteina_g": 0, "carbos_g": 0, "grasa_g": 0}'::jsonb,
  '{"texto": "1 ensalada", "gramos": 0}'::jsonb, '[{"texto": "1 ensalada", "gramos": 0}]'::jsonb,
  (select foto_url from public.alimentos where id = 'ensalada-mixta'), 'ensalada a tu gusto ensalada armar ensalada mi ensalada'
on conflict (id) do update set nombre = excluded.nombre, sinonimos = excluded.sinonimos, fuente = excluded.fuente, por_100g = excluded.por_100g,
  porcion_base = excluded.porcion_base, porciones = excluded.porciones, foto_url = excluded.foto_url, busqueda = excluded.busqueda;
