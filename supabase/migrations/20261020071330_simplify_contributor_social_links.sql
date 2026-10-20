begin;
-- A smaller public catalogue. Legacy stored links remain in private owner exports;
-- they are hidden publicly and replaced when the owner next saves supported links.
create function private.social_links_for_public(links jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('platform',value->>'platform','url',value->>'url') order by ord),'[]'::jsonb)
 from jsonb_array_elements(case when jsonb_typeof(links)='array' then links else '[]'::jsonb end) with ordinality as row(value,ord)
 where value->>'platform'=any(array['instagram','facebook','tiktok','youtube','x']);
$$;
revoke all on function private.social_links_for_public(jsonb) from public,anon,authenticated;
grant execute on function private.social_links_for_public(jsonb) to authenticated,service_role;
create function private.guard_supported_social_links() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.social_links is not distinct from old.social_links then return new;end if;
 if new.social_links is distinct from private.social_links_for_public(new.social_links) then raise exception 'Choose Instagram, Facebook, TikTok, YouTube or X' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function private.guard_supported_social_links() from public,anon,authenticated;
create trigger fas_supported_social_links before insert or update of social_links on public.profiles for each row execute function private.guard_supported_social_links();
create or replace function private.public_publishing_author(owner_key uuid,identity_key text) returns jsonb language sql stable security definer set search_path='' as $$
 select case when identity_key='fas' then (select jsonb_build_object('public_id',b.public_id,'display_name',b.display_name,'social_links',private.social_links_for_public(b.social_links),'kind','organization') from private.publishing_brand b where singleton and private.can_publish_as_fas(p.id))
 else jsonb_build_object('public_id',p.public_id,'display_name',p.display_name,'social_links',private.social_links_for_public(p.social_links),'kind','person') end
 from public.profiles p where p.id=owner_key and private.account_active(p.id) and exists(select 1 from public.user_roles where user_id=p.id and role='member');
$$;
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
 select jsonb_build_object('public_id',i.public_id,'display_name',i.display_name,'bio',i.bio,'welcome_line',i.welcome_line,'social_links',private.social_links_for_public(i.social_links),'image',(select jsonb_build_object('asset_id',p.image_id,'alt',p.image_alt) from public.profiles p where p.id=i.owner_id and p.image_id is not null),
 'stories',coalesce((select jsonb_agg(item order by published_at desc,id) from(select * from work order by published_at desc,id limit 12 offset page_offset)x),'[]'),
 'next_offset',case when (select count(*) from work)>page_offset+12 then page_offset+12 else null end)
 from identity i where page_offset between 0 and 1000000;
$function$;
commit;
