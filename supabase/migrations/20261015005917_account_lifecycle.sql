begin;
-- Cosmetic metadata may initialise a name; it never grants an account role.
create or replace function private.new_profile() returns trigger language plpgsql security definer
set search_path = '' as $$
declare display_name text := case when jsonb_typeof(new.raw_user_meta_data->'display_name')='string' then btrim(new.raw_user_meta_data->>'display_name') else '' end;
begin
  if char_length(display_name) not between 1 and 80 then display_name := 'Storyteller'; end if;
  insert into public.profiles(id,display_name) values(new.id,display_name);
  return new;
end; $$;
create table private.account_deletion_jobs (
  user_id uuid primary key,
  receipt_hash text not null check (receipt_hash ~ '^[a-f0-9]{64}$'),
  object_paths jsonb not null default '[]'::jsonb,
  state text not null default 'pending' check (state in ('pending','complete')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table private.account_deletion_intents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default now() + interval '5 minutes'
);
create index account_deletion_jobs_expiry on private.account_deletion_jobs(completed_at) where state='complete';
create index account_deletion_intents_expiry on private.account_deletion_intents(expires_at);
alter table private.account_deletion_jobs enable row level security;
alter table private.account_deletion_intents enable row level security;
revoke all on private.account_deletion_jobs, private.account_deletion_intents from public, anon, authenticated;
create table private.account_action_limits (
  user_id uuid references auth.users(id) on delete cascade,
  action_name text not null check(action_name in ('export','prepare-delete')),
  window_start timestamptz not null default now(),
  attempts integer not null default 1,
  primary key(user_id,action_name)
);
create index account_action_limits_expiry on private.account_action_limits(window_start);
alter table private.account_action_limits enable row level security;
revoke all on private.account_action_limits from public, anon, authenticated;

create function private.account_active(account_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select account_id is not null and not exists(select 1 from private.account_deletion_jobs where user_id = account_id);
$$;
revoke all on function private.account_active(uuid) from public, anon, authenticated;
grant execute on function private.account_active(uuid) to anon,authenticated;
create policy stories_lifecycle_visibility on public.stories as restrictive for select to anon,authenticated
using (private.account_active(author_id));
create policy profiles_lifecycle_visibility on public.profiles as restrictive for select to anon,authenticated
using (private.account_active(id) or id=(select auth.uid()));
create function public.fas_my_account_state() returns text
language sql stable security definer set search_path='' as $$
  select case when auth.uid() is null then 'guest' when private.account_active(auth.uid()) then 'active' else 'closing' end;
$$;
revoke all on function public.fas_my_account_state() from public,anon,authenticated;
grant execute on function public.fas_my_account_state() to authenticated;
create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.account_active((select auth.uid())) and exists(select 1 from public.user_roles where user_id = (select auth.uid()) and role in ('member','moderator','admin'));
$$;
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.account_active((select auth.uid())) and exists(select 1 from public.user_roles where user_id = (select auth.uid()) and role in ('moderator','admin'));
$$;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.account_active((select auth.uid())) and exists(select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin');
$$;
create policy profiles_lifecycle_update on public.profiles as restrictive for update to authenticated
using ((select private.account_active(auth.uid()))) with check ((select private.account_active(auth.uid())));
create function private.guard_closing_account_role() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  if not private.account_active(new.user_id) then raise exception 'Account is closing'; end if;
  return new;
end; $$;
revoke all on function private.guard_closing_account_role() from public, anon, authenticated;
create trigger fas_guard_closing_role before insert or update on public.user_roles
for each row execute function private.guard_closing_account_role();

create function private.require_account_session(target_user uuid, target_session uuid) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if not exists(select 1 from auth.sessions where id = target_session and user_id = target_user and (not_after is null or not_after > now())) then raise exception 'Active account session required'; end if;
end; $$;
revoke all on function private.require_account_session(uuid,uuid) from public, anon, authenticated;
create function public.fas_claim_account_action(target_user uuid,target_session uuid,requested_action text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare period interval; attempts integer;
begin
  perform private.require_account_session(target_user,target_session);
  if requested_action not in ('export','prepare-delete') then raise exception 'Invalid account action'; end if;
  period:=case when requested_action='export' then interval '1 minute' else interval '10 minutes' end;
  insert into private.account_action_limits(user_id,action_name) values(target_user,requested_action)
  on conflict(user_id,action_name) do update set
    attempts=case when private.account_action_limits.window_start<=now()-period then 1 else private.account_action_limits.attempts+1 end,
    window_start=case when private.account_action_limits.window_start<=now()-period then now() else private.account_action_limits.window_start end
  returning private.account_action_limits.attempts into attempts;
  return attempts<=5;
end; $$;
revoke all on function public.fas_claim_account_action(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fas_claim_account_action(uuid,uuid,text) to service_role;

create function public.fas_account_snapshot(target_user uuid, target_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  perform private.require_account_session(target_user,target_session);
  if not private.account_active(target_user) then raise exception 'Account is closing'; end if;
  if (select count(*) from (select 1 from public.stories where author_id=target_user limit 301) s)>300
    or (select coalesce(sum(octet_length(body)),0) from public.stories where author_id=target_user)>16777216
    or (select count(*) from (select 1 from public.story_assets a join public.stories s on s.id=a.story_id where s.author_id=target_user limit 501) a)>500
    or (select count(*) from (select 1 from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text limit 501) o)>500 then
    raise exception 'Account content requires background export';
  end if;
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where id = target_user),
    'role', coalesce((select role::text from public.user_roles where user_id = target_user),'viewer'),
    'stories', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.stories s where author_id = target_user),'[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'approved_by' order by a.id) from public.story_assets a join public.stories s on s.id = a.story_id where s.author_id = target_user),'[]'::jsonb),
    'objects', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'path',o.name,'size',o.metadata->>'size','type',o.metadata->>'mimetype','updated_at',o.updated_at) order by o.name) from storage.objects o where bucket_id = 'fas-story-images' and split_part(name,'/',1) = target_user::text),'[]'::jsonb)
  ) into payload;
  if payload->'profile' = 'null'::jsonb then raise exception 'Account unavailable'; end if;
  return jsonb_build_object('data',payload,'fingerprint',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end; $$;

create function public.fas_prepare_account_deletion(target_user uuid, target_session uuid, confirmation_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_account_session(target_user,target_session);
  if exists(select 1 from public.user_roles where user_id = target_user and role in ('moderator','admin')) then raise exception 'Staff accounts require a separate reviewed process'; end if;
  if confirmation_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid confirmation'; end if;
  delete from private.account_deletion_intents where expires_at <= now();
  insert into private.account_deletion_intents(user_id,session_id,token_hash) values(target_user,target_session,confirmation_hash)
  on conflict(user_id) do update set session_id=excluded.session_id,token_hash=excluded.token_hash,expires_at=now()+interval '5 minutes';
  return jsonb_build_object('stories',(select count(*) from public.stories where author_id=target_user),
    'published',(select count(*) from public.stories where author_id=target_user and status='published'),
    'images',(select count(*) from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text),
    'resume',exists(select 1 from private.account_deletion_jobs where user_id=target_user));
end; $$;

create function public.fas_begin_account_deletion(target_user uuid, target_session uuid, confirmation_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job private.account_deletion_jobs; paths jsonb;
begin
  -- Short transaction only: no network/Storage calls while these locks are held.
  lock table public.profiles, public.user_roles, public.stories, public.story_assets, public.moderation_log, storage.objects in share row exclusive mode;
  perform private.require_account_session(target_user,target_session);
  perform 1 from auth.users where id=target_user for update;
  perform 1 from public.profiles where id=target_user for update;
  if exists(select 1 from public.user_roles where user_id=target_user and role in ('moderator','admin')) then raise exception 'Staff accounts require a separate reviewed process'; end if;
  if exists(select 1 from public.story_assets a join public.stories s on s.id=a.story_id where a.approved_by=target_user and s.author_id<>target_user) then raise exception 'Prior staff approvals require review'; end if;
  if not exists(select 1 from private.account_deletion_intents where user_id=target_user and session_id=target_session and token_hash=confirmation_hash and expires_at>now()) then raise exception 'Fresh deletion confirmation required'; end if;
  select * into job from private.account_deletion_jobs where user_id=target_user;
  select coalesce(jsonb_agg(name order by name),'[]'::jsonb) into paths from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text;
  if job.user_id is not null then
    update private.account_deletion_jobs set receipt_hash=confirmation_hash,
      object_paths=(select coalesce(jsonb_agg(path order by path),'[]'::jsonb) from (select distinct jsonb_array_elements_text(job.object_paths || paths) as path) p),
      state='pending',completed_at=null where user_id=target_user returning * into job;
  else
    insert into private.account_deletion_jobs(user_id,receipt_hash,object_paths) values(target_user,confirmation_hash,paths) returning * into job;
  end if;
  delete from public.moderation_log where story_id in (select id from public.stories where author_id=target_user);
  delete from public.stories where author_id=target_user;
  delete from public.invites where accepted_by=target_user or email=(select lower(email) from auth.users where id=target_user);
  return to_jsonb(job);
end; $$;

create function public.fas_ack_account_files(target_user uuid,removed_paths text[]) returns void
language plpgsql security definer set search_path='' as $$ begin
  if cardinality(removed_paths)>100 then raise exception 'Invalid file acknowledgement'; end if;
  update private.account_deletion_jobs set object_paths=(
    select coalesce(jsonb_agg(path order by path),'[]'::jsonb) from jsonb_array_elements_text(object_paths) path
    where path<>all(removed_paths)) where user_id=target_user and state='pending';
end; $$;
revoke all on function public.fas_ack_account_files(uuid,text[]) from public,anon,authenticated;
grant execute on function public.fas_ack_account_files(uuid,text[]) to service_role;

create function public.fas_finish_account_deletion(target_user uuid) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if exists(select 1 from auth.users where id=target_user) or exists(select 1 from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text) then raise exception 'Account removal is unfinished'; end if;
  update private.account_deletion_jobs set state='complete',object_paths='[]'::jsonb,completed_at=now() where user_id=target_user;
end; $$;

create function public.fas_purge_account_deletion_records() returns void
language plpgsql security definer set search_path = '' as $$ begin
  delete from private.account_deletion_intents where expires_at<=now();
  delete from private.account_action_limits where window_start<now()-interval '1 day';
  delete from private.account_deletion_jobs where state='complete' and completed_at<now()-interval '30 days';
end; $$;
create function public.fas_account_deletion_status(target_user uuid, confirmation_hash text) returns text
language plpgsql security definer set search_path = '' as $$
declare job private.account_deletion_jobs;
begin
  select * into job from private.account_deletion_jobs where user_id=target_user and receipt_hash=confirmation_hash;
  if not found then return 'unknown'; end if;
  if not exists(select 1 from auth.users where id=target_user) and not exists(select 1 from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text) then
    update private.account_deletion_jobs set state='complete',object_paths='[]'::jsonb,completed_at=coalesce(completed_at,now()) where user_id=target_user;
    return 'complete';
  end if;
  return 'pending';
end; $$;
revoke all on function public.fas_account_deletion_status(uuid,text) from public, anon, authenticated;
grant execute on function public.fas_account_deletion_status(uuid,text) to service_role;
revoke all on function public.fas_account_snapshot(uuid,uuid), public.fas_prepare_account_deletion(uuid,uuid,text), public.fas_begin_account_deletion(uuid,uuid,text), public.fas_finish_account_deletion(uuid), public.fas_purge_account_deletion_records() from public, anon, authenticated;
grant execute on function public.fas_account_snapshot(uuid,uuid), public.fas_prepare_account_deletion(uuid,uuid,text), public.fas_begin_account_deletion(uuid,uuid,text), public.fas_finish_account_deletion(uuid), public.fas_purge_account_deletion_records() to service_role;
commit;
