-- Kalo · notificaciones: cada celular que aceptó queda suscrito (Web Push) a la cuenta que lo usa
create table if not exists public.suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  dispositivo text,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists suscripciones_push_usuario on public.suscripciones_push (usuario_id);

alter table public.suscripciones_push enable row level security;
drop policy if exists "suscripciones propias" on public.suscripciones_push;
create policy "suscripciones propias" on public.suscripciones_push
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

grant select, delete on public.suscripciones_push to authenticated;
grant all on public.suscripciones_push to service_role;

-- Guarda la suscripción de este celular para la cuenta actual.
-- Si el mismo celular estaba con otra cuenta, pasa a esta (un celular = una cuenta).
create or replace function public.guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  insert into suscripciones_push (usuario_id, endpoint, p256dh, auth, dispositivo)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_dispositivo, 200))
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth,
        dispositivo = excluded.dispositivo, actualizado = now();
end $$;
revoke all on function public.guardar_suscripcion(text, text, text, text) from public, anon;
grant execute on function public.guardar_suscripcion(text, text, text, text) to authenticated;
