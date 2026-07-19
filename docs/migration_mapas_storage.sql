-- Bucket público para plantas/mapas por base.
-- Execute no SQL Editor do Supabase (Storage).
-- Idempotente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mapas',
  'mapas',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública das plantas
drop policy if exists mapas_public_read on storage.objects;
create policy mapas_public_read
on storage.objects for select
to public
using (bucket_id = 'mapas');

-- Escrita/remoção via service role (API admin) — políticas authenticated opcionais
drop policy if exists mapas_authenticated_insert on storage.objects;
create policy mapas_authenticated_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'mapas'
  and public.is_admin()
);

drop policy if exists mapas_authenticated_update on storage.objects;
create policy mapas_authenticated_update
on storage.objects for update
to authenticated
using (bucket_id = 'mapas' and public.is_admin())
with check (bucket_id = 'mapas' and public.is_admin());

drop policy if exists mapas_authenticated_delete on storage.objects;
create policy mapas_authenticated_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'mapas' and public.is_admin());
