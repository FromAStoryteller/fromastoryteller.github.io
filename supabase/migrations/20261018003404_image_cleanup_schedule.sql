begin;
create table private.image_cleanup_config(singleton boolean primary key default true check(singleton),base_url text not null check(base_url in ('https://oqmmvjjycpyxvxipcyli.supabase.co','https://vzdicnufhidelaoeqbza.supabase.co')));
create table private.image_cleanup_tokens(hash text primary key,expires_at timestamptz not null);
alter table private.image_cleanup_config enable row level security;
alter table private.image_cleanup_tokens enable row level security;
revoke all on private.image_cleanup_config,private.image_cleanup_tokens from public,anon,authenticated;
create function private.consume_cleanup_token(cleanup_token text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 delete from private.image_cleanup_tokens where hash=encode(sha256(convert_to(cleanup_token,'UTF8')),'hex') and expires_at>now();
 return found;
end;$$;
create function public.fas_consume_cleanup_token(cleanup_token text) returns boolean language sql set search_path='' as $$select private.consume_cleanup_token(cleanup_token);$$;
revoke all on function private.consume_cleanup_token(text),public.fas_consume_cleanup_token(text) from public,anon,authenticated;
grant execute on function private.consume_cleanup_token(text),public.fas_consume_cleanup_token(text) to service_role;
create function private.request_image_cleanup() returns bigint language plpgsql security definer set search_path='' as $$
declare token text:=gen_random_uuid()::text||gen_random_uuid()::text;project_url text;request_id bigint;
begin
 select base_url into project_url from private.image_cleanup_config where singleton;
 if project_url is null then return null;end if;
 delete from private.image_uploads u using private.image_cleanup c where u.path=c.path and c.done_at<now()-interval '30 days';
 delete from private.image_cleanup where done_at<now()-interval '30 days';
 delete from private.image_cleanup_tokens where expires_at<=now();
 insert into private.image_cleanup_tokens values(encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '2 minutes');
 -- The one-use short-lived token is not a Supabase API credential.
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=60000)'
 into request_id using project_url||'/functions/v1/fas-image-cleanup',jsonb_build_object('Content-Type','application/json','X-FAS-Cleanup',token),'{}'::jsonb;
 return request_id;
end;$$;
revoke all on function private.request_image_cleanup() from public,anon,authenticated;
-- The portable database tests don't ship these hosted-only extensions.
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_net') then execute 'create extension if not exists pg_net';end if;
 if exists(select 1 from pg_extension where extname='pg_cron') and exists(select 1 from pg_extension where extname='pg_net') then
  perform cron.schedule('fas-image-cleanup','*/5 * * * *','select private.request_image_cleanup();');
 end if;
end;$$;
commit;
