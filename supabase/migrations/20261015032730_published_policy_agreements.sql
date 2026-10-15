begin;
-- Empty catalog + NULL requirement: installation never publishes policies,
-- reinterprets a test declaration or activates production registration.
create table private.account_policy_releases (
  release_id text primary key check(release_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  status text not null check(status in ('review','published')),
  published_at timestamptz,
  terms_version text not null,
  privacy_version text not null,
  terms_sha256 text not null check(terms_sha256 ~ '^[a-f0-9]{64}$'),
  privacy_sha256 text not null check(privacy_sha256 ~ '^[a-f0-9]{64}$'),
  terms_path text not null check(terms_path ~ '^/account/policy-history/[a-z0-9-]+/terms/$'),
  privacy_path text not null check(privacy_path ~ '^/account/policy-history/[a-z0-9-]+/privacy/$'),
  minimum_age integer not null default 16 check(minimum_age=16),
  check((status='published' and published_at is not null) or (status='review' and published_at is null))
);
create table private.account_policy_requirement (
  singleton boolean primary key default true check(singleton),
  release_id text references private.account_policy_releases(release_id)
);
insert into private.account_policy_requirement(singleton) values(true);
create table private.account_policy_agreements (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id text not null references private.account_policy_releases(release_id),
  source text not null check(source in ('signup','existing_account')),
  terms_agreed boolean not null check(terms_agreed),
  privacy_notice_seen boolean not null check(privacy_notice_seen),
  age_self_declared boolean not null check(age_self_declared),
  recorded_at timestamptz not null default now(),
  primary key(user_id,release_id)
);
alter table private.account_policy_releases enable row level security;
alter table private.account_policy_requirement enable row level security;
alter table private.account_policy_agreements enable row level security;
revoke all on private.account_policy_releases,private.account_policy_requirement,private.account_policy_agreements from public,anon,authenticated;

create function private.reject_policy_history_update() returns trigger
language plpgsql set search_path='' as $$ begin
  raise exception 'Policy history is immutable; create a new release';
end $$;
revoke all on function private.reject_policy_history_update() from public,anon,authenticated;
create trigger immutable_policy_releases before update or delete on private.account_policy_releases
for each row execute function private.reject_policy_history_update();
-- DELETE remains available to Auth FK cascade, not browser roles.
create trigger immutable_policy_agreements before update on private.account_policy_agreements
for each row execute function private.reject_policy_history_update();

create function private.policy_agreement_valid(metadata jsonb, target_release text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.account_policy_releases p
    where p.release_id=target_release and p.status='published' and p.published_at<=now()
    and coalesce(metadata @> jsonb_build_object('fas_policy_agreement',jsonb_build_object(
      'mode','published_terms_agreement','release_id',p.release_id,
      'terms_version',p.terms_version,'privacy_version',p.privacy_version,
      'terms_sha256',p.terms_sha256,'privacy_sha256',p.privacy_sha256,
      'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)),false));
$$;
revoke all on function private.policy_agreement_valid(jsonb,text) from public,anon,authenticated;

create function private.policy_signup_allowed(metadata jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare required_release text;
begin
  if not exists(select 1 from private.account_policy_requirement where singleton) then return false; end if;
  select release_id into required_release from private.account_policy_requirement where singleton;
  if required_release is null then return private.registration_declaration_valid(metadata); end if;
  return private.policy_agreement_valid(metadata,required_release);
end $$;
revoke all on function private.policy_signup_allowed(jsonb) from public,anon,authenticated;
grant execute on function private.policy_signup_allowed(jsonb) to supabase_auth_admin;

create or replace function public.fas_before_user_created(event jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
  if not private.policy_signup_allowed(event->'user'->'user_metadata') then
    return jsonb_build_object('error',jsonb_build_object('http_code',400,'message',
      case when (select release_id from private.account_policy_requirement where singleton) is null
      then 'Confirm you are 16 or older and acknowledge the current draft Terms and Privacy notice.'
      else 'Confirm your age and agree to the current published Terms after reviewing the Privacy notice.' end));
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public.fas_before_user_created(jsonb) from public,anon,authenticated;
grant execute on function public.fas_before_user_created(jsonb) to supabase_auth_admin;

create function private.record_published_policy_agreement() returns trigger
language plpgsql security definer set search_path='' as $$
declare required_release text;
begin
  select release_id into required_release from private.account_policy_requirement where singleton for share;
  if required_release is not null then
    if not private.policy_agreement_valid(new.raw_user_meta_data,required_release) then
      raise exception 'Current published policy agreement required';
    end if;
    insert into private.account_policy_agreements(user_id,release_id,source,terms_agreed,privacy_notice_seen,age_self_declared)
    values(new.id,required_release,'signup',true,true,true);
  end if;
  return new;
end $$;
revoke all on function private.record_published_policy_agreement() from public,anon,authenticated;
create trigger fas_record_published_policy_agreement after insert on auth.users
for each row execute function private.record_published_policy_agreement();

-- Only already public release details. No private acceptance/identity records.
create function public.fas_current_policy_requirement() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare required_release text; result jsonb;
begin
  if not exists(select 1 from private.account_policy_requirement where singleton) then raise exception 'Policy configuration unavailable'; end if;
  select release_id into required_release from private.account_policy_requirement where singleton;
  if required_release is null then return null; end if;
  select to_jsonb(p) into result from private.account_policy_releases p
    where p.release_id=required_release and p.status='published' and p.published_at<=now();
  if result is null then raise exception 'Published policies are unavailable'; end if;
  return result;
end $$;
revoke all on function public.fas_current_policy_requirement() from public,anon,authenticated;
grant execute on function public.fas_current_policy_requirement() to anon,authenticated;

create function public.fas_my_policy_agreements() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(a)-'user_id' || jsonb_build_object(
    'kind','published_terms_agreement','terms_version',p.terms_version,'privacy_version',p.privacy_version,
    'terms_sha256',p.terms_sha256,'privacy_sha256',p.privacy_sha256,
    'terms_path',p.terms_path,'privacy_path',p.privacy_path) order by a.recorded_at,a.release_id),'[]'::jsonb)
  from private.account_policy_agreements a join private.account_policy_releases p using(release_id)
  join auth.users u on u.id=a.user_id
  where a.user_id=(select auth.uid()) and u.email_confirmed_at is not null;
$$;
revoke all on function public.fas_my_policy_agreements() from public,anon,authenticated;
grant execute on function public.fas_my_policy_agreements() to authenticated;

create function public.fas_accept_current_policies(target_release text, terms_agreed boolean, privacy_notice_seen boolean, age_16_or_over boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid := auth.uid(); required_release text; session_claim text;
begin
  session_claim := nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id';
  if caller is null or session_claim is null or not private.account_active(caller)
    or not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null)
    or not exists(select 1 from auth.sessions where user_id=caller and id::text=session_claim and (not_after is null or not_after>now())) then
    raise exception 'Sign in again to review account terms';
  end if;
  select release_id into required_release from private.account_policy_requirement where singleton for share;
  if required_release is null or target_release is distinct from required_release
    or terms_agreed is distinct from true or privacy_notice_seen is distinct from true or age_16_or_over is distinct from true
    or not exists(select 1 from private.account_policy_releases where release_id=required_release and status='published' and published_at<=now()) then
    raise exception 'Review the current published policies and required confirmations';
  end if;
  insert into private.account_policy_agreements(user_id,release_id,source,terms_agreed,privacy_notice_seen,age_self_declared)
  values(caller,required_release,'existing_account',true,true,true) on conflict(user_id,release_id) do nothing;
  return public.fas_my_policy_agreements();
end $$;
revoke all on function public.fas_accept_current_policies(text,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.fas_accept_current_policies(text,boolean,boolean,boolean) to authenticated;
commit;
