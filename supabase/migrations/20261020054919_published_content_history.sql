begin;
-- Private, bounded content recovery. No public table access or executable archives.
create table private.content_revisions(
 id uuid primary key default gen_random_uuid(),
 story_id uuid references public.stories(id) on delete cascade,
 file_id uuid references private.file_content(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 saved_at timestamptz not null,
 captured_at timestamptz not null default clock_timestamp(),
 title text not null,
 snapshot jsonb,
 check ((story_id is null)<>(file_id is null))
);
create index content_revisions_story_idx on private.content_revisions(story_id,captured_at desc,id) where story_id is not null;
create index content_revisions_file_idx on private.content_revisions(file_id,captured_at desc,id) where file_id is not null;
create index content_revisions_owner_idx on private.content_revisions(owner_id);
alter table private.content_revisions enable row level security;
revoke all on private.content_revisions from public,anon,authenticated;
grant all on private.content_revisions to service_role;

-- Only editable content is recovered. Ownership, URLs, visibility, covers and
-- publishing identity remain current. Removed images are never resurrected.
create function private.revision_values(s public.stories) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('title',s.title,'summary',s.summary,'body',s.body,'body_document',s.body_document,'genre',s.genre,'genres',s.genres,'tags',s.tags,'content_warning',s.content_warning,'warning_ids',s.warning_ids,'warning_reviewed',s.warning_reviewed,'metadata',s.metadata,'scene_style',s.scene_style,'drop_caps',s.drop_caps,'paragraph_style',s.paragraph_style,'language',s.language,'executable_package',s.executable_package);
$$;
create function private.capture_story_revision() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (old.slug_locked or old.status='published') and private.revision_values(old) is distinct from private.revision_values(new) then
  insert into private.content_revisions(story_id,owner_id,saved_at,title,snapshot) values(old.id,old.author_id,old.updated_at,old.title,private.revision_values(old));
  delete from private.content_revisions where id in(select id from private.content_revisions where story_id=old.id order by captured_at desc,id offset 20);
 end if;return new;
end;$$;
create trigger fas_content_revision after update on public.stories for each row execute function private.capture_story_revision();
create function private.capture_file_revision() returns trigger language plpgsql security definer set search_path='' as $$declare item private.file_content;key uuid;begin
 key:=case when TG_OP='DELETE' then old.file_id else new.file_id end;
 select * into item from private.file_content where id=key;
 -- Parent/account deletion must not recreate revision rows during cascades.
 if not found or item.owner_id is null or not exists(select 1 from public.profiles where id=item.owner_id) then return case when TG_OP='DELETE' then old else new end;end if;
 if TG_OP='INSERT' and exists(select 1 from private.file_interactive_overrides where file_id=key) then return new;end if;
 if TG_OP='UPDATE' and old.executable_package is not distinct from new.executable_package then return new;end if;
 insert into private.content_revisions(file_id,owner_id,saved_at,title,snapshot) values(item.id,item.owner_id,item.updated_at,item.title,case when TG_OP='INSERT' then null else old.executable_package end);
 delete from private.content_revisions where id in(select id from private.content_revisions where file_id=key order by captured_at desc,id offset 20);
 return case when TG_OP='DELETE' then old else new end;
end;$$;
create trigger fas_file_revision before insert or update or delete on private.file_interactive_overrides for each row execute function private.capture_file_revision();

-- Definer functions can read private archives only after checking a live session
-- and current ownership/shared FAS permission. Thin public wrappers are invokers.
create function private.content_history(content_key uuid,source_key text,revision_key uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$declare caller uuid;answer jsonb;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if source_key='studio' then
  if not exists(select 1 from public.stories where id=content_key and private.can_edit_studio_content(author_id,publishing_identity,caller) and (content_type<>'tool' or private.is_admin())) then raise exception 'Content unavailable';end if;
 elsif source_key='file' then
  if not exists(select 1 from private.file_content where id=content_key and content_type in ('game','tool') and private.can_edit_studio_content(owner_id,publishing_identity,caller) and (content_type<>'tool' or private.is_admin())) then raise exception 'Content unavailable';end if;
 else raise exception 'Invalid source';end if;
 if revision_key is null then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'saved_at',saved_at,'title',title) order by captured_at desc,id),'[]') into answer from private.content_revisions where (source_key='studio' and story_id=content_key or source_key='file' and file_id=content_key);
 else
  select jsonb_build_object('id',id,'saved_at',saved_at,'snapshot',snapshot) into answer from private.content_revisions where id=revision_key and (source_key='studio' and story_id=content_key or source_key='file' and file_id=content_key);
  if answer is null then raise exception 'Version unavailable. Refresh history';end if;
 end if;
 return answer;
end;$$;
create function public.fas_content_history(content_key uuid,source_key text,revision_key uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.content_history(content_key,source_key,revision_key);$$;

create function private.restore_file_revision(content_key uuid,revision_key uuid,expected_version timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;item private.file_content;revision jsonb;begin
 caller:=private.require_operator_session();
 select * into item from private.file_content where id=content_key and private.can_edit_studio_content(owner_id,publishing_identity,caller) and content_type in ('game','tool') for update;
 if not found or expected_version is null or item.updated_at is distinct from expected_version then raise exception 'Content changed or unavailable. Reopen it' using errcode='P0002';end if;
 revision:=private.content_history(content_key,'file',revision_key);
 if item.content_type='tool' then perform private.require_admin();end if;
 if revision->'snapshot'<>'null'::jsonb then return private.save_file_player(item.id,expected_version,revision->'snapshot',item.publishing_identity);end if;
 -- NULL is the original checked-in project; the player falls back to its source.
 delete from private.file_interactive_overrides where file_id=item.id;
 update private.file_content set updated_at=greatest(clock_timestamp(),item.updated_at+interval '1 microsecond') where id=item.id;
 return (select jsonb_build_object('id',id,'updated_at',updated_at,'publishing_identity',publishing_identity) from private.file_content where id=item.id);
end;$$;
create function public.fas_restore_file_revision(content_key uuid,revision_key uuid,expected_version timestamptz) returns jsonb language sql security invoker set search_path='' as $$select private.restore_file_revision(content_key,revision_key,expected_version);$$;
revoke all on function private.revision_values(public.stories),private.capture_story_revision(),private.capture_file_revision(),private.content_history(uuid,text,uuid),private.restore_file_revision(uuid,uuid,timestamptz),public.fas_content_history(uuid,text,uuid),public.fas_restore_file_revision(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.content_history(uuid,text,uuid),private.restore_file_revision(uuid,uuid,timestamptz),public.fas_content_history(uuid,text,uuid),public.fas_restore_file_revision(uuid,uuid,timestamptz) to authenticated;
create or replace function public.fas_account_snapshot(target_user uuid, target_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  perform private.require_account_session(target_user,target_session);
  if not private.account_active(target_user) then raise exception 'Account is closing'; end if;
  if (select count(*) from (select 1 from public.stories where author_id=target_user limit 301) s)>300
    or (select coalesce(sum(octet_length(body)+coalesce(octet_length(executable_package::text),0)),0) from public.stories where author_id=target_user)>16777216
    or (select coalesce(sum(octet_length(snapshot::text)),0) from private.content_revisions where owner_id=target_user)>16777216
    or (select count(*) from (select 1 from public.story_assets a join public.stories s on s.id=a.story_id where s.author_id=target_user limit 501) a)>500
    or (select count(*) from (select 1 from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text limit 501) o)>500 then
    raise exception 'Account content requires background export';
  end if;
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where id = target_user),
    'role', coalesce((select role::text from public.user_roles where user_id = target_user order by case role when 'member' then 0 when 'admin' then 1 else 2 end limit 1),'viewer'),
    'stories', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.stories s where author_id = target_user),'[]'::jsonb),
    'content_revisions',coalesce((select jsonb_agg(to_jsonb(r)-'owner_id' order by captured_at,id) from private.content_revisions r where owner_id=target_user),'[]'::jsonb),
    'file_players',coalesce((select jsonb_agg(jsonb_build_object('url',f.url,'slug',f.slug,'content_type',f.content_type,'package',o.executable_package,'updated_at',o.updated_at) order by f.id) from private.file_content f join private.file_interactive_overrides o on o.file_id=f.id where f.owner_id=target_user and o.owner_id=target_user),'[]'::jsonb),
    'game_saves',coalesce((select jsonb_agg(to_jsonb(g)-'owner_id' order by game_id,slot) from private.game_saves g where owner_id=target_user),'[]'::jsonb),
    'game_participation',coalesce((select jsonb_agg(jsonb_build_object('game',r.game_id,'room',m.room_id,'player',m.player_id,'data',p.payload,'expiresAt',r.expires_at)) from private.game_members m join private.game_rooms r on r.id=m.room_id join public.game_player_state p using(room_id,player_id) where m.user_id=target_user),'[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'approved_by' order by a.id) from public.story_assets a join public.stories s on s.id = a.story_id where s.author_id = target_user),'[]'::jsonb),
    'objects', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'path',o.name,'size',o.metadata->>'size','type',o.metadata->>'mimetype','updated_at',o.updated_at) order by o.name) from storage.objects o where bucket_id = 'fas-story-images' and split_part(name,'/',1) = target_user::text),'[]'::jsonb)
  ) into payload;
  if payload->'profile' = 'null'::jsonb then raise exception 'Account unavailable'; end if;
  return jsonb_build_object('data',payload,'fingerprint',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end; $$;
notify pgrst,'reload schema';
commit;
