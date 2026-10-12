-- Kalo · TEMPORAL: medidas de pantalla de cada celular para arreglar la barra de abajo en el iPhone 13 Pro Max
create table if not exists public.diagnostico_pantalla (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  datos jsonb not null,
  creado timestamptz not null default now()
);
alter table public.diagnostico_pantalla enable row level security;
drop policy if exists "diagnostico: el mío" on public.diagnostico_pantalla;
create policy "diagnostico: el mío" on public.diagnostico_pantalla for insert with check (usuario_id = auth.uid());
grant insert on public.diagnostico_pantalla to authenticated;
grant all on public.diagnostico_pantalla to service_role;
