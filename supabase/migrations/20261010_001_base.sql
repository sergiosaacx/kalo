-- Kalo · esquema base (handoff › Modelo de datos sugerido)
-- Alimentos y menús de Kalo: lectura pública. Datos de cada familia: solo su cuenta.

-- ── Alimentos ──────────────────────────────────────────────
create table if not exists public.alimentos (
  id          text primary key,
  nombre      text not null,
  sinonimos   text[] not null default '{}',
  categoria   text not null check (categoria in ('frutas','verduras','carbohidratos','proteinas','lacteos','grasas','bebidas')),
  fuente      text not null,             -- p. ej. 'USDA sr_legacy · 173944' o 'Receta Kalo'
  por_100g    jsonb not null,            -- kcal, proteina_g, carbos_g, grasa_g, fibra_g, azucar_g, sodio_mg, vitaminas y minerales
  porciones   jsonb not null default '[]', -- [{texto, gramos}]
  porcion_base jsonb,                    -- {texto, gramos}: la que se muestra por defecto
  foto_url    text,
  busqueda    text not null default '',     -- nombre + sinónimos en minúscula y sin tildes (lo llena la carga)
  creado      timestamptz not null default now()
);

-- ── Perfiles (varios por cuenta: familia) ──────────────────
create table if not exists public.perfiles (
  id              uuid primary key default gen_random_uuid(),
  cuenta_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  nombre          text not null,
  edad            int  not null check (edad between 1 and 120),
  sexo            text not null check (sexo in ('F','M')),
  estatura_cm     numeric not null,
  peso_kg         numeric not null,
  peso_inicial_kg numeric not null,
  meta            text not null default 'mantener' check (meta in ('bajar','mantener','subir')),
  peso_meta_kg    numeric not null,
  ritmo_kg_semana numeric not null default 0.5 check (ritmo_kg_semana in (0.25, 0.5, 0.75)),
  trabajo         text not null default 'sentado' check (trabajo in ('sentado','pie','fisico')),
  pasos_dia       int not null default 6000,
  ejercicio_min   int not null default 20,
  sueno_h         numeric not null default 7,
  color           text not null default '#E8774A',
  activo          boolean not null default false,
  creado          timestamptz not null default now()
);
create index if not exists perfiles_cuenta on public.perfiles(cuenta_id);

create table if not exists public.registros_peso (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  fecha      date not null default current_date,
  peso_kg    numeric not null,
  unique (perfil_id, fecha)
);

-- ── Opciones de comida (menús) ─────────────────────────────
-- cuenta_id null + fuente 'kalo' = menú de Kalo (p. ej. menús colombianos), visible para todos
create table if not exists public.opciones (
  id         uuid primary key default gen_random_uuid(),
  cuenta_id  uuid references auth.users(id) on delete cascade,
  comida     text not null check (comida in ('des','alm','cena','snack')),
  nombre     text not null,
  fuente     text not null default 'mia' check (fuente in ('kalo','mia','ia')),
  descripcion text,
  creado     timestamptz not null default now(),
  check ((fuente = 'kalo') = (cuenta_id is null))
);
create index if not exists opciones_cuenta on public.opciones(cuenta_id);

create table if not exists public.opcion_items (
  opcion_id   uuid not null references public.opciones(id) on delete cascade,
  alimento_id text not null references public.alimentos(id),
  cantidad    numeric not null default 1 check (cantidad > 0), -- en porciones base
  orden       int not null default 0,
  primary key (opcion_id, alimento_id)
);

-- ── Plan diario (por perfil) ───────────────────────────────
create table if not exists public.plan (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  fecha      date not null,
  comida     text not null check (comida in ('des','alm','cena','snack')),
  opcion_id  uuid references public.opciones(id) on delete set null,
  nombre     text,
  unique (perfil_id, fecha, comida)
);

-- Copia editable de la opción: editar el día no cambia la opción original
create table if not exists public.plan_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plan(id) on delete cascade,
  alimento_id text not null references public.alimentos(id),
  cantidad    numeric not null default 1 check (cantidad > 0),
  comido      boolean not null default false,
  comido_en   timestamptz,
  orden       int not null default 0
);
create index if not exists plan_items_plan on public.plan_items(plan_id);

create table if not exists public.avisos (
  perfil_id  uuid primary key references public.perfiles(id) on delete cascade,
  activos    boolean not null default true,
  des        time not null default '07:00',
  alm        time not null default '12:30',
  cena       time not null default '19:00',
  snack      time not null default '16:00'
);

-- ── Seguridad (RLS) ────────────────────────────────────────
alter table public.alimentos       enable row level security;
alter table public.perfiles        enable row level security;
alter table public.registros_peso  enable row level security;
alter table public.opciones        enable row level security;
alter table public.opcion_items    enable row level security;
alter table public.plan            enable row level security;
alter table public.plan_items      enable row level security;
alter table public.avisos          enable row level security;

-- ¿El perfil es de mi cuenta?
create or replace function public.es_mi_perfil(p uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.perfiles where id = p and cuenta_id = auth.uid()) $$;

create policy "alimentos: todos leen" on public.alimentos for select using (true);

create policy "perfiles: mi cuenta" on public.perfiles for all
  using (cuenta_id = auth.uid()) with check (cuenta_id = auth.uid());

create policy "peso: mis perfiles" on public.registros_peso for all
  using (public.es_mi_perfil(perfil_id)) with check (public.es_mi_perfil(perfil_id));

create policy "opciones: leo las de Kalo y las mías" on public.opciones for select
  using (cuenta_id is null or cuenta_id = auth.uid());
create policy "opciones: escribo las mías" on public.opciones for insert with check (cuenta_id = auth.uid());
create policy "opciones: edito las mías" on public.opciones for update using (cuenta_id = auth.uid()) with check (cuenta_id = auth.uid());
create policy "opciones: borro las mías" on public.opciones for delete using (cuenta_id = auth.uid());

create policy "opcion_items: leo" on public.opcion_items for select
  using (exists (select 1 from public.opciones o where o.id = opcion_id and (o.cuenta_id is null or o.cuenta_id = auth.uid())));
create policy "opcion_items: escribo las mías" on public.opcion_items for all
  using (exists (select 1 from public.opciones o where o.id = opcion_id and o.cuenta_id = auth.uid()))
  with check (exists (select 1 from public.opciones o where o.id = opcion_id and o.cuenta_id = auth.uid()));

create policy "plan: mis perfiles" on public.plan for all
  using (public.es_mi_perfil(perfil_id)) with check (public.es_mi_perfil(perfil_id));

create policy "plan_items: mis perfiles" on public.plan_items for all
  using (exists (select 1 from public.plan p where p.id = plan_id and public.es_mi_perfil(p.perfil_id)))
  with check (exists (select 1 from public.plan p where p.id = plan_id and public.es_mi_perfil(p.perfil_id)));

create policy "avisos: mis perfiles" on public.avisos for all
  using (public.es_mi_perfil(perfil_id)) with check (public.es_mi_perfil(perfil_id));

-- El proyecto no expone tablas solo: acceso explícito
grant usage on schema public to anon, authenticated;
grant select on public.alimentos, public.opciones, public.opcion_items to anon, authenticated;
grant insert, update, delete on public.opciones, public.opcion_items to authenticated;
grant select, insert, update, delete on public.perfiles, public.registros_peso, public.plan, public.plan_items, public.avisos to authenticated;
grant execute on function public.es_mi_perfil(uuid) to authenticated;
