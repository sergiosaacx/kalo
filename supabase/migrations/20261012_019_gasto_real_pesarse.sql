-- Kalo · gasto real (medido con lo que se come y lo que se pesa) y recordatorio semanal de pesarse
alter table public.perfiles add column if not exists gasto_real integer;       -- kcal/día medidas; null = se usa la fórmula
alter table public.perfiles add column if not exists gasto_real_fecha date;    -- cuándo se aceptó
alter table public.perfiles add column if not exists pesarse jsonb;            -- { on: bool, dia: 0-6 (0 = domingo), hora: 'HH:MM' }

-- El recordatorio de pesarse usa la misma tabla de recordatorios, con momento «peso»
alter table public.recordatorios drop constraint if exists recordatorios_momento_check;
alter table public.recordatorios add constraint recordatorios_momento_check check (momento in ('des','media','alm','snack','cena','peso'));
