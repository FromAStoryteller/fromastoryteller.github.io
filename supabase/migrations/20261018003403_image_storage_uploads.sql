begin;
-- Immutable objects share the existing private bucket, backup and account export.
alter table public.profiles add column image_id uuid, add column image_path text unique,
 add column image_alt text not null default '' check(char_length(image_alt)<=500),
 add column image_version uuid not null default gen_random_uuid();
alter table public.profiles add constraint profile_image_pair check
 ((image_id is null and image_path is null and image_alt='') or
 (image_id is not null and image_path is not null and char_length(btrim(image_alt)) between 1 and 500));
create table private.image_uploads(
 path text primary key, owner_id uuid not null, kind text not null check(kind in ('cover','profile')),
 state text not null default 'pending' check(state in ('pending','active','retired')),
 created_at timestamptz not null default now()
);
create table private.image_cleanup(
 path text primary key, owner_id uuid not null, created_at timestamptz not null default now(),
 retry_at timestamptz not null default now(), attempts integer not null default 0,
 lease uuid, done_at timestamptz
);
create index image_cleanup_pending on private.image_cleanup(retry_at,created_at) where done_at is null;
create index image_uploads_pending on private.image_uploads(created_at) where state='pending';
alter table private.image_uploads enable row level security;
alter table private.image_cleanup enable row level security;
revoke all on private.image_uploads,private.image_cleanup from public,anon,authenticated;
create function private.queue_image(path_key text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(path_key,146389897));
 if path_key !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]+[.](jpg|jpeg|png|webp)$' then raise exception 'Invalid stored image path';end if;
 insert into private.image_cleanup(path,owner_id) values(path_key,split_part(path_key,'/',1)::uuid) on conflict do nothing;
 update private.image_uploads set state='retired' where path=path_key;
end;$$;
create function private.retire_story_image() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.queue_image(old.object_path);return old;end;$$;
create trigger fas_retire_story_image after delete on public.story_assets for each row execute function private.retire_story_image();
create function private.retire_profile_image() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.image_path is not null and (TG_OP='DELETE' or old.image_path is distinct from new.image_path) then perform private.queue_image(old.image_path);end if;
 if TG_OP='DELETE' then return old;end if;return new;
end;$$;
create trigger fas_retire_profile_image after update or delete on public.profiles for each row execute function private.retire_profile_image();
create function private.guard_retired_image() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.object_path,146389897));
 if exists(select 1 from private.image_cleanup where path=new.object_path) then raise exception 'Image has been retired';end if;
 if TG_OP='UPDATE' and new.object_path is distinct from old.object_path then raise exception 'Stored images are immutable';end if;
 return new;
end;$$;
create trigger fas_guard_retired_image before insert or update on public.story_assets for each row execute function private.guard_retired_image();

create function private.my_profile_image() returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;begin caller:=private.require_operator_session();return (select jsonb_build_object('asset_id',image_id,'alt',image_alt,'version',image_version) from public.profiles where id=caller);end;$$;
create function public.fas_my_profile_image() returns jsonb language sql set search_path='' as $$select private.my_profile_image();$$;
revoke all on function public.fas_my_profile_image(),private.my_profile_image() from public,anon,authenticated,service_role;
grant execute on function public.fas_my_profile_image(),private.my_profile_image() to authenticated;

create function private.visible_profile_image(asset_key uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles p where p.image_id=asset_key and private.account_active(p.id) and (p.id=(select auth.uid()) or private.public_publishing_author(p.id,'personal') is not null));$$;
create function public.fas_visible_profile_image(asset_key uuid) returns boolean language sql set search_path='' as $$select private.visible_profile_image(asset_key);$$;
revoke all on function public.fas_visible_profile_image(uuid),private.visible_profile_image(uuid) from public,anon,authenticated,service_role;
grant execute on function public.fas_visible_profile_image(uuid),private.visible_profile_image(uuid) to anon,authenticated;

create function private.begin_profile_upload() returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;attempts integer;begin
 caller:=private.require_operator_session();
 if not private.current_policies_accepted(caller) then raise exception 'Current account agreements required';end if;
 insert into private.studio_cover_limits(user_id,period,attempts) values(caller,date_trunc('hour',now()),1)
 on conflict(user_id) do update set period=excluded.period,attempts=case when studio_cover_limits.period=excluded.period then studio_cover_limits.attempts+1 else 1 end returning studio_cover_limits.attempts into attempts;
 if attempts>20 then raise exception 'Image upload limit reached. Try again later';end if;
 return (select jsonb_build_object('author_id',id,'public_id',public_id) from public.profiles where id=caller);
end;$$;
create function public.fas_begin_profile_upload() returns jsonb language sql set search_path='' as $$select private.begin_profile_upload();$$;
revoke all on function public.fas_begin_profile_upload(),private.begin_profile_upload() from public,anon,authenticated,service_role;
grant execute on function public.fas_begin_profile_upload(),private.begin_profile_upload() to authenticated;

create function private.reserve_image_upload(owner_key uuid,session_key uuid,image_path text,image_kind text) returns boolean language plpgsql security definer set search_path='' as $$declare target_id uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 perform private.require_account_session(owner_key,session_key);
 if not private.account_active(owner_key) or not private.current_policies_accepted(owner_key) then raise exception 'Active account required';end if;
 if image_kind not in ('cover','profile') or image_kind is null or image_path!~('^'||owner_key::text||'/[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$') then raise exception 'Invalid upload path';end if;
 target_id:=split_part(image_path,'/',2)::uuid;
 if image_kind='cover' then
  if not exists(select 1 from public.stories where id=target_id and author_id=owner_key and status<>'archived') or not exists(select 1 from public.user_roles where user_id=owner_key and role='member') then raise exception 'Owned editable content required';end if;
 else
  if not exists(select 1 from public.profiles where id=owner_key and public_id=target_id) then raise exception 'Owned profile required';end if;
 end if;
 if exists(select 1 from private.image_cleanup where path=image_path) then raise exception 'Retired image path';end if;
 insert into private.image_uploads(path,owner_id,kind) values(image_path,owner_key,image_kind);
 return true;
end;$$;
create function public.fas_reserve_image_upload(owner_key uuid,session_key uuid,image_path text,image_kind text) returns boolean language sql set search_path='' as $$select private.reserve_image_upload(owner_key,session_key,image_path,image_kind);$$;
revoke all on function public.fas_reserve_image_upload(uuid,uuid,text,text),private.reserve_image_upload(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.fas_reserve_image_upload(uuid,uuid,text,text),private.reserve_image_upload(uuid,uuid,text,text) to service_role;

create function private.register_profile_image(owner_key uuid,session_key uuid,image_path text,image_alt text,expected_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare current_profile public.profiles;asset_key uuid:=gen_random_uuid();begin
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 perform private.require_account_session(owner_key,session_key);
 if not private.account_active(owner_key) or not private.current_policies_accepted(owner_key) then raise exception 'Active account required';end if;
 select * into current_profile from public.profiles where id=owner_key for update;
 if current_profile.image_version is distinct from expected_version then raise exception 'Profile image changed; reload before replacing' using errcode='P0002';end if;
 if image_path !~('^'||owner_key::text||'/'||current_profile.public_id::text||'/[a-f0-9-]{36}[.]jpg$') or char_length(btrim(image_alt)) not between 1 and 500 then raise exception 'Invalid profile image';end if;
 update private.image_uploads set state='active' where path=image_path and owner_id=owner_key and kind='profile' and state='pending';
 if not found then raise exception 'Upload expired or unavailable';end if;
 update public.profiles set image_id=asset_key,image_path=register_profile_image.image_path,image_alt=btrim(register_profile_image.image_alt),image_version=gen_random_uuid() where id=owner_key returning * into current_profile;
 return jsonb_build_object('asset_id',current_profile.image_id,'alt',current_profile.image_alt,'version',current_profile.image_version);
end;$$;
create function public.fas_register_profile_image(owner_key uuid,session_key uuid,image_path text,image_alt text,expected_version uuid) returns jsonb language sql set search_path='' as $$select private.register_profile_image(owner_key,session_key,image_path,image_alt,expected_version);$$;
revoke all on function public.fas_register_profile_image(uuid,uuid,text,text,uuid),private.register_profile_image(uuid,uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.fas_register_profile_image(uuid,uuid,text,text,uuid),private.register_profile_image(uuid,uuid,text,text,uuid) to service_role;

create function private.change_profile_image(expected_version uuid,image_alt text,remove_image boolean) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;current_profile public.profiles;begin
 caller:=private.require_operator_session();
 if not private.current_policies_accepted(caller) then raise exception 'Current account agreements required';end if;
 select * into current_profile from public.profiles where id=caller for update;
 if current_profile.image_version is distinct from expected_version or current_profile.image_id is null then raise exception 'Profile image changed; reload before editing' using errcode='P0002';end if;
 if remove_image is null or (not remove_image and char_length(btrim(image_alt)) not between 1 and 500) then raise exception 'Image description required';end if;
 update public.profiles set image_id=case when remove_image then null else profiles.image_id end,
 image_path=case when remove_image then null else profiles.image_path end,
 image_alt=case when remove_image then '' else btrim(change_profile_image.image_alt) end,image_version=gen_random_uuid()
 where id=caller returning * into current_profile;
 return jsonb_build_object('asset_id',current_profile.image_id,'alt',current_profile.image_alt,'version',current_profile.image_version);
end;$$;
create function public.fas_change_profile_image(expected_version uuid,image_alt text,remove_image boolean) returns jsonb language sql set search_path='' as $$select private.change_profile_image(expected_version,image_alt,remove_image);$$;
revoke all on function public.fas_change_profile_image(uuid,text,boolean),private.change_profile_image(uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.fas_change_profile_image(uuid,text,boolean),private.change_profile_image(uuid,text,boolean) to authenticated;

create function private.change_cover_image(target_story uuid,asset_key uuid,expected_version timestamptz,image_alt text,remove_image boolean) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;story public.stories;asset public.story_assets;begin
 caller:=private.require_operator_session();perform private.require_contributor_write(caller);
 select * into story from public.stories where id=target_story and author_id=caller and status<>'archived' for update;
 if story.id is null or story.updated_at is distinct from expected_version then raise exception 'Content changed; reopen before managing covers' using errcode='P0002';end if;
 select * into asset from public.story_assets where id=asset_key and story_id=target_story for update;
 if asset.id is null then raise exception 'Cover unavailable';end if;
 if remove_image is null then raise exception 'Action required';end if;
 if remove_image then
  if story.cover_asset_id=asset_key then raise exception 'Choose and save a replacement, or clear the draft selection, before removing this cover';end if;
  delete from public.story_assets where id=asset_key;
 else
  if char_length(btrim(image_alt)) not between 1 and 500 then raise exception 'Image description required';end if;
  update public.story_assets set alt_text=btrim(image_alt) where id=asset_key;
 end if;
 -- Image edits participate in optimistic versioning without changing content.
 update public.stories set updated_at=clock_timestamp() where id=target_story returning * into story;
 return to_jsonb(story)-'author_id';
end;$$;
create function public.fas_change_cover_image(target_story uuid,asset_key uuid,expected_version timestamptz,image_alt text,remove_image boolean) returns jsonb language sql set search_path='' as $$select private.change_cover_image(target_story,asset_key,expected_version,image_alt,remove_image);$$;
revoke all on function public.fas_change_cover_image(uuid,uuid,timestamptz,text,boolean),private.change_cover_image(uuid,uuid,timestamptz,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.fas_change_cover_image(uuid,uuid,timestamptz,text,boolean),private.change_cover_image(uuid,uuid,timestamptz,text,boolean) to authenticated;

create function private.claim_image_cleanup(owner_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare item record;batch jsonb:='[]';claim_key uuid;begin
 -- Pending reservations are never retired while registration holds their row lock.
 for item in select path from private.image_uploads where state='pending' and created_at<now()-interval '1 hour' and (owner_key is null or owner_id=owner_key) for update skip locked limit 50 loop
  if not exists(select 1 from public.story_assets where object_path=item.path) and not exists(select 1 from public.profiles where image_path=item.path) then perform private.queue_image(item.path);end if;
 end loop;
 for item in select * from private.image_cleanup where done_at is null and retry_at<=now() and (owner_key is null or owner_id=owner_key) order by created_at for update skip locked limit 25 loop
  if exists(select 1 from public.story_assets where object_path=item.path) or exists(select 1 from public.profiles where image_path=item.path) then continue;end if;
  claim_key:=gen_random_uuid();
  update private.image_cleanup set lease=claim_key,retry_at=now()+interval '5 minutes',attempts=attempts+1 where path=item.path;
  batch:=batch||jsonb_build_array(jsonb_build_object('path',item.path,'lease',claim_key));
 end loop;
 return batch;
end;$$;
create function public.fas_claim_image_cleanup(owner_key uuid) returns jsonb language sql set search_path='' as $$select private.claim_image_cleanup(owner_key);$$;
revoke all on function public.fas_claim_image_cleanup(uuid),private.claim_image_cleanup(uuid) from public,anon,authenticated,service_role;
grant execute on function public.fas_claim_image_cleanup(uuid),private.claim_image_cleanup(uuid) to service_role;

create function private.ack_image_cleanup(image_path text,claim_key uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 update private.image_cleanup set done_at=now(),lease=null where path=image_path and lease=claim_key and done_at is null;
 return found;end;$$;
create function public.fas_ack_image_cleanup(image_path text,claim_key uuid) returns boolean language sql set search_path='' as $$select private.ack_image_cleanup(image_path,claim_key);$$;
revoke all on function public.fas_ack_image_cleanup(text,uuid),private.ack_image_cleanup(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.fas_ack_image_cleanup(text,uuid),private.ack_image_cleanup(text,uuid) to service_role;

revoke all on function private.queue_image(text),private.retire_story_image(),private.retire_profile_image(),private.guard_retired_image() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.fas_register_verified_cover(target_story uuid, owner_key uuid, session_key uuid, image_path text, image_alt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare asset public.story_assets;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 if not exists(select 1 from auth.sessions where id=session_key and user_id=owner_key and (not_after is null or not_after>now()))
 or not private.account_active(owner_key) or not private.current_policies_accepted(owner_key)
 or not exists(select 1 from public.user_roles where user_id=owner_key and role='member') then raise exception 'Active contributor session required';end if;
 perform 1 from public.stories where id=target_story and author_id=owner_key and status<>'archived' for update;
 if not found then raise exception 'Owned editable content required';end if;
 if image_path!~('^'||owner_key::text||'/'||target_story::text||'/[a-f0-9-]+\.jpg$') or char_length(btrim(image_alt)) not between 1 and 500 then raise exception 'Invalid verified cover';end if;
 if (select count(*) from public.story_assets where story_id=target_story)>=20 then raise exception 'Cover limit reached';end if;
 update private.image_uploads set state='active' where path=image_path and owner_id=owner_key and kind='cover' and state='pending';
 if not found then raise exception 'Upload expired or unavailable';end if;
 insert into public.story_assets(story_id,object_path,alt_text,pixel_width,pixel_height,verified_at) values(target_story,image_path,btrim(image_alt),1600,900,now()) returning * into asset;
 return jsonb_build_object('id',asset.id,'alt_text',asset.alt_text,'pixel_width',1600,'pixel_height',900,'verified_at',asset.verified_at,'approved_at',null);
end;$function$;

CREATE OR REPLACE FUNCTION public.fas_public_profile(profile_key uuid, page_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with identity as (
 select p.public_id,p.display_name,p.bio,p.welcome_line,p.social_links,p.id as owner_id,'personal'::text as identity_key from public.profiles p where p.public_id=profile_key and private.public_publishing_author(p.id,'personal') is not null
 union all select b.public_id,b.display_name,'Stories, games and useful things from From A Storyteller.','',b.social_links,null::uuid,'fas' from private.publishing_brand b where b.public_id=profile_key and singleton
 ), work as (select w.* from identity i cross join lateral private.public_publishing_work(i.owner_id,i.identity_key) w)
 select jsonb_build_object('public_id',i.public_id,'display_name',i.display_name,'bio',i.bio,'welcome_line',i.welcome_line,'social_links',i.social_links,'image',(select jsonb_build_object('asset_id',p.image_id,'alt',p.image_alt) from public.profiles p where p.id=i.owner_id and p.image_id is not null),
 'stories',coalesce((select jsonb_agg(item order by published_at desc,id) from(select * from work order by published_at desc,id limit 12 offset page_offset)x),'[]'),
 'next_offset',case when (select count(*) from work)>page_offset+12 then page_offset+12 else null end)
 from identity i where page_offset between 0 and 1000000;
$function$;

-- Uploads must pass the authenticated normalizer. Raw byte writes are closed.
drop policy if exists fas_images_upload on storage.objects;

create function private.abandon_image_upload(image_path text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform 1 from private.image_uploads where path=image_path and state='pending' for update;
 if not found or exists(select 1 from public.story_assets where object_path=image_path) or exists(select 1 from public.profiles where profiles.image_path=abandon_image_upload.image_path) then return false;end if;
 perform private.queue_image(image_path);return true;
end;$$;
create function public.fas_abandon_image_upload(image_path text) returns boolean language sql set search_path='' as $$select private.abandon_image_upload(image_path);$$;
revoke all on function private.abandon_image_upload(text),public.fas_abandon_image_upload(text) from public,anon,authenticated;
grant execute on function private.abandon_image_upload(text),public.fas_abandon_image_upload(text) to service_role;

create function private.profile_image_path(asset_key uuid) returns text language sql stable security definer set search_path='' as $$select image_path from public.profiles where image_id=asset_key and private.account_active(id);$$;
create function public.fas_profile_image_path(asset_key uuid) returns text language sql set search_path='' as $$select private.profile_image_path(asset_key);$$;
revoke all on function private.profile_image_path(uuid),public.fas_profile_image_path(uuid) from public,anon,authenticated;
grant execute on function private.profile_image_path(uuid),public.fas_profile_image_path(uuid) to service_role;
commit;
