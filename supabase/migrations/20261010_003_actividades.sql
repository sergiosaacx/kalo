-- Kalo · catálogo de actividades (Compendio de Actividades Físicas) y lo que la gente escribe en «Otro»

create table if not exists public.actividades (
  id         text primary key,
  tipo       text not null check (tipo in ('trabajo','ejercicio')),
  nombre     text not null,
  met        numeric not null,        -- exigencia típica (para ejercicio: intensidad moderada)
  sinonimos  text[] not null default '{}'
);

-- Respuestas de la IA guardadas: el mismo texto nunca se consulta dos veces
create table if not exists public.actividades_ia (
  texto      text not null,           -- en minúscula y sin tildes
  tipo       text not null check (tipo in ('trabajo','ejercicio')),
  actividad_id text references public.actividades(id),
  met        numeric not null,
  nombre     text not null,           -- cómo la nombró la IA
  confianza  text not null,
  modelo     text not null,
  creado     timestamptz not null default now(),
  primary key (texto, tipo)
);

-- Todo lo que se escribe en «Otro», para ver qué falta en las listas
create table if not exists public.actividades_escritas (
  id         bigint generated always as identity primary key,
  texto      text not null,
  tipo       text not null,
  resuelto_por text not null,         -- 'catalogo' | 'ia' | 'intensidad'
  creado     timestamptz not null default now()
);

alter table public.actividades enable row level security;
alter table public.actividades_ia enable row level security;
alter table public.actividades_escritas enable row level security;

create policy "actividades: todos leen" on public.actividades for select using (true);
create policy "actividades_ia: todos leen" on public.actividades_ia for select using (true);
-- actividades_escritas y actividades_ia solo las escribe la función del servidor (service role)

grant select on public.actividades, public.actividades_ia to anon, authenticated;
