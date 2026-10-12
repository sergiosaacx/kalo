-- Kalo · foto de perfil (subida o avatar de Kalo) y porción real de la gaseosa
alter table public.perfiles add column if not exists foto text;

-- Fotos de perfil: cada cuenta sube en su carpeta (cuenta/archivo); se ven por enlace
insert into storage.buckets (id, name, public) values ('fotos-perfil', 'fotos-perfil', true) on conflict (id) do nothing;
drop policy if exists "fotos-perfil: subir en mi carpeta" on storage.objects;
create policy "fotos-perfil: subir en mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos-perfil: cambiar las mías" on storage.objects;
create policy "fotos-perfil: cambiar las mías" on storage.objects for update to authenticated
  using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos-perfil: borrar las mías" on storage.objects;
create policy "fotos-perfil: borrar las mías" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text);

-- Nadie se toma «1 onza líquida» de gaseosa: la porción es un vaso
update public.alimentos set porcion_base = '{"texto":"1 vaso (250 ml)","gramos":250}'::jsonb,
  porciones = '[{"texto":"1 vaso (250 ml)","gramos":250},{"texto":"1 lata (350 ml)","gramos":350},{"texto":"1 botella personal (400 ml)","gramos":400},{"texto":"100 ml","gramos":100}]'::jsonb
where id in ('gaseosa', 'gaseosa-cero');
