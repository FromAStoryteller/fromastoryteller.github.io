begin;
-- Provider imports only. Browsers cannot submit views, impressions or earnings.
create table private.studio_reporting_config(singleton boolean primary key default true check(singleton),provider text,connected_at timestamptz,monetization_enabled boolean not null default false);
insert into private.studio_reporting_config(singleton) values(true);
create table private.creator_beneficiaries(id uuid primary key default gen_random_uuid(),user_id uuid unique references public.profiles(id) on delete set null,created_at timestamptz not null default now());
insert into private.creator_beneficiaries(user_id) select id from public.profiles;
create function private.new_creator_beneficiary() returns trigger language plpgsql security definer set search_path='' as $$begin insert into private.creator_beneficiaries(user_id) values(new.id);return new;end;$$;
revoke all on function private.new_creator_beneficiary() from public,anon,authenticated;
create trigger fas_creator_beneficiary after insert on public.profiles for each row execute function private.new_creator_beneficiary();
create table private.page_performance_reports(
 id bigint generated always as identity primary key,
 provider text not null check(char_length(provider) between 1 and 60),report_key text not null check(char_length(report_key) between 1 and 200),
 report_date date not null,page_kind text not null check(page_kind in ('content','profile','site')),page_id uuid,page_path text,
 beneficiary_id uuid references private.creator_beneficiaries(id),source_group text not null default 'direct' check(char_length(source_group) between 1 and 80),
 device_group text not null default 'unknown' check(device_group in ('desktop','mobile','tablet','unknown')),campaign text not null default '' check(char_length(campaign)<=120),
 views bigint not null default 0 check(views>=0),engaged_views bigint not null default 0 check(engaged_views between 0 and views),completed_reads bigint not null default 0 check(completed_reads between 0 and views),
 active_seconds bigint not null default 0 check(active_seconds>=0),ad_impressions bigint not null default 0 check(ad_impressions>=0),
 reported_revenue_micros bigint check(reported_revenue_micros>=0),currency text check(currency~'^[A-Z]{3}$'),imported_at timestamptz not null default now(),
 unique(provider,report_key),check((reported_revenue_micros is null)=(currency is null)),
 check((page_kind='site' and page_id is null and page_path is not null) or (page_kind in ('content','profile') and page_id is not null and page_path is null))
);
create index creator_reports_period on private.page_performance_reports(beneficiary_id,report_date desc);
create function private.attribute_page_report() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_key uuid;
begin
 if TG_OP='UPDATE' and (new.page_kind is distinct from old.page_kind or new.page_id is distinct from old.page_id or new.beneficiary_id is distinct from old.beneficiary_id or new.provider is distinct from old.provider or new.report_key is distinct from old.report_key) then raise exception 'Report ownership is immutable';end if;
 if TG_OP='INSERT' then
  if new.page_kind='content' then select author_id into owner_key from public.stories where id=new.page_id;
  elsif new.page_kind='profile' then select id into owner_key from public.profiles where public_id=new.page_id;
  else owner_key:=null;end if;
  if new.page_kind<>'site' and owner_key is null then raise exception 'Page owner unavailable';end if;
  if new.page_kind='site' then new.beneficiary_id:=null;
  else select id into new.beneficiary_id from private.creator_beneficiaries where user_id=owner_key;end if;
 end if;return new;
end;$$;
revoke all on function private.attribute_page_report() from public,anon,authenticated;
create trigger fas_attribute_report before insert or update on private.page_performance_reports for each row execute function private.attribute_page_report();
alter table private.studio_reporting_config enable row level security;
alter table private.creator_beneficiaries enable row level security;
alter table private.page_performance_reports enable row level security;
revoke all on private.studio_reporting_config,private.creator_beneficiaries,private.page_performance_reports from public,anon,authenticated;
grant all on private.studio_reporting_config,private.creator_beneficiaries,private.page_performance_reports to service_role;
grant usage,select on sequence private.page_performance_reports_id_seq to service_role;

create function public.fas_my_studio_traffic(page_key uuid default null,period_days integer default 30) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; creator_key uuid;
begin
 perform private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if period_days not in (7,30,90) then raise exception 'Choose 7, 30 or 90 days';end if;
 select id into creator_key from private.creator_beneficiaries where user_id=auth.uid();
 with rows as materialized(select r.* from private.page_performance_reports r where beneficiary_id=creator_key and report_date between current_date-period_days+1 and current_date and (page_key is null or page_id=page_key))
 select jsonb_build_object(
  'connected',(select connected_at is not null from private.studio_reporting_config where singleton),
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
revoke all on function public.fas_my_studio_traffic(uuid,integer) from public,anon,authenticated;
grant execute on function public.fas_my_studio_traffic(uuid,integer) to authenticated;
commit;
