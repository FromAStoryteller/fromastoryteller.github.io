begin;
-- Self-declaration only; never an identity/age verification or privilege claim.
create function private.registration_declaration_valid(metadata jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(metadata @> '{"fas_registration":{"mode":"local_draft_review","terms_version":"local-preview-2026-10-15-v1","privacy_version":"local-preview-2026-10-15-v1","age_16_or_over":true,"terms_acknowledged":true,"privacy_notice_seen":true}}'::jsonb, false);
$$;
revoke all on function private.registration_declaration_valid(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.registration_declaration_valid(jsonb) to supabase_auth_admin;

create function public.fas_before_user_created(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
begin
  if not private.registration_declaration_valid(event->'user'->'user_metadata') then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'Confirm you are 16 or older and acknowledge the current draft Terms and Privacy notice.'));
  end if;
  return '{}'::jsonb;
end; $$;
revoke all on function public.fas_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.fas_before_user_created(jsonb) to supabase_auth_admin;

create table private.account_registration_declarations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minimum_age integer not null check(minimum_age = 16),
  age_self_declared boolean not null check(age_self_declared),
  terms_version text not null,
  privacy_version text not null,
  acknowledgement_kind text not null check(acknowledgement_kind = 'local_draft_review'),
  recorded_at timestamptz not null default now()
);
alter table private.account_registration_declarations enable row level security;
revoke all on private.account_registration_declarations from public, anon, authenticated;

-- Auth may insert new identities; the narrow definer trigger writes only this
-- new identity's valid declaration. Metadata updates never rewrite the record.
create function private.record_registration_declaration() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.registration_declaration_valid(new.raw_user_meta_data) then
    insert into private.account_registration_declarations(user_id,minimum_age,age_self_declared,terms_version,privacy_version,acknowledgement_kind)
    values(new.id,16,true,'local-preview-2026-10-15-v1','local-preview-2026-10-15-v1','local_draft_review');
  end if;
  return new;
end; $$;
revoke all on function private.record_registration_declaration() from public, anon, authenticated;
create trigger fas_record_registration_declaration after insert on auth.users
for each row execute function private.record_registration_declaration();

-- Personal export/read endpoint has no caller-supplied account ID.
create function public.fas_my_registration_declaration() returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(declaration) - 'user_id'
  from private.account_registration_declarations declaration
  join auth.users account on account.id=declaration.user_id
  where declaration.user_id=(select auth.uid()) and account.email_confirmed_at is not null;
$$;
revoke all on function public.fas_my_registration_declaration() from public, anon, authenticated;
grant execute on function public.fas_my_registration_declaration() to authenticated;
commit;
