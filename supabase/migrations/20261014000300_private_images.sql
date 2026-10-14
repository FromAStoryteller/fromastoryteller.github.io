begin;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('fas-story-images', 'fas-story-images', false, 5242880, array['image/jpeg','image/png','image/webp']);
-- No public bucket: even published images use short-lived signed URLs or authenticated reads.
create policy fas_images_read on storage.objects for select to anon, authenticated using (
  bucket_id = 'fas-story-images' and exists (
    select 1 from public.story_assets a join public.stories s on s.id = a.story_id
    where a.object_path = name and (s.status = 'published' or s.author_id = (select auth.uid()) or (select private.is_staff()))
  ));
create policy fas_images_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'fas-story-images' and (select private.is_member()) and exists (
    select 1 from public.stories s where s.author_id = (select auth.uid()) and s.status in ('draft','rejected')
    and name ~ ('^' || s.author_id::text || '/' || s.id::text || '/[a-f0-9-]+\.(jpg|jpeg|png|webp)$')
  ));
-- Upload unique filenames with upsert:false. No browser UPDATE/DELETE policies:
-- replacing/removing an object could bypass review or race publication.
commit;
