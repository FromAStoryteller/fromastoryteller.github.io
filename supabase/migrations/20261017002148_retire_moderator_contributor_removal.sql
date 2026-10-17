begin;
-- Retire the unused legacy role without rewriting historical enum/audit values.
do $$ begin if exists(select 1 from public.user_roles where role::text='moderator') then raise exception 'Review legacy moderator accounts before retiring the role'; end if; end $$;
alter table public.user_roles add constraint fas_supported_roles check(role::text in ('member','admin'));
create or replace function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$ select private.is_admin(); $$;

-- Publication and contributor-role changes serialize per author. A concurrent save
-- either completes before removal (and is hidden) or is denied after removal.
create function private.require_contributor_write(owner_key uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 if owner_key is distinct from auth.uid() or not private.is_member() then raise exception 'Contributor access required'; end if;
end; $$;
revoke all on function private.require_contributor_write(uuid) from public,anon,authenticated;
grant execute on function private.require_contributor_write(uuid) to authenticated;

create function private.hide_removed_contributor_content() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_key uuid; hidden_count integer;
begin
 if TG_OP='INSERT' then if new.role<>'member' or exists(select 1 from public.user_roles where user_id=new.user_id and role='member') then return new; end if; owner_key:=new.user_id;
 else if old.role<>'member' then if TG_OP='DELETE' then return old; else return new; end if; end if;
  if TG_OP='UPDATE' and new.role=old.role and new.user_id=old.user_id then return new; end if;
  owner_key:=old.user_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 update public.stories set status='draft',published_at=null where author_id=owner_key and status='published';
 get diagnostics hidden_count=row_count;
 if hidden_count>0 then
  insert into private.admin_audit(actor_id,action,subject_id,details,reason) values(
   case when exists(select 1 from public.profiles where id=auth.uid()) then auth.uid() else null end,
   'contributor_content_hidden',owner_key,jsonb_build_object('stories_hidden',hidden_count),'Contributor access changed; published stories returned to private drafts');
 end if;
 if TG_OP='DELETE' then return old; end if; return new;
end; $$;
revoke all on function private.hide_removed_contributor_content() from public,anon,authenticated;
create trigger fas_hide_removed_contributor_content before insert or delete or update on public.user_roles for each row execute function private.hide_removed_contributor_content();

create or replace function private.guard_story() returns trigger
language plpgsql set search_path = '' as $$ begin
  if current_user='authenticated' then perform private.require_contributor_write(new.author_id); end if;
  if TG_OP = 'UPDATE' then
    if new.id is distinct from old.id or new.author_id is distinct from old.author_id
      or new.created_at is distinct from old.created_at then
      raise exception 'Story identity is immutable';
    end if;
    if current_user = 'authenticated' and
      (old.status = 'archived' or new.status not in ('draft','published')) then
      raise exception 'Contributors may save drafts or publish their own unmoderated stories';
    end if;
    new.updated_at := now();
  elsif current_user = 'authenticated' and new.status <> 'draft' then
    raise exception 'New stories must be drafts';
  end if;
  -- Publication timestamps are server-owned; live edits preserve first publication.
  if current_user <> 'authenticated' and TG_OP='INSERT' then return new; end if;
  if new.status = 'published' then
    if TG_OP = 'UPDATE' and old.status = 'published' then
      new.published_at := old.published_at;
    else new.published_at := now(); end if;
  else new.published_at := null; end if;
  return new;
end; $$;
-- Admin-only, bounded account directory. No direct Auth table access is granted.
create or replace function public.fas_admin_accounts(search_text text default '', role_filter text default 'all', page_offset integer default 0, sort_order text default 'name')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; term text:=lower(btrim(coalesce(search_text,'')));
begin
 perform private.require_admin();
 if char_length(term)>254 or role_filter is null or role_filter not in ('all','viewer','member','admin')
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

create or replace function public.fas_public_profile(profile_key uuid, page_offset integer default 0)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'public_id',p.public_id,'display_name',p.display_name,'bio',p.bio,'welcome_line',p.welcome_line,
    'stories',coalesce((select jsonb_agg(jsonb_build_object(
      'slug',s.slug,'title',s.title,'summary',s.summary,'published_at',s.published_at,
      'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text)
        from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and a.approved_at is not null)
      ) order by s.published_at desc,s.id)
      from (select slug,title,summary,published_at,id,cover_asset_id from public.stories
        where author_id=p.id and status='published' order by published_at desc,id limit 12 offset page_offset) s),'[]'::jsonb),
    'next_offset',case when (select count(*) from public.stories where author_id=p.id and status='published')>page_offset+12 then page_offset+12 else null end
  ) from public.profiles p
  where p.public_id=profile_key and page_offset between 0 and 1000000
    and private.account_active(p.id) and (
      exists(select 1 from public.user_roles where user_id=p.id and role='member'));
$$;
update public.stories s set status='draft',published_at=null where status='published' and not exists(select 1 from public.user_roles r where r.user_id=s.author_id and r.role='member');
commit;
