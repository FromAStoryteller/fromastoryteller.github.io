begin;
-- Relationships and identities stay private. Public profiles never contain counts.
create table private.storyteller_follows(
 follower_id uuid not null references auth.users(id) on delete cascade,
 profile_key uuid not null,
 person_key uuid references public.profiles(public_id) on delete cascade,
 brand_key uuid references private.publishing_brand(public_id) on delete cascade,
 followed_at timestamptz not null default clock_timestamp(),
 primary key(follower_id,profile_key),
 check(num_nonnulls(person_key,brand_key)=1),
 check(profile_key=coalesce(person_key,brand_key))
);
create index storyteller_follows_target on private.storyteller_follows(profile_key,follower_id);
create index storyteller_follows_person on private.storyteller_follows(person_key) where person_key is not null;
create index storyteller_follows_brand on private.storyteller_follows(brand_key) where brand_key is not null;
alter table private.storyteller_follows enable row level security;
revoke all on private.storyteller_follows from public,anon,authenticated;
grant all on private.storyteller_follows to service_role;

create function private.follow_target(target_key uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('public_id',p.public_id,'display_name',p.display_name,'welcome_line',p.welcome_line,'bio',p.bio,'kind','person',
 'image',case when p.image_id is not null then jsonb_build_object('asset_id',p.image_id,'alt',p.image_alt) end)
 from public.profiles p where p.public_id=target_key and private.public_publishing_author(p.id,'personal') is not null
 union all select jsonb_build_object('public_id',b.public_id,'display_name',b.display_name,'welcome_line','','bio','Stories, games and useful things from From A Storyteller.','kind','organization','image',null)
 from private.publishing_brand b where b.public_id=target_key limit 1;
$$;
create function private.my_storyteller_follow(target_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;target jsonb;begin
 caller:=private.require_operator_session();target:=private.follow_target(target_key);
 return jsonb_build_object('available',target is not null,'can_follow',target is not null and not exists(select 1 from public.profiles where id=caller and public_id=target_key),
 'following',exists(select 1 from private.storyteller_follows where follower_id=caller and profile_key=target_key));
end;$$;
create function private.set_storyteller_follow(target_key uuid,enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;target jsonb;begin
 caller:=private.require_operator_session();
 if target_key is null or enabled is null then raise exception 'Choose a storyteller and follow action';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,146389896));
 if not private.account_active(caller) then raise exception 'Active account required';end if;
 if not enabled then delete from private.storyteller_follows where follower_id=caller and profile_key=target_key;
 else
  target:=private.follow_target(target_key);if target is null then raise exception 'Storyteller unavailable';end if;
  if exists(select 1 from public.profiles where id=caller and public_id=target_key) then raise exception 'You cannot follow your own profile';end if;
  if not exists(select 1 from private.storyteller_follows where follower_id=caller and profile_key=target_key) and (select count(*) from private.storyteller_follows where follower_id=caller)>=5000 then raise exception 'Your following list is full';end if;
  insert into private.storyteller_follows(follower_id,profile_key,person_key,brand_key)
  values(caller,target_key,case when target->>'kind'='person' then target_key end,case when target->>'kind'='organization' then target_key end)
  on conflict(follower_id,profile_key) do nothing;
 end if;
 return jsonb_build_object('following',enabled);
end;$$;
create function private.my_following(after_name text default null,after_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;items jsonb;cursor jsonb;begin
 caller:=private.require_operator_session();
 if length(after_name)>80 or (after_name is null)<>(after_id is null) then raise exception 'Invalid following cursor';end if;
 with page as materialized(
  select f.profile_key,t from private.storyteller_follows f cross join lateral(select private.follow_target(f.profile_key) t) target
  where f.follower_id=caller and t is not null and (after_name is null or (lower(t->>'display_name'),f.profile_key)>(after_name,after_id))
  order by lower(t->>'display_name'),f.profile_key limit 25
 ),limited as(select * from page order by lower(t->>'display_name'),profile_key limit 24)
 select coalesce(jsonb_agg(t order by lower(t->>'display_name'),profile_key),'[]'),
 case when (select count(*) from page)>24 then (select jsonb_build_object('name',lower(t->>'display_name'),'id',profile_key) from limited order by lower(t->>'display_name') desc,profile_key desc limit 1) end
 into items,cursor from limited;
 return jsonb_build_object('items',items,'next_cursor',cursor);
end;$$;
create function private.my_follower_count() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;key uuid;result jsonb;begin
 caller:=private.require_operator_session();if not private.is_member() then raise exception 'Contributor access required';end if;
 select public_id into key from public.profiles where id=caller;
 select jsonb_build_object('people_following',count(*)) into result from private.storyteller_follows f
 where f.profile_key=key and private.account_active(f.follower_id);
 if private.is_admin() then
  result:=result||jsonb_build_object('fas_people_following',(select count(*) from private.storyteller_follows f join private.publishing_brand b on b.public_id=f.profile_key where private.account_active(f.follower_id)));
 end if;
 return result;
end;$$;
create function private.my_following_data() returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;begin
 caller:=private.require_operator_session();return coalesce((select jsonb_agg(jsonb_build_object('public_id',profile_key,'followed_at',followed_at) order by profile_key) from private.storyteller_follows where follower_id=caller),'[]');
end;$$;
create function public.fas_my_storyteller_follow(target_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.my_storyteller_follow(target_key);$$;
create function public.fas_set_storyteller_follow(target_key uuid,enabled boolean) returns jsonb language sql security invoker set search_path='' as $$select private.set_storyteller_follow(target_key,enabled);$$;
create function public.fas_my_following(after_name text default null,after_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.my_following(after_name,after_id);$$;
create function public.fas_my_follower_count() returns jsonb language sql security invoker set search_path='' as $$select private.my_follower_count();$$;
create function public.fas_my_following_data() returns jsonb language sql security invoker set search_path='' as $$select private.my_following_data();$$;
revoke all on function private.follow_target(uuid),private.my_storyteller_follow(uuid),private.set_storyteller_follow(uuid,boolean),private.my_following(text,uuid),private.my_follower_count(),private.my_following_data(),public.fas_my_storyteller_follow(uuid),public.fas_set_storyteller_follow(uuid,boolean),public.fas_my_following(text,uuid),public.fas_my_follower_count(),public.fas_my_following_data() from public,anon,authenticated;
grant execute on function private.my_storyteller_follow(uuid),private.set_storyteller_follow(uuid,boolean),private.my_following(text,uuid),private.my_follower_count(),private.my_following_data(),public.fas_my_storyteller_follow(uuid),public.fas_set_storyteller_follow(uuid,boolean),public.fas_my_following(text,uuid),public.fas_my_follower_count(),public.fas_my_following_data() to authenticated;

-- Include own relationships in complete content downloads and deletion fingerprints.
do $$declare definition text;needle text:='''viewer_actions'',';begin
 definition:=pg_get_functiondef('public.fas_account_snapshot(uuid,uuid)'::regprocedure);
 if position(needle in definition)=0 then raise exception 'Account snapshot shape changed; review following export';end if;
 execute replace(definition,needle,'''following'',coalesce((select jsonb_agg(jsonb_build_object(''public_id'',profile_key,''followed_at'',followed_at) order by profile_key) from private.storyteller_follows where follower_id=target_user),''[]''::jsonb),'||needle);
end;$$;
notify pgrst,'reload schema';
commit;
