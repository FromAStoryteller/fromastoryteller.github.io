-- Admin-only, bounded account directory. No direct Auth table access is granted.
create function public.fas_admin_accounts(search_text text default '', role_filter text default 'all', page_offset integer default 0, sort_order text default 'name')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; term text:=lower(btrim(coalesce(search_text,'')));
begin
 perform private.require_admin();
 if char_length(term)>254 or role_filter is null or role_filter not in ('all','viewer','member','admin','moderator')
 or page_offset is null or page_offset<0 or page_offset>1000000
 or sort_order is null or sort_order not in ('name','newest','email') then raise exception 'Invalid account directory filters'; end if;
 with matching as materialized (
  select u.id,u.email,u.email_confirmed_at is not null as verified,p.display_name,p.public_id,p.created_at,
   coalesce((select jsonb_agg(r.role::text order by r.role::text) from public.user_roles r where r.user_id=u.id),'[]'::jsonb) as roles
  from auth.users u join public.profiles p on p.id=u.id
  where (term='' or strpos(lower(coalesce(u.email,'')),term)>0 or strpos(lower(p.display_name),term)>0)
   and (role_filter='all'
    or (role_filter='viewer' and not exists(select 1 from public.user_roles r where r.user_id=u.id))
    or exists(select 1 from public.user_roles r where r.user_id=u.id and r.role::text=role_filter))
 ), selected as (
  select * from matching order by
   case when sort_order='newest' then created_at end desc,
   case when sort_order='email' then lower(email) end,
   lower(display_name),id limit 25 offset page_offset
 )
 select jsonb_build_object('total',(select count(*) from matching),'accounts',coalesce((
  select jsonb_agg(jsonb_build_object('id',s.id,'email',s.email,'verified',s.verified,'display_name',s.display_name,
   'public_id',s.public_id,'created_at',s.created_at,'roles',s.roles,'active',private.account_active(s.id),
   'stories',(select count(*) from public.stories st where st.author_id=s.id))
   order by case when sort_order='newest' then s.created_at end desc,
    case when sort_order='email' then lower(s.email) end,lower(s.display_name),s.id)
  from selected s),'[]'::jsonb)) into result;
 return result;
end; $$;
revoke all on function public.fas_admin_accounts(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.fas_admin_accounts(text,text,integer,text) to authenticated;
