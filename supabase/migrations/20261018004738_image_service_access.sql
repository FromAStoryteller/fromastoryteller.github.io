begin;
-- INVOKER API wrappers also require schema USAGE for the trusted service role.
grant usage on schema private to service_role;
-- pg_net creates its objects in net. Use extensions as its metadata schema so
-- no extension is advertised in the public API schema.
-- This is the pg_net installation introduced by image_cleanup_schedule; the
-- extension was absent from both FAS projects before this rollout. There are no
-- third-party net jobs. Outstanding maintenance HTTP requests may be retried.
do $$begin
 if exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where extname='pg_net' and n.nspname='public') then
  execute 'drop extension pg_net';
  execute 'create extension pg_net with schema extensions';
 end if;
 if exists(select 1 from pg_namespace where nspname='net') then
  execute 'revoke usage on schema net from public,anon,authenticated';
 end if;
end;$$;
commit;
