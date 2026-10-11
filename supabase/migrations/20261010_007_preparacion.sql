-- Kalo · tiempo y dificultad de preparación de cada opción de comida
alter table public.opciones add column if not exists tiempo_min int check (tiempo_min between 0 and 600);
alter table public.opciones add column if not exists dificultad text check (dificultad in ('facil','media','dificil'));
