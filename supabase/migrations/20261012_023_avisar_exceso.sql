-- Aviso al celular cuando se pasa del tope de sodio, azúcar libre o grasa saturada del día
-- objetivo_kcal: lo guarda la app (la meta de calorías de hoy) para que el servidor calcule los topes igual que la pantalla
alter table public.perfiles add column if not exists avisar_exceso boolean not null default true;
alter table public.perfiles add column if not exists objetivo_kcal integer;

alter table public.recordatorios drop constraint if exists recordatorios_momento_check;
alter table public.recordatorios add constraint recordatorios_momento_check
  check (momento in ('des','media','alm','snack','cena','peso','agua8','agua10','agua12','agua14','agua16','agua18','agua20',
    'exceso_sodio','exceso_azucar','exceso_grasaSat'));
