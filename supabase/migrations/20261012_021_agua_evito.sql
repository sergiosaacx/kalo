-- Kalo · agua del día y «Lo que evito» (alergias, lo que no quiere que le recomienden, lo que prefiere)
create table if not exists public.agua (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  ml integer not null,              -- un vaso = 250; quitar un vaso guarda −250
  creado timestamptz not null default now()
);
create index if not exists agua_perfil_fecha on public.agua (perfil_id, fecha);
alter table public.agua enable row level security;
drop policy if exists "agua: mis perfiles" on public.agua;
create policy "agua: mis perfiles" on public.agua for all using (public.es_mi_perfil(perfil_id)) with check (public.es_mi_perfil(perfil_id));
grant select, insert, update, delete on public.agua to authenticated;
grant usage, select on sequence public.agua_id_seq to authenticated;
grant all on public.agua to service_role;

alter table public.perfiles add column if not exists agua_meta integer;            -- ml/día; null = 35 ml por kilo
alter table public.perfiles add column if not exists recordar_agua boolean not null default false;
alter table public.perfiles add column if not exists evito jsonb;                  -- { alergias:[], evito:[], prefiero:[], alergiaAlimentos:[], evitoAlimentos:[] }

-- Recordatorios de agua cada 2 horas (agua8 … agua20)
alter table public.recordatorios drop constraint if exists recordatorios_momento_check;
alter table public.recordatorios add constraint recordatorios_momento_check
  check (momento in ('des','media','alm','snack','cena','peso','agua8','agua10','agua12','agua14','agua16','agua18','agua20'));
