-- Kalo · fecha de nacimiento en lugar de pedir la edad (la edad se calcula sola)
alter table public.perfiles add column if not exists fecha_nacimiento date;
