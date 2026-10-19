begin;
-- Existing repository pages keep their permanent IDs, addresses and analytics.
create table private.file_interactive_overrides(
 file_id uuid primary key references private.file_content(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 executable_package jsonb not null,
 updated_at timestamptz not null default now()
);
alter table private.file_interactive_overrides enable row level security;
revoke all on private.file_interactive_overrides from public,anon,authenticated;
grant all on private.file_interactive_overrides to service_role;
create or replace function private.valid_interactive_package(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when p is null then true else
 private.valid_interactive_package_v1(p-'settings'-'template') and coalesce(private.valid_game_settings(p->'settings'),false)
 and (not p?'template' or jsonb_typeof(p->'template')='string' and p->>'template' in ('brick-blitz','rally-clash','countdown','genre-randomizer')) and octet_length(p::text)<=4194304 end;
$$;
alter table private.file_interactive_overrides add constraint file_player_valid check(private.valid_interactive_package(executable_package));
create function private.my_file_player(file_key uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid;item private.file_content;begin
 caller:=private.require_operator_session();if not private.is_member() then raise exception 'Contributor access required';end if;
 select * into item from private.file_content where id=file_key and owner_id=caller and content_type in ('game','tool');
 if not found then raise exception 'Content unavailable';end if;
 return jsonb_build_object('id',item.id,'version',item.updated_at,'package',(select executable_package from private.file_interactive_overrides where file_id=item.id and owner_id=caller));
end;$$;
create function public.fas_my_file_player(file_key uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.my_file_player(file_key);$$;
create function private.save_file_player(file_key uuid,expected_version timestamptz,player_package jsonb,identity_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;item private.file_content;begin
 caller:=private.require_operator_session();if not private.is_member() or not private.current_policies_accepted(caller) then raise exception 'Current contributor agreements required';end if;
 select * into item from private.file_content where id=file_key and owner_id=caller and content_type in ('game','tool') for update;
 if not found or item.updated_at is distinct from expected_version then raise exception 'Content changed or unavailable. Reopen it from Your work' using errcode='P0002';end if;
 if item.content_type='tool' then perform private.require_admin();end if;
 if identity_key is null or identity_key not in ('personal','fas') or item.content_type='tool' and identity_key<>'fas' or identity_key='fas' and not private.can_publish_as_fas(caller) then raise exception 'Publishing access required';end if;
 if player_package is null or not private.valid_interactive_package(player_package) or btrim(player_package->>'js')='' or (player_package->>'template') is distinct from item.slug then raise exception 'Upload the working project downloaded for this page';end if;
 -- Compatibility projects preserve the original local-only game contract. New
 -- account-enabled games use the separate Studio game runtime and schema.
 if coalesce((player_package->'settings'->>'saves')::boolean,false) or coalesce(player_package->'settings'->>'multiplayer','off')<>'off' then raise exception 'These existing players use local-only features. Create a Studio game for account saves or multiplayer';end if;
 insert into private.file_interactive_overrides(file_id,owner_id,executable_package) values(item.id,caller,player_package)
 on conflict(file_id) do update set owner_id=excluded.owner_id,executable_package=excluded.executable_package,updated_at=clock_timestamp();
 update private.file_content set publishing_identity=identity_key,updated_at=clock_timestamp() where id=item.id;
 return (select jsonb_build_object('id',id,'updated_at',updated_at,'publishing_identity',publishing_identity) from private.file_content where id=item.id);
end;$$;
create function public.fas_save_file_player(file_key uuid,expected_version timestamptz,player_package jsonb,identity_key text) returns jsonb language sql security invoker set search_path='' as $$select private.save_file_player(file_key,expected_version,player_package,identity_key);$$;
create function private.public_file_player(file_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('package',o.executable_package,'version',f.updated_at) from private.file_content f join private.file_interactive_overrides o on o.file_id=f.id and o.owner_id=f.owner_id
 where f.slug=file_slug and char_length(file_slug)<=80 and f.content_type in ('game','tool') and private.public_publishing_author(f.owner_id,f.publishing_identity) is not null;
$$;
create function public.fas_public_file_player(file_slug text) returns jsonb language sql stable security invoker set search_path='' as $$select private.public_file_player(file_slug);$$;
revoke all on function private.my_file_player(uuid),private.save_file_player(uuid,timestamptz,jsonb,text),private.public_file_player(text),public.fas_my_file_player(uuid),public.fas_save_file_player(uuid,timestamptz,jsonb,text),public.fas_public_file_player(text) from public,anon,authenticated;
grant execute on function private.my_file_player(uuid),private.save_file_player(uuid,timestamptz,jsonb,text),public.fas_my_file_player(uuid),public.fas_save_file_player(uuid,timestamptz,jsonb,text) to authenticated;
grant execute on function private.public_file_player(text),public.fas_public_file_player(text) to anon,authenticated;
create or replace function public.fas_account_snapshot(target_user uuid, target_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  perform private.require_account_session(target_user,target_session);
  if not private.account_active(target_user) then raise exception 'Account is closing'; end if;
  if (select count(*) from (select 1 from public.stories where author_id=target_user limit 301) s)>300
    or (select coalesce(sum(octet_length(body)+coalesce(octet_length(executable_package::text),0)),0) from public.stories where author_id=target_user)>16777216
    or (select count(*) from (select 1 from public.story_assets a join public.stories s on s.id=a.story_id where s.author_id=target_user limit 501) a)>500
    or (select count(*) from (select 1 from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text limit 501) o)>500 then
    raise exception 'Account content requires background export';
  end if;
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where id = target_user),
    'role', coalesce((select role::text from public.user_roles where user_id = target_user order by case role when 'member' then 0 when 'admin' then 1 else 2 end limit 1),'viewer'),
    'stories', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.stories s where author_id = target_user),'[]'::jsonb),
    'file_players',coalesce((select jsonb_agg(jsonb_build_object('url',f.url,'slug',f.slug,'content_type',f.content_type,'package',o.executable_package,'updated_at',o.updated_at) order by f.id) from private.file_content f join private.file_interactive_overrides o on o.file_id=f.id where f.owner_id=target_user and o.owner_id=target_user),'[]'::jsonb),
    'game_saves',coalesce((select jsonb_agg(to_jsonb(g)-'owner_id' order by game_id,slot) from private.game_saves g where owner_id=target_user),'[]'::jsonb),
    'game_participation',coalesce((select jsonb_agg(jsonb_build_object('game',r.game_id,'room',m.room_id,'player',m.player_id,'data',p.payload,'expiresAt',r.expires_at)) from private.game_members m join private.game_rooms r on r.id=m.room_id join public.game_player_state p using(room_id,player_id) where m.user_id=target_user),'[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'approved_by' order by a.id) from public.story_assets a join public.stories s on s.id = a.story_id where s.author_id = target_user),'[]'::jsonb),
    'objects', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'path',o.name,'size',o.metadata->>'size','type',o.metadata->>'mimetype','updated_at',o.updated_at) order by o.name) from storage.objects o where bucket_id = 'fas-story-images' and split_part(name,'/',1) = target_user::text),'[]'::jsonb)
  ) into payload;
  if payload->'profile' = 'null'::jsonb then raise exception 'Account unavailable'; end if;
  return jsonb_build_object('data',payload,'fingerprint',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end; $$;

create or replace function public.fas_public_story(story_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'slug',s.slug,'title',s.title,'body',s.body,'summary',s.summary,'content_type',s.content_type,
  'metadata',s.metadata,'game_features',case when s.content_type='game' then jsonb_build_object('saves',coalesce((s.executable_package->'settings'->>'saves')::boolean,false),'multiplayer',coalesce(s.executable_package->'settings'->>'multiplayer','off')) else null end,'genre',s.genre,'genres',s.genres,'tags',s.tags,'content_warning',s.content_warning,'body_document',s.body_document,
  'scene_style',s.scene_style,'drop_caps',s.drop_caps,'paragraph_style',s.paragraph_style,'language',s.language,
  'reading_minutes',greatest(1,ceil(cardinality(regexp_split_to_array(btrim(s.body),'\s+'))/225.0)),
  'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text,'width',a.pixel_width,'height',a.pixel_height) from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and (a.verified_at is not null or a.approved_at is not null)),
  'published_at',s.published_at,'updated_at',s.updated_at,'author',private.public_publishing_author(s.author_id,s.publishing_identity))
 from public.stories s join public.profiles p on p.id=s.author_id where s.slug=story_slug and s.status='published' and private.account_active(p.id)
 and exists(select 1 from public.user_roles where user_id=p.id and role='member') and char_length(story_slug)<=120 and private.public_publishing_author(s.author_id,s.publishing_identity) is not null;
$$;
update private.file_content set image='/assets/images/covers/rally-clash.jpg',image_alt='Arcade Rally Clash artwork' where url='/games/rally-clash/';
update private.file_content set image='/assets/images/covers/brick-blitz.jpg',image_alt='Arcade Brick Blitz artwork' where url='/games/brick-blitz/';
update private.file_content set image='/assets/images/covers/genre-randomizer.jpg',image_alt='Genre Randomizer artwork' where url='/tools/genre-randomizer/';
update private.file_content set image='/assets/images/covers/countdown.jpg',image_alt='Countdown tool artwork' where url='/tools/countdown/';
update private.file_content set image='/assets/images/covers/onto-the-stage.jpg',image_alt='A nervous performer looking through a red theatre curtain towards the audience' where url='/stories/onto-the-stage/';
update private.file_content set image='/assets/images/covers/moon-hoc-meeting.jpg',image_alt='Featured artwork for Moon HOC Meeting' where url='/stories/moon-hoc-meeting/';
update private.file_content set image='/assets/images/covers/the-deal.jpg',image_alt='Featured artwork for The Deal' where url='/stories/the-deal/';
update private.file_content set image='/assets/images/covers/a-place-left-behind.jpg',image_alt='Featured artwork for A Place Left Behind' where url='/stories/a-place-left-behind/';
update private.file_content set image='/assets/images/covers/the-labyrinth.jpg',image_alt='Featured artwork for The Labyrinth' where url='/stories/the-labyrinth/';
update private.file_content set image='/assets/images/covers/sunset-at-the-lighthouse.jpg',image_alt='Featured artwork for Sunset at the Lighthouse' where url='/stories/sunset-at-the-lighthouse/';
update private.file_content set image='/assets/images/covers/crypt-of-the-blood-jewel.jpg',image_alt='Featured artwork for Crypt of the Blood Jewel' where url='/stories/crypt-of-the-blood-jewel/';
update private.file_content set image='/assets/images/covers/date-night-jigsaw.jpg',image_alt='Featured artwork for Date Night Jigsaw' where url='/stories/date-night-jigsaw/';
update private.file_content set image='/assets/images/covers/tea-at-the-summit.jpg',image_alt='Featured artwork for Tea at the Summit' where url='/stories/tea-at-the-summit/';
update private.file_content set image='/assets/images/covers/michaels-choice.jpg',image_alt='Featured artwork for Michael''s Choice' where url='/stories/michaels-choice/';
notify pgrst,'reload schema';
commit;
