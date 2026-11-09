-- Gestionale Lavoro · file del Setup aziendale (loghi, font, documenti)
--
-- Bucket privato: niente URL pubblici, il client usa URL firmati a scadenza.
-- Percorso dei file: <user_id>/<company_id>/<id>.<ext>. Le policy limitano ogni operazione
-- alla cartella dell'utente autenticato, come la RLS sulle tabelle.

insert into storage.buckets (id, name, public, file_size_limit)
values ('brand', 'brand', false, 26214400) -- 25 MB
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy brand_files_select_own on storage.objects for select to authenticated
  using (bucket_id = 'brand' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy brand_files_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'brand' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy brand_files_update_own on storage.objects for update to authenticated
  using (bucket_id = 'brand' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'brand' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy brand_files_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'brand' and (storage.foldername(name))[1] = (select auth.uid())::text);
