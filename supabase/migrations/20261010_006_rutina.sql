-- Kalo · «Tu día»: la rutina de cada perfil (sueño, trabajos, transporte, casa, ejercicio) para calcular el gasto
alter table public.perfiles add column if not exists rutina jsonb;
