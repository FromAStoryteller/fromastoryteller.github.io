begin;
set local lock_timeout='3s';
-- Private membership for homepage ordering. Never return profiles or timestamps.
create function private.my_following_ids() returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid;ids jsonb;
begin
 caller:=private.require_operator_session();
 select coalesce(jsonb_agg(profile_key order by profile_key),'[]'::jsonb) into ids
 from (
  select f.profile_key
  from private.storyteller_follows f
  left join public.profiles p on p.public_id=f.person_key
  left join private.publishing_brand b on b.public_id=f.brand_key
  where f.follower_id=caller and (
   b.public_id is not null or
   p.id is not null and private.public_publishing_author(p.id,'personal') is not null
  )
  order by f.profile_key limit 5001
 ) eligible;
 if jsonb_array_length(ids)>5000 then raise exception 'Following limit exceeded';end if;
 return ids;
end;$$;
create function public.fas_my_following_ids() returns jsonb
language sql security invoker set search_path='' as $$select private.my_following_ids();$$;
revoke all on function private.my_following_ids(),public.fas_my_following_ids() from public,anon,authenticated,service_role;
grant execute on function private.my_following_ids(),public.fas_my_following_ids() to authenticated;
notify pgrst,'reload schema';
commit;
