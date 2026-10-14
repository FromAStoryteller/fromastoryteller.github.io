-- READ ONLY. Inspect from the FAS SQL Editor before/after applying a migration.
-- No user records, keys, tokens, passwords or image bytes are selected.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('profiles','user_roles','invites','stories','story_assets','moderation_log');
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public' or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname;
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='fas-story-images';
select role_name,
  has_table_privilege(role_name,'public.user_roles','INSERT,UPDATE,DELETE') as can_write_roles,
  has_table_privilege(role_name,'public.invites','SELECT') as can_read_invites,
  has_column_privilege(role_name,'public.stories','author_id','UPDATE') as can_change_author,
  has_column_privilege(role_name,'public.story_assets','approved_at','UPDATE') as can_self_approve,
  has_table_privilege(role_name,'public.moderation_log','INSERT,UPDATE,DELETE') as can_write_audit
from (values ('anon'),('authenticated')) roles(role_name);
select n.nspname as schema_name,p.proname,p.prosecdef as security_definer,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and
p.proname in ('create_invite','accept_invite','revoke_invite','moderate_story',
'approve_story_image','is_member','is_staff','is_admin','new_profile','guard_story','guard_asset','clear_image_approval');
