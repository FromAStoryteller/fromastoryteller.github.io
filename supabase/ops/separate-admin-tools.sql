begin;
-- Preserve existing publishing rights while allowing independent future role changes.
alter table public.user_roles drop constraint user_roles_pkey;
alter table public.user_roles add primary key(user_id,role);
insert into public.user_roles(user_id,role) select user_id,'member' from public.user_roles where role in ('admin','moderator') on conflict do nothing;
create or replace function private.is_member() returns boolean language sql stable security definer set search_path='' as $$
 select private.account_active((select auth.uid())) and private.current_policies_accepted((select auth.uid()))
 and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='member');
$$;
create table private.admin_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null, subject_id uuid,
 details jsonb not null default '{}'::jsonb,
 reason text not null check(char_length(btrim(reason)) between 1 and 2000),
 created_at timestamptz not null default now()
);
alter table private.admin_audit enable row level security;
revoke all on private.admin_audit from public,anon,authenticated;
revoke all on sequence private.admin_audit_id_seq from public,anon,authenticated;
create index admin_audit_recent on private.admin_audit(created_at desc,id desc);
create index admin_audit_actor_action on private.admin_audit(actor_id,action,created_at desc);

create function private.require_operator_session() returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=(select auth.uid()); session_key uuid;
begin
 if caller is null or not private.account_active(caller) or not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null) then raise exception 'Verified active account required'; end if;
 session_key:=nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id','')::uuid;
 if session_key is null then raise exception 'Active account session required'; end if;
 perform private.require_account_session(caller,session_key);
 return caller;
end; $$;
create function private.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid;
begin
 caller:=private.require_operator_session();
 if not private.is_admin() then raise exception 'Administrator access required'; end if;
 return caller;
end; $$;
create function private.guard_last_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.role='admin' and (TG_OP='DELETE' or new.role is distinct from old.role or new.user_id is distinct from old.user_id) then
  perform pg_advisory_xact_lock(146389895,1);
  if not exists(select 1 from public.user_roles where role='admin' and user_id<>old.user_id and private.account_active(user_id)) then raise exception 'Keep at least one active administrator'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if; return new;
end; $$;
create trigger fas_keep_last_admin before delete or update on public.user_roles for each row execute function private.guard_last_admin();

create function public.fas_admin_overview() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 return jsonb_build_object('admins',(select count(*) from public.user_roles where role='admin' and private.account_active(user_id)),
 'contributors',(select count(*) from public.user_roles where role='member' and private.account_active(user_id)),
 'pending_invites',(select count(*) from public.invites where accepted_at is null and revoked_at is null and expires_at>now()),
 'published_stories',(select count(*) from public.stories where status='published'));
end; $$;
create function public.fas_admin_find_account(account_email text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if account_email is null or char_length(account_email)>254 or position('@' in account_email)<2 then raise exception 'Enter an exact account email'; end if;
 return (select jsonb_build_object('id',u.id,'email',u.email,'verified',u.email_confirmed_at is not null,
 'display_name',p.display_name,'public_id',p.public_id,'active',private.account_active(u.id),
 'roles',coalesce((select jsonb_agg(role::text order by role::text) from public.user_roles where user_id=u.id),'[]'::jsonb),
 'stories',(select count(*) from public.stories where author_id=u.id))
 from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(btrim(account_email)));
end; $$;
create function public.fas_admin_set_role(target_user uuid,target_role public.community_role,enabled boolean,confirmation_email text,note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid; target_email text; before_roles jsonb; after_roles jsonb;
begin
 perform pg_advisory_xact_lock(146389895,1);
 caller:=private.require_admin();
 if target_role not in ('member','admin') or enabled is null or target_role is null then raise exception 'Choose contributor or administrator access'; end if;
 if note is null or char_length(btrim(note)) not between 1 and 2000 then raise exception 'Reason required'; end if;
 select lower(email) into target_email from auth.users where id=target_user and email_confirmed_at is not null for update;
 if target_email is null or not private.account_active(target_user) then raise exception 'Verified active target account required'; end if;
 if confirmation_email is null or lower(btrim(confirmation_email))<>target_email then raise exception 'Confirm the target account email'; end if;
 select coalesce(jsonb_agg(role::text order by role::text),'[]'::jsonb) into before_roles from public.user_roles where user_id=target_user;
 if enabled then insert into public.user_roles(user_id,role) values(target_user,target_role) on conflict do nothing;
 else delete from public.user_roles where user_id=target_user and role=target_role; end if;
 select coalesce(jsonb_agg(role::text order by role::text),'[]'::jsonb) into after_roles from public.user_roles where user_id=target_user;
 if before_roles<>after_roles then insert into private.admin_audit(actor_id,action,subject_id,details,reason)
 values(caller,'role_changed',target_user,jsonb_build_object('before',before_roles,'after',after_roles),btrim(note)); end if;
 return jsonb_build_object('roles',after_roles,'changed',before_roles<>after_roles);
end; $$;
create or replace function public.create_invite(invitee_email text,valid_days integer default 7) returns text language plpgsql security definer set search_path='' as $$
declare caller uuid; token text:=gen_random_uuid()::text||gen_random_uuid()::text; invite_key uuid;
begin
 caller:=private.require_admin();
 if invitee_email is null or char_length(btrim(invitee_email))>254 or btrim(invitee_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid invitation email'; end if;
 if valid_days is null or valid_days not between 1 and 30 then raise exception 'Expiry must be 1-30 days'; end if;
 perform pg_advisory_xact_lock(146389895,2);
 if (select count(*) from private.admin_audit where actor_id=caller and action='invite_created' and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit reached; try again later'; end if;
 if exists(select 1 from public.invites where email=lower(btrim(invitee_email)) and accepted_at is null and revoked_at is null and expires_at>now()) then raise exception 'An active invitation already exists for this email'; end if;
 insert into public.invites(email,token_hash,created_by,expires_at) values(lower(btrim(invitee_email)),encode(sha256(convert_to(token,'UTF8')),'hex'),caller,now()+valid_days*interval '1 day') returning id into invite_key;
 insert into private.admin_audit(actor_id,action,subject_id,reason) values(caller,'invite_created',invite_key,'Contributor invitation created');
 return token;
end; $$;
create or replace function public.revoke_invite(invite_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare caller uuid;
begin
 caller:=private.require_admin();
 update public.invites set revoked_at=now() where id=invite_id and accepted_at is null and revoked_at is null;
 if not found then raise exception 'Invitation is unavailable or already accepted'; end if;
 insert into private.admin_audit(actor_id,action,subject_id,reason) values(caller,'invite_revoked',invite_id,'Unused contributor invitation revoked');
end; $$;
create or replace function public.accept_invite(invite_token text) returns void language plpgsql security definer set search_path='' as $$
declare invite public.invites; caller uuid; verified_email text;
begin
 caller:=private.require_operator_session();
 if invite_token is null or char_length(invite_token)<>72 then raise exception 'Invite unavailable'; end if;
 select lower(email) into verified_email from auth.users where id=caller;
 select * into invite from public.invites where token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex') for update;
 if not found or invite.email<>verified_email or invite.expires_at<=now() or invite.accepted_at is not null or invite.revoked_at is not null then raise exception 'Invite unavailable'; end if;
 insert into public.user_roles(user_id,role) values(caller,'member') on conflict do nothing;
 update public.invites set accepted_by=caller,accepted_at=now() where id=invite.id;
 insert into private.admin_audit(actor_id,action,subject_id,reason) values(caller,'invite_accepted',invite.id,'Contributor invitation accepted');
end; $$;
create function public.fas_admin_invites(page_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if page_offset is null or page_offset not between 0 and 1000000 then raise exception 'Invalid page'; end if;
 return coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id) from
 (select id,email,created_at,expires_at,accepted_at,revoked_at from public.invites order by created_at desc,id limit 25 offset page_offset)i),'[]'::jsonb);
end; $$;
create function public.fas_admin_activity(page_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if page_offset is null or page_offset not between 0 and 1000000 then raise exception 'Invalid page'; end if;
 return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id desc) from
 (select l.id,l.action,l.subject_id,l.details,l.reason,l.created_at,p.display_name actor_name from private.admin_audit l left join public.profiles p on p.id=l.actor_id order by l.created_at desc,l.id desc limit 25 offset page_offset)a),'[]'::jsonb);
end; $$;
create function public.fas_admin_stories(state_filter text default 'published',page_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if state_filter is null or state_filter not in ('published','draft','archived','submitted','rejected') or page_offset is null or page_offset not between 0 and 1000000 then raise exception 'Invalid story filter'; end if;
 return coalesce((select jsonb_agg(to_jsonb(s) order by s.updated_at desc,s.id) from
 (select s.id,s.slug,s.title,s.summary,s.status,s.updated_at,p.display_name author_name from public.stories s join public.profiles p on p.id=s.author_id
 where s.status::text=state_filter and private.account_active(s.author_id) order by s.updated_at desc,s.id limit 25 offset page_offset)s),'[]'::jsonb);
end; $$;
revoke all on function private.require_operator_session(),private.require_admin(),private.guard_last_admin() from public,anon,authenticated;
-- Public API facades must perform the checked operator/session/role checks themselves.
revoke all on function public.fas_admin_overview(),public.fas_admin_find_account(text),public.fas_admin_set_role(uuid,public.community_role,boolean,text,text),public.fas_admin_invites(integer),public.fas_admin_activity(integer),public.fas_admin_stories(text,integer) from public,anon,authenticated;
grant execute on function public.fas_admin_overview(),public.fas_admin_find_account(text),public.fas_admin_set_role(uuid,public.community_role,boolean,text,text),public.fas_admin_invites(integer),public.fas_admin_activity(integer),public.fas_admin_stories(text,integer) to authenticated;
create or replace function public.fas_account_snapshot(target_user uuid, target_session uuid) returns jsonb
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
    'role', coalesce((select role::text from public.user_roles where user_id = target_user order by case role when 'member' then 0 when 'admin' then 1 else 2 end limit 1),'viewer'),
    'stories', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.stories s where author_id = target_user),'[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'approved_by' order by a.id) from public.story_assets a join public.stories s on s.id = a.story_id where s.author_id = target_user),'[]'::jsonb),
    'objects', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'path',o.name,'size',o.metadata->>'size','type',o.metadata->>'mimetype','updated_at',o.updated_at) order by o.name) from storage.objects o where bucket_id = 'fas-story-images' and split_part(name,'/',1) = target_user::text),'[]'::jsonb)
  ) into payload;
  if payload->'profile' = 'null'::jsonb then raise exception 'Account unavailable'; end if;
  return jsonb_build_object('data',payload,'fingerprint',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end; $$;

create or replace function public.fas_public_profile(profile_key uuid, page_offset integer default 0)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'public_id',p.public_id,'display_name',p.display_name,'bio',p.bio,'welcome_line',p.welcome_line,
    'stories',coalesce((select jsonb_agg(jsonb_build_object(
      'slug',s.slug,'title',s.title,'summary',s.summary,'published_at',s.published_at,
      'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text)
        from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and a.approved_at is not null)
      ) order by s.published_at desc,s.id)
      from (select slug,title,summary,published_at,id,cover_asset_id from public.stories
        where author_id=p.id and status='published' order by published_at desc,id limit 12 offset page_offset) s),'[]'::jsonb),
    'next_offset',case when (select count(*) from public.stories where author_id=p.id and status='published')>page_offset+12 then page_offset+12 else null end
  ) from public.profiles p
  where p.public_id=profile_key and page_offset between 0 and 1000000
    and private.account_active(p.id) and (
      exists(select 1 from public.user_roles where user_id=p.id and role='member')
      or exists(select 1 from public.stories where author_id=p.id and status='published'));
$$;
revoke all on function public.fas_public_profile(uuid,integer) from public,anon,authenticated;
grant execute on function public.fas_public_profile(uuid,integer) to anon,authenticated;
create or replace function public.moderate_story(target_story uuid, decision public.story_status, note text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.story_status;
begin
  perform private.require_operator_session();
  if not private.is_staff() then raise exception 'Moderator required'; end if;
  if note is null or char_length(btrim(note)) not between 1 and 2000 then raise exception 'Reason required'; end if;
  select status into previous from public.stories where id=target_story for update;
  if not found then raise exception 'Story not found'; end if;
  if decision is distinct from 'archived' or previous = 'archived' then
    raise exception 'Staff may archive content for moderation; contributors publish their own work';
  end if;
  update public.stories set status='archived' where id=target_story;
  insert into public.moderation_log(story_id,actor_id,from_status,to_status,reason)
    values(target_story,auth.uid(),previous,'archived',btrim(note));
  insert into private.admin_audit(actor_id,action,subject_id,details,reason) values(auth.uid(),'story_archived',target_story,jsonb_build_object('previous_status',previous),btrim(note));
end; $$;

create function public.fas_admin_restore_story(target_story uuid,confirmation_slug text,note text) returns void language plpgsql security definer set search_path='' as $$
declare caller uuid; story public.stories;
begin
 caller:=private.require_admin();
 if note is null or char_length(btrim(note)) not between 1 and 2000 then raise exception 'Reason required'; end if;
 select * into story from public.stories where id=target_story for update;
 if not found or story.status<>'archived' then raise exception 'Archived story required'; end if;
 if confirmation_slug is distinct from story.slug then raise exception 'Confirm the story reference'; end if;
 if not private.account_active(story.author_id) then raise exception 'Author account is unavailable'; end if;
 update public.stories set status='draft',published_at=null where id=target_story;
 insert into public.moderation_log(story_id,actor_id,from_status,to_status,reason) values(target_story,caller,'archived','draft',btrim(note));
 insert into private.admin_audit(actor_id,action,subject_id,reason) values(caller,'story_restored',target_story,btrim(note));
end; $$;
revoke all on function public.fas_admin_restore_story(uuid,text,text) from public,anon,authenticated;
grant execute on function public.fas_admin_restore_story(uuid,text,text) to authenticated;
commit;
