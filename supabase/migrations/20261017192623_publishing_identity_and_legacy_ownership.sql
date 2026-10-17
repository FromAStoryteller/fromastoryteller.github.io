begin;
-- Ownership is private. Publishing identity is a separate public presentation.
create table private.fas_publishers(user_id uuid primary key references public.profiles(id) on delete cascade);
create table private.publishing_brand(
 singleton boolean primary key default true check(singleton),
 public_id uuid not null unique default 'fa500000-0000-4000-8000-000000000001',
 owner_id uuid references public.profiles(id) on delete set null,
 display_name text not null default 'From A Storyteller',
 social_links jsonb not null default '[{"platform":"facebook","url":"https://www.facebook.com/fromastoryteller/"},{"platform":"instagram","url":"https://www.instagram.com/fromastoryteller/"},{"platform":"tiktok","url":"https://www.tiktok.com/@fromastoryteller/"},{"platform":"youtube","url":"https://www.youtube.com/@fromastoryteller/"}]'
);
insert into private.publishing_brand(singleton) values(true);
-- The reviewed, separately targeted owner-claim operation binds an existing account.
-- Portable schema installation never embeds an Auth/profile generated identifier.
alter table public.stories add column publishing_identity text not null default 'personal' check(publishing_identity in ('personal','fas'));
grant insert(publishing_identity),update(publishing_identity) on public.stories to authenticated;
create function private.guard_publishing_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.content_type='tool' then new.publishing_identity:='fas';end if;
 -- Existing attribution can still be archived by moderation after access revocation.
 if TG_OP='UPDATE' and new.publishing_identity is not distinct from old.publishing_identity and new.author_id=old.author_id and new.content_type=old.content_type then return new;end if;
 if new.publishing_identity='fas' and not exists(select 1 from private.fas_publishers where user_id=new.author_id) then raise exception 'FAS publishing access required';end if;
 return new;
end;$$;
revoke all on function private.guard_publishing_identity() from public,anon,authenticated;
create trigger fas_publishing_identity before insert or update on public.stories for each row execute function private.guard_publishing_identity();

create table private.file_content(
 id uuid primary key,
 owner_id uuid references public.profiles(id) on delete set null,
 url text not null unique check(url~'^/(stories|games|tools|blog|videos)/[a-z0-9]+(-[a-z0-9]+)*/$'),
 content_type text not null references public.studio_content_types(id),
 title text not null,summary text not null,slug text not null,
 published_at timestamptz not null,updated_at timestamptz not null default now(),
 image text not null check(image~'^/assets/images/[a-z0-9/_-]+\.(jpg|jpeg|png|webp)$'),
 image_alt text not null,
 publishing_identity text not null default 'personal' check(publishing_identity in ('personal','fas')),
 check(content_type<>'tool' or publishing_identity='fas')
);
create index file_content_owner_library on private.file_content(owner_id,updated_at desc,id);
-- Deterministic UUIDs preserve page/report identity across byline and title changes.
insert into private.file_content(id,owner_id,url,content_type,title,summary,slug,published_at,image,image_alt,publishing_identity)
select md5('fas-file:'||v.url)::uuid,null::uuid,v.url,v.content_type,v.title,v.summary,v.slug,v.published_at::timestamptz,v.image,v.image_alt,v.publishing_identity
from (values
('/games/rally-clash/', 'game', 'Arcade: Rally Clash', 'Take on the computer in this Pong-inspired browser arcade game. Stay sharp, return the ball, and be the first to reach 5 points.', 'rally-clash', '2026-03-22', '/assets/images/games/rally-clash.jpg', 'Arcade Rally Clash artwork', 'personal'),
('/games/brick-blitz/', 'game', 'Arcade: Brick Blitz', 'A Breakout-inspired browser arcade game. It focuses on fast reactions, satisfying rebounds, and chasing a highscore.', 'brick-blitz', '2026-03-31', '/assets/images/games/brick-blitz.jpg', 'Arcade Brick Blitz artwork', 'personal'),
('/tools/genre-randomizer/', 'tool', 'Genre Randomizer', 'Generate a random genre for your next story.', 'genre-randomizer', '2026-04-09', '/assets/images/tools/genre-randomizer.jpg', 'Genre Randomizer artwork', 'fas'),
('/tools/countdown/', 'tool', 'Countdown', 'Set a focused countdown timer for writing, coding, planning, or creative work.', 'countdown', '2026-05-21', '/assets/images/tools/countdown.jpg', 'Countdown tool artwork', 'fas'),
('/stories/onto-the-stage/', 'story', 'Onto the Stage', 'On the final night of a successful theatre run, Arthur must overcome his fear of his father''s judgement and find the courage to step onto the stage.', 'onto-the-stage', '2026-08-03', '/assets/images/stories/onto-the-stage.png', 'A nervous performer looking through a red theatre curtain towards the audience', 'personal'),
('/stories/moon-hoc-meeting/', 'story', 'Moon HOC Meeting', 'After being removed from the Moon Sector C homeowners committee, Tyson leaves behind one final message—and an explosive objection to its rules.', 'moon-hoc-meeting', '2026-08-04', '/assets/images/stories/moon-hoc-meeting.png', 'Featured artwork for Moon HOC Meeting', 'personal'),
('/stories/the-deal/', 'story', 'The Deal', 'Desperate to bring back her little sister, Dina enters a moonless forest to complete her side of a dangerous bargain with an unseen entity.', 'the-deal', '2026-08-05', '/assets/images/stories/the-deal.png', 'Featured artwork for The Deal', 'personal'),
('/stories/a-place-left-behind/', 'story', 'A Place Left Behind', 'Zachary returns to an abandoned house scarred by fire, where familiar rooms, old photographs and a small pink-taped key draw him back into memories of what was lost.', 'a-place-left-behind', '2026-08-09', '/assets/images/stories/a-place-left-behind.jpg', 'Featured artwork for A Place Left Behind', 'personal'),
('/stories/the-labyrinth/', 'story', 'The Labyrinth', 'Areteon and Dolosa enter a deadly labyrinth in pursuit of glory and freedom, but escaping its final challenge may demand a sacrifice neither expected.', 'the-labyrinth', '2026-08-10', '/assets/images/stories/the-labyrinth.png', 'Featured artwork for The Labyrinth', 'personal'),
('/stories/sunset-at-the-lighthouse/', 'story', 'Sunset at the Lighthouse', 'Every sunset for nearly a year, Erin waits at the lighthouse for Lyndsey to return. As another day fades into darkness, a familiar whistle carries across the ocean.', 'sunset-at-the-lighthouse', '2026-08-11', '/assets/images/stories/sunset-at-the-lighthouse.png', 'Featured artwork for Sunset at the Lighthouse', 'personal'),
('/stories/crypt-of-the-blood-jewel/', 'story', 'Crypt of the Blood Jewel', 'After breaking into a long-lost crypt, treasure hunter Kieren finally finds the legendary Blood Jewel. But a single drop of blood awakens something that has been waiting in the darkness.', 'crypt-of-the-blood-jewel', '2026-08-12', '/assets/images/stories/crypt-of-the-blood-jewel.jpg', 'Featured artwork for Crypt of the Blood Jewel', 'personal'),
('/stories/date-night-jigsaw/', 'story', 'Date Night Jigsaw', 'When a mysterious jigsaw arrives on Catherine and Bruce''s doorstep for their date night, the picture slowly reveals something disturbingly familiar.', 'date-night-jigsaw', '2026-08-13', '/assets/images/stories/date-night-jigsaw.png', 'Featured artwork for Date Night Jigsaw', 'personal'),
('/stories/tea-at-the-summit/', 'story', 'Tea at the Summit', 'Eleanor climbs through the snow toward a mountain summit, carrying tea, an urn, and the promise of one final moment with someone she loved.', 'tea-at-the-summit', '2026-08-14', '/assets/images/stories/tea-at-the-summit.png', 'Featured artwork for Tea at the Summit', 'personal'),
('/stories/michaels-choice/', 'story', 'Michael''s Choice', 'After failing to defend his friend from a vicious attack, Michael must face the cost of his silence and decide what kind of man he wants to become.', 'michaels-choice', '2026-08-16', '/assets/images/stories/michaels-choice.png', 'Featured artwork for Michael''s Choice', 'personal')
) v(url,content_type,title,summary,slug,published_at,image,image_alt,publishing_identity);
alter table private.file_content enable row level security;
alter table private.fas_publishers enable row level security;
alter table private.publishing_brand enable row level security;
revoke all on private.file_content,private.fas_publishers,private.publishing_brand from public,anon,authenticated;
grant all on private.file_content,private.fas_publishers,private.publishing_brand to service_role;

create function private.public_publishing_author(owner_key uuid,identity_key text) returns jsonb language sql stable security definer set search_path='' as $$
 select case when identity_key='fas' then (select jsonb_build_object('public_id',b.public_id,'display_name',b.display_name,'social_links',b.social_links,'kind','organization') from private.publishing_brand b where singleton and exists(select 1 from private.fas_publishers where user_id=p.id))
 else jsonb_build_object('public_id',p.public_id,'display_name',p.display_name,'social_links',p.social_links,'kind','person') end
 from public.profiles p where p.id=owner_key and private.account_active(p.id) and exists(select 1 from public.user_roles where user_id=p.id and role='member');
$$;
revoke all on function private.public_publishing_author(uuid,text) from public,anon,authenticated;
create function public.fas_my_publishing_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 return jsonb_build_object('can_publish_as_fas',exists(select 1 from private.fas_publishers where user_id=caller),'brand',(select jsonb_build_object('public_id',public_id,'display_name',display_name,'social_links',social_links) from private.publishing_brand where singleton));
end;$$;
revoke all on function public.fas_my_publishing_options() from public,anon,authenticated;
grant execute on function public.fas_my_publishing_options() to authenticated;

create function public.fas_public_file_content(content_path text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',f.id,'source_kind','file','url',f.url,'slug',f.slug,'title',f.title,'summary',f.summary,'content_type',f.content_type,'published_at',f.published_at,'updated_at',f.updated_at,'preview_image',f.image,'preview_alt',f.image_alt,'author',a.author)
 from private.file_content f cross join lateral(select private.public_publishing_author(f.owner_id,f.publishing_identity) as author)a
 where f.url=content_path and char_length(content_path)<=200 and a.author is not null;
$$;
create function public.fas_public_file_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.fas_public_file_content(url) order by url) filter(where private.public_publishing_author(owner_id,publishing_identity) is not null),'[]') from private.file_content;
$$;
revoke all on function public.fas_public_file_content(text),public.fas_public_file_catalog() from public,anon,authenticated;
grant execute on function public.fas_public_file_content(text),public.fas_public_file_catalog() to anon,authenticated;

create function public.fas_update_file_publishing(content_key uuid,expected_version timestamptz,identity_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;item private.file_content;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if identity_key is null or identity_key not in ('personal','fas') then raise exception 'Choose a publishing name';end if;
 select * into item from private.file_content where id=content_key and owner_id=caller for update;
 if not found or item.updated_at is distinct from expected_version then raise exception 'Content changed or unavailable. Reopen it from Your work';end if;
 if item.content_type='tool' and identity_key<>'fas' then raise exception 'Tools always publish as From A Storyteller';end if;
 if identity_key='fas' and not exists(select 1 from private.fas_publishers where user_id=caller) then raise exception 'FAS publishing access required';end if;
 update private.file_content set publishing_identity=identity_key,updated_at=clock_timestamp() where id=item.id;
 return (select jsonb_build_object('id',id,'updated_at',updated_at,'publishing_identity',publishing_identity) from private.file_content where id=item.id);
end;$$;
revoke all on function public.fas_update_file_publishing(uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.fas_update_file_publishing(uuid,timestamptz,text) to authenticated;

create or replace function public.fas_public_story(story_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'slug',s.slug,'title',s.title,'body',s.body,'summary',s.summary,'content_type',s.content_type,
  'genre',s.genre,'genres',s.genres,'tags',s.tags,'content_warning',s.content_warning,'body_document',s.body_document,
  'scene_style',s.scene_style,'drop_caps',s.drop_caps,'paragraph_style',s.paragraph_style,'language',s.language,
  'reading_minutes',greatest(1,ceil(cardinality(regexp_split_to_array(btrim(s.body),'\s+'))/225.0)),
  'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text,'width',a.pixel_width,'height',a.pixel_height) from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and (a.verified_at is not null or a.approved_at is not null)),
  'published_at',s.published_at,'updated_at',s.updated_at,'author',private.public_publishing_author(s.author_id,s.publishing_identity))
 from public.stories s join public.profiles p on p.id=s.author_id where s.slug=story_slug and s.status='published' and private.account_active(p.id)
 and exists(select 1 from public.user_roles where user_id=p.id and role='member') and char_length(story_slug)<=120 and private.public_publishing_author(s.author_id,s.publishing_identity) is not null;
$$;

-- One published projection for community and existing file-backed work.
create function private.public_publishing_work() returns table(owner_id uuid,identity_key text,id uuid,published_at timestamptz,item jsonb) language sql stable security definer set search_path='' as $$
 select s.author_id,s.publishing_identity,s.id,s.published_at,
 jsonb_build_object('id',s.id,'slug',s.slug,'title',s.title,'summary',s.summary,'content_type',s.content_type,'published_at',s.published_at,'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text) from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and (a.verified_at is not null or a.approved_at is not null)))
 from public.stories s where status='published' and private.public_publishing_author(s.author_id,s.publishing_identity) is not null
 union all select f.owner_id,f.publishing_identity,f.id,f.published_at,
 jsonb_build_object('id',f.id,'source_kind','file','url',f.url,'slug',f.slug,'title',f.title,'summary',f.summary,'content_type',f.content_type,'published_at',f.published_at,'preview_image',f.image,'preview_alt',f.image_alt)
 from private.file_content f where private.public_publishing_author(f.owner_id,f.publishing_identity) is not null;
$$;
revoke all on function private.public_publishing_work() from public,anon,authenticated;
create or replace function public.fas_public_profile(profile_key uuid,page_offset integer default 0) returns jsonb language sql stable security definer set search_path='' as $$
 with identity as (
 select p.public_id,p.display_name,p.bio,p.welcome_line,p.social_links,p.id as owner_id,'personal'::text as identity_key from public.profiles p where p.public_id=profile_key and private.public_publishing_author(p.id,'personal') is not null
 union all select b.public_id,b.display_name,'Stories, games and useful things from From A Storyteller.','',b.social_links,null::uuid,'fas' from private.publishing_brand b where b.public_id=profile_key and singleton
 ), work as (select w.* from private.public_publishing_work() w join identity i on w.identity_key=i.identity_key and (i.identity_key='fas' or w.owner_id=i.owner_id))
 select jsonb_build_object('public_id',i.public_id,'display_name',i.display_name,'bio',i.bio,'welcome_line',i.welcome_line,'social_links',i.social_links,
 'stories',coalesce((select jsonb_agg(item order by published_at desc,id) from(select * from work order by published_at desc,id limit 12 offset page_offset)x),'[]'),
 'next_offset',case when (select count(*) from work)>page_offset+12 then page_offset+12 else null end)
 from identity i where page_offset between 0 and 1000000;
$$;

create or replace function public.fas_my_studio_work(search_text text default '',type_filter text default '',state_filter text default '',before_time timestamptz default null,after_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid;result jsonb;cursor jsonb;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if search_text is null or char_length(search_text)>200 or type_filter is null or state_filter is null or state_filter not in ('','draft','scheduled','published','archived','needs-update') or (before_time is null)<>(after_id is null) then raise exception 'Invalid library filters';end if;
 with all_work as (
 select s.id,s.title,s.slug,s.status::text,s.published_at,s.slug_locked,s.updated_at,s.content_type,s.scheduled_at,s.metadata_version,private.studio_missing_metadata(s) as missing,(s.metadata_version>0 or s.status='published') and (s.metadata_version<c.metadata_version or cardinality(private.studio_missing_metadata(s))>0) as needs_metadata_update,s.publishing_identity,'studio'::text as source_kind,null::text as url from public.stories s join public.studio_content_types c on c.id=s.content_type where s.author_id=caller
 union all select id,title,slug,'published',published_at,true,updated_at,content_type,null::timestamptz,0,'{}'::text[],false,publishing_identity,'file',url from private.file_content where owner_id=caller
 ), page as(select * from all_work where (search_text='' or position(lower(search_text) in lower(title))>0) and (type_filter='' or content_type=type_filter) and (state_filter='' or state_filter='scheduled' and scheduled_at is not null or state_filter='draft' and status='draft' and scheduled_at is null or state_filter in ('published','archived') and status=state_filter or state_filter='needs-update' and needs_metadata_update) and (before_time is null or updated_at<before_time or updated_at=before_time and id>after_id) order by updated_at desc,id limit 21),
 limited as(select * from page order by updated_at desc,id limit 20)
 select coalesce(jsonb_agg((to_jsonb(limited)-'missing')||jsonb_build_object('missing_metadata',missing) order by updated_at desc,id),'[]'),
 case when(select count(*) from page)>20 then(select jsonb_build_object('updated_at',updated_at,'id',id) from limited order by updated_at asc,id desc limit 1) else null end into result,cursor from limited;
 return jsonb_build_object('items',result,'next_cursor',cursor);
end;$$;

create or replace function private.attribute_page_report() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_key uuid;
begin
 if TG_OP='UPDATE' and (new.page_kind is distinct from old.page_kind or new.page_id is distinct from old.page_id or new.beneficiary_id is distinct from old.beneficiary_id or new.provider is distinct from old.provider or new.report_key is distinct from old.report_key) then raise exception 'Report ownership is immutable';end if;
 if TG_OP='INSERT' then
  if new.page_kind='content' then select author_id into owner_key from public.stories where id=new.page_id;
   if owner_key is null then select owner_id into owner_key from private.file_content where id=new.page_id;end if;
  elsif new.page_kind='profile' then select id into owner_key from public.profiles where public_id=new.page_id;
   if owner_key is null and exists(select 1 from private.publishing_brand where public_id=new.page_id) then select owner_id into owner_key from private.publishing_brand where public_id=new.page_id;end if;
  else owner_key:=null;end if;
  if new.page_kind<>'site' and owner_key is null then raise exception 'Page owner unavailable';end if;
  if new.page_kind='site' then new.beneficiary_id:=null;
  else select id into new.beneficiary_id from private.creator_beneficiaries where user_id=owner_key;end if;
 end if;return new;
end;$$;
commit;
