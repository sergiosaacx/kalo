-- Kalo · perfiles: un solo perfil activo por cuenta y avisos por defecto

-- Activa un perfil de mi cuenta y desactiva los demás
create or replace function public.activar_perfil(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.perfiles where id = p and cuenta_id = auth.uid()) then
    raise exception 'perfil no encontrado';
  end if;
  update public.perfiles set activo = (id = p) where cuenta_id = auth.uid();
end $$;
grant execute on function public.activar_perfil(uuid) to authenticated;

-- Al crear un perfil: avisos con horas por defecto y registro del peso inicial
create or replace function public.perfil_nuevo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.avisos (perfil_id) values (new.id) on conflict do nothing;
  insert into public.registros_peso (perfil_id, peso_kg) values (new.id, new.peso_kg) on conflict do nothing;
  return new;
end $$;
drop trigger if exists perfil_nuevo on public.perfiles;
create trigger perfil_nuevo after insert on public.perfiles for each row execute function public.perfil_nuevo();
