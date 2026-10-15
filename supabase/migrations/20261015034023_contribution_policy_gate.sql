begin;
create function private.current_policies_accepted(account_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.account_policy_requirement r where singleton and
   (r.release_id is null or exists(select 1 from private.account_policy_releases p
    join private.account_policy_agreements a using(release_id)
    where p.release_id=r.release_id and p.status='published' and p.published_at<=now() and a.user_id=account_id)));
$$;
revoke all on function private.current_policies_accepted(uuid) from public,anon,authenticated;
-- Existing story/asset/Storage write policies already call is_member().
-- Public/owned reads, profile correction, exports, deletion and staff operations
-- do not acquire an agreement requirement through this contribution gate.
create or replace function private.is_member() returns boolean
language sql stable security definer set search_path='' as $$
 select private.account_active((select auth.uid()))
   and private.current_policies_accepted((select auth.uid()))
   and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role in ('member','moderator','admin'));
$$;
commit;
