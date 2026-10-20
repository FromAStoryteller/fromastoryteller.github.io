begin;
-- Contributor-only photo uploads; former contributors may still remove a saved image.
create or replace function private.reserve_image_upload(owner_key uuid,session_key uuid,image_path text,image_kind text) returns boolean language plpgsql security definer set search_path='' as $$declare target_id uuid; story public.stories; stored_owner uuid:=owner_key;begin
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 perform private.require_account_session(owner_key,session_key);
 if not private.account_active(owner_key) or not private.current_policies_accepted(owner_key) then raise exception 'Active account required';end if;
 if image_kind not in ('cover','profile') or image_kind is null or image_path!~'^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$' then raise exception 'Invalid upload path';end if;
 target_id:=split_part(image_path,'/',2)::uuid;
 if image_kind='cover' then
  select * into story from public.stories where id=target_id and status<>'archived' for update;
  if not found or not private.can_edit_studio_content(story.author_id,story.publishing_identity,owner_key) then raise exception 'Owned editable content required';end if;stored_owner:=story.author_id;
 else
  if not exists(select 1 from public.user_roles where user_id=owner_key and role='member') then raise exception 'Contributor access required';end if;
  if split_part(image_path,'/',1)<>owner_key::text or not exists(select 1 from public.profiles where id=owner_key and public_id=target_id) then raise exception 'Owned profile required';end if;
 end if;
 if split_part(image_path,'/',1)<>stored_owner::text then raise exception 'Invalid stored owner';end if;
 if exists(select 1 from private.image_cleanup where path=image_path) then raise exception 'Retired image path';end if;
 insert into private.image_uploads(path,owner_id,kind) values(image_path,stored_owner,image_kind);
 return true;
end;$$;
create or replace function private.register_profile_image(owner_key uuid,session_key uuid,image_path text,image_alt text,expected_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare current_profile public.profiles;asset_key uuid:=gen_random_uuid();begin
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 perform private.require_account_session(owner_key,session_key);
 if not private.account_active(owner_key) or not private.current_policies_accepted(owner_key) then raise exception 'Active account required';end if;
 if not exists(select 1 from public.user_roles where user_id=owner_key and role='member') then raise exception 'Contributor access required';end if;
 select * into current_profile from public.profiles where id=owner_key for update;
 if current_profile.image_version is distinct from expected_version then raise exception 'Profile image changed; reload before replacing' using errcode='P0002';end if;
 if image_path !~('^'||owner_key::text||'/'||current_profile.public_id::text||'/[a-f0-9-]{36}[.]jpg$') or char_length(btrim(image_alt)) not between 1 and 500 then raise exception 'Invalid profile image';end if;
 update private.image_uploads set state='active' where path=image_path and owner_id=owner_key and kind='profile' and state='pending';
 if not found then raise exception 'Upload expired or unavailable';end if;
 update public.profiles set image_id=asset_key,image_path=register_profile_image.image_path,image_alt=btrim(register_profile_image.image_alt),image_version=gen_random_uuid() where id=owner_key returning * into current_profile;
 return jsonb_build_object('asset_id',current_profile.image_id,'alt',current_profile.image_alt,'version',current_profile.image_version);
end;$$;
create or replace function private.change_profile_image(expected_version uuid,image_alt text,remove_image boolean) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;current_profile public.profiles;begin
 caller:=private.require_operator_session();
 if not private.current_policies_accepted(caller) then raise exception 'Current account agreements required';end if;
 if not remove_image and not private.is_member() then raise exception 'Contributor access required';end if;
 select * into current_profile from public.profiles where id=caller for update;
 if current_profile.image_version is distinct from expected_version or current_profile.image_id is null then raise exception 'Profile image changed; reload before editing' using errcode='P0002';end if;
 if remove_image is null or (not remove_image and char_length(btrim(image_alt)) not between 1 and 500) then raise exception 'Image description required';end if;
 update public.profiles set image_id=case when remove_image then null else profiles.image_id end,
 image_path=case when remove_image then null else profiles.image_path end,
 image_alt=case when remove_image then '' else btrim(change_profile_image.image_alt) end,image_version=gen_random_uuid()
 where id=caller returning * into current_profile;
 return jsonb_build_object('asset_id',current_profile.image_id,'alt',current_profile.image_alt,'version',current_profile.image_version);
end;$$;
create or replace function private.begin_profile_upload() returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;attempts integer;begin
 caller:=private.require_operator_session();perform private.require_contributor_write(caller);
 if not private.current_policies_accepted(caller) then raise exception 'Current account agreements required';end if;
 insert into private.studio_cover_limits(user_id,period,attempts) values(caller,date_trunc('hour',now()),1)
 on conflict(user_id) do update set period=excluded.period,attempts=case when studio_cover_limits.period=excluded.period then studio_cover_limits.attempts+1 else 1 end returning studio_cover_limits.attempts into attempts;
 if attempts>20 then raise exception 'Image upload limit reached. Try again later';end if;
 return (select jsonb_build_object('author_id',id,'public_id',public_id) from public.profiles where id=caller);
end;$$;
-- Only the collection Edge Function can increment these anonymous daily buckets.
create function private.record_page_view(page_kind text,page_key uuid,source_key text,device_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare bucket_key text;valid_page boolean:=false;
begin
 if page_kind not in ('content','profile') or page_kind is null or page_key is null or source_key is null or source_key not in ('direct','internal','search','social','other') or device_key is null or device_key not in ('desktop','mobile','tablet','unknown') then return false;end if;
 if page_kind='profile' then
  valid_page:=public.fas_public_profile(page_key) is not null;
 else
  select exists(select 1 from public.stories s where s.id=page_key and s.status='published' and public.fas_public_story(s.slug) is not null)
    or exists(select 1 from private.file_content f where f.id=page_key and public.fas_public_file_content(f.url) is not null) into valid_page;
 end if;
 if not valid_page then return false;end if;
 bucket_key:=current_date::text||':'||page_kind||':'||page_key::text||':'||source_key||':'||device_key;
 insert into private.page_performance_reports(provider,report_key,report_date,page_kind,page_id,source_group,device_group,views)
 values('FAS first-party',bucket_key,current_date,page_kind,page_key,source_key,device_key,1)
 on conflict(provider,report_key) do update set views=private.page_performance_reports.views+1,imported_at=now();
 return true;
end;$$;
create function public.fas_record_page_view(page_kind text,page_key uuid,source_key text,device_key text) returns boolean language sql set search_path='' as $$select private.record_page_view(page_kind,page_key,source_key,device_key);$$;
revoke all on function private.record_page_view(text,uuid,text,text),public.fas_record_page_view(text,uuid,text,text) from public,anon,authenticated;
grant execute on function private.record_page_view(text,uuid,text,text),public.fas_record_page_view(text,uuid,text,text) to service_role;
create function private.studio_traffic(page_key uuid default null,period_days integer default 30) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; creator_key uuid;
begin
 perform private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if period_days not in (7,30,90) then raise exception 'Choose 7, 30 or 90 days';end if;
 select id into creator_key from private.creator_beneficiaries where user_id=auth.uid();
 with rows as materialized(select r.* from private.page_performance_reports r where beneficiary_id=creator_key and report_date between current_date-period_days+1 and current_date and (page_key is null or page_id=page_key))
 select jsonb_build_object(
  'connected',(select connected_at is not null from private.studio_reporting_config where singleton),
  'collection_started_at',(select connected_at from private.studio_reporting_config where singleton),
  'provider',(select provider from private.studio_reporting_config where singleton),
  'monetization_enabled',(select monetization_enabled from private.studio_reporting_config where singleton),
  'views',coalesce(sum(views),0),'engaged_views',coalesce(sum(engaged_views),0),'completed_reads',coalesce(sum(completed_reads),0),'active_seconds',coalesce(sum(active_seconds),0),'ad_impressions',coalesce(sum(ad_impressions),0),
  'sources',coalesce((select jsonb_agg(to_jsonb(x) order by x.views desc) from(select source_group,sum(views) as views from rows group by source_group)x),'[]'::jsonb),
  'devices',coalesce((select jsonb_agg(to_jsonb(x) order by x.views desc) from(select device_group,sum(views) as views from rows group by device_group)x),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(to_jsonb(x) order by x.day) from(select report_date as day,sum(views) as views from rows group by report_date)x),'[]'::jsonb),
  'pages',coalesce((select jsonb_agg(to_jsonb(x) order by x.views desc) from(select page_id,page_kind,sum(views) as views from rows group by page_id,page_kind)x),'[]'::jsonb),
  'revenue',coalesce((select jsonb_agg(to_jsonb(x)) from(select currency,sum(reported_revenue_micros) as micros from rows where currency is not null group by currency)x),'[]'::jsonb),
  'last_imported_at',max(imported_at)) into result from rows;return result;
end;$$;
create or replace function public.fas_my_studio_traffic(page_key uuid default null,period_days integer default 30) returns jsonb language sql set search_path='' as $$select private.studio_traffic(page_key,period_days);$$;
revoke all on function private.studio_traffic(uuid,integer),public.fas_my_studio_traffic(uuid,integer) from public,anon,authenticated;
grant execute on function private.studio_traffic(uuid,integer),public.fas_my_studio_traffic(uuid,integer) to authenticated;
create index fas_first_party_retention on private.page_performance_reports(report_date) where provider='FAS first-party';
create function private.prune_page_views() returns void language sql security definer set search_path='' as $$delete from private.page_performance_reports where provider='FAS first-party' and report_date<current_date-89;$$;
revoke all on function private.prune_page_views() from public,anon,authenticated;
do $$begin if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.schedule('fas-page-view-retention','17 3 * * *','select private.prune_page_views();');end if;end;$$;
update private.studio_reporting_config set provider='FAS first-party',connected_at=now() where singleton and connected_at is null;
commit;
