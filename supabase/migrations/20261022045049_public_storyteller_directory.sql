begin;
-- Discovery uses exactly the public contributor gate used by profile pages.
-- No account IDs, emails, roles, private work or viewer profiles are returned.
create function private.public_profile_catalog(query_text text default '',after_name text default null,after_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;cursor jsonb;begin
 query_text:=btrim(coalesce(query_text,''));
 if length(query_text)>100 or length(after_name)>80 or (after_name is null)<>(after_id is null) then raise exception 'Invalid storyteller search';end if;
 with identities as(
  select p.public_id,p.display_name,p.welcome_line,p.bio,
   case when p.image_id is not null then jsonb_build_object('asset_id',p.image_id,'alt',p.image_alt) end image,'person'::text kind
  from public.profiles p join public.user_roles r on r.user_id=p.id and r.role='member' where private.public_publishing_author(p.id,'personal') is not null
  union all select b.public_id,b.display_name,''::text,'Stories, games and useful things from From A Storyteller.',null::jsonb,'organization'::text
  from private.publishing_brand b where b.singleton
 ), page as materialized(
  select * from identities i where (query_text='' or position(lower(query_text) in lower(i.display_name||' '||coalesce(i.welcome_line,'')||' '||coalesce(i.bio,'')))>0)
  and (after_name is null or (lower(i.display_name),i.public_id)>(after_name,after_id))
  order by lower(i.display_name),i.public_id limit 25
 ),limited as(select * from page order by lower(display_name),public_id limit 24)
 select coalesce(jsonb_agg(jsonb_build_object('public_id',public_id,'display_name',display_name,'welcome_line',welcome_line,'bio',bio,'image',image,'kind',kind) order by lower(display_name),public_id),'[]'),
  case when (select count(*) from page)>24 then (select jsonb_build_object('name',lower(display_name),'id',public_id) from limited order by lower(display_name) desc,public_id desc limit 1) end
 into items,cursor from limited;
 return jsonb_build_object('items',items,'next_cursor',cursor);
end;$$;
create function public.fas_public_profile_catalog(query_text text default '',after_name text default null,after_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$select private.public_profile_catalog(query_text,after_name,after_id);$$;
revoke all on function private.public_profile_catalog(text,text,uuid),public.fas_public_profile_catalog(text,text,uuid) from public,anon,authenticated;
grant execute on function private.public_profile_catalog(text,text,uuid),public.fas_public_profile_catalog(text,text,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
