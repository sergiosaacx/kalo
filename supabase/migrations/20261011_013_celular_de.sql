-- Kalo · «Este celular es de…»: cada celular de la cuenta puede quedar asignado a un perfil.
-- Las notificaciones de un perfil van solo a sus celulares (y a los que no tienen dueño).
alter table public.suscripciones_push add column if not exists perfil_id uuid references public.perfiles(id) on delete set null;

drop policy if exists "suscripciones propias" on public.suscripciones_push;
create policy "suscripciones propias" on public.suscripciones_push
  for all using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid() and (perfil_id is null or public.es_mi_perfil(perfil_id)));

grant update (perfil_id) on public.suscripciones_push to authenticated;
