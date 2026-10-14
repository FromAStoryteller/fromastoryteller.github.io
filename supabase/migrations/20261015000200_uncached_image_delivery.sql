begin;
-- All browser image delivery goes through fas-story-image, which rechecks RLS
-- and returns no-store bytes. Restrict direct downloads, listing and signing,
-- including author/staff sessions; trusted server/service_role is unaffected.
create policy fas_images_server_delivery_only on storage.objects as restrictive
for select to anon, authenticated using (bucket_id <> 'fas-story-images');
commit;
