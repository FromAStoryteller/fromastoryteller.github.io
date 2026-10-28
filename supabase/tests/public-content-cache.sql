begin;
do $$
declare before_revision uuid; after_revision uuid; target text;
begin
 foreach target in array array['public.stories','public.story_assets','public.profiles','public.user_roles','private.file_content','private.fas_publishers','private.publishing_brand','private.account_deletion_jobs'] loop
  select public.fas_public_content_revision() into before_revision;
  -- No rows changed: exercise the statement trigger without touching fixtures.
  execute format('delete from %s where false',target);
  select public.fas_public_content_revision() into after_revision;
  if before_revision=after_revision or after_revision is null then raise exception 'Missing invalidation for %',target;end if;
 end loop;
 if has_table_privilege('anon','public.public_content_revision','update') or has_table_privilege('authenticated','public.public_content_revision','insert') or has_function_privilege('anon','private.invalidate_public_content()','execute') then raise exception 'Invalidation is writable by API roles';end if;
end;$$;
set local role anon;
select public.fas_public_content_revision();
reset role;
rollback;
