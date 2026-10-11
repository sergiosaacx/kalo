-- Kalo · «Mis comidas»: horario de cada perfil y recordatorios «¿Ya desayunaste?»
--   comidas: [{ id: 'des'|'media'|'alm'|'snack'|'cena', hora: 'HH:MM', on: bool }]  (null = horario por defecto)
--   recordar: si se mandan las notificaciones (apagado hasta que la persona lo prenda)
alter table public.perfiles add column if not exists comidas jsonb;
alter table public.perfiles add column if not exists recordar boolean not null default false;

-- Qué pasó con cada recordatorio del día: enviado, respondido, saltado («Hoy no…») o pospuesto (30 min)
create table if not exists public.recordatorios (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  momento text not null check (momento in ('des','media','alm','snack','cena')),
  estado text not null check (estado in ('enviado','respondido','saltado','pospuesto')),
  pospuesto_hasta timestamptz,
  actualizado timestamptz not null default now(),
  primary key (perfil_id, fecha, momento)
);
alter table public.recordatorios enable row level security;
drop policy if exists "recordatorios: mis perfiles" on public.recordatorios;
create policy "recordatorios: mis perfiles" on public.recordatorios for all
  using (public.es_mi_perfil(perfil_id)) with check (public.es_mi_perfil(perfil_id));
grant select, insert, update, delete on public.recordatorios to authenticated;
grant all on public.recordatorios to service_role;

-- Para revisar cada minuto a quién le toca (el envío lo hace la función «recordatorios»)
create extension if not exists pg_cron;
create extension if not exists pg_net;
