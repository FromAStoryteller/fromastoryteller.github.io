begin;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.invites enable row level security;
alter table public.stories enable row level security;
alter table public.story_assets enable row level security;
alter table public.moderation_log enable row level security;
revoke all on public.profiles, public.user_roles, public.invites, public.stories, public.story_assets, public.moderation_log from anon, authenticated;
grant all on public.profiles, public.user_roles, public.invites, public.stories, public.story_assets, public.moderation_log to service_role;
grant usage, select on sequence public.moderation_log_id_seq to service_role;
grant select on public.profiles, public.stories, public.story_assets to anon, authenticated;
grant update(display_name, bio) on public.profiles to authenticated;
grant select on public.user_roles, public.moderation_log to authenticated;
grant insert(author_id, slug, title, summary, body), update(slug, title, summary, body, status) on public.stories to authenticated;
grant insert(story_id, object_path, alt_text), update(alt_text) on public.story_assets to authenticated;
-- No client deletes in V1: archive stories; remove unused files through trusted maintenance.
create policy profiles_read on public.profiles for select to anon, authenticated using (
  id = (select auth.uid()) or (select private.is_staff()) or exists (
    select 1 from public.stories where author_id = profiles.id and status = 'published'));
create policy profiles_edit on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_read on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy stories_read on public.stories for select to anon, authenticated using (
  status = 'published' or author_id = (select auth.uid()) or (select private.is_staff()));
create policy stories_create on public.stories for insert to authenticated with check (
  author_id = (select auth.uid()) and (select private.is_member()) and status = 'draft');
create policy stories_edit on public.stories for update to authenticated using (
  author_id = (select auth.uid()) and (select private.is_member()) and status in ('draft','rejected')) with check (
  author_id = (select auth.uid()) and (select private.is_member()) and status in ('draft','submitted'));
create policy assets_read on public.story_assets for select to anon, authenticated using (
  exists(select 1 from public.stories where id = story_id));
create policy assets_create on public.story_assets for insert to authenticated with check (
  (select private.is_member()) and exists(select 1 from public.stories where id = story_id and author_id = (select auth.uid()) and status in ('draft','rejected')));
create policy assets_edit on public.story_assets for update to authenticated using (
  (select private.is_member()) and exists(select 1 from public.stories where id = story_id and author_id = (select auth.uid()) and status in ('draft','rejected'))) with check (
  (select private.is_member()) and exists(select 1 from public.stories where id = story_id and author_id = (select auth.uid()) and status in ('draft','rejected')));
create policy log_staff_read on public.moderation_log for select to authenticated using ((select private.is_staff()));

create function public.create_invite(invitee_email text, valid_days integer default 7)
returns text language plpgsql security definer set search_path = '' as $$
declare token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  if valid_days not between 1 and 30 then raise exception 'Expiry must be 1-30 days'; end if;
  insert into public.invites(email, token_hash, created_by, expires_at)
  values (lower(btrim(invitee_email)), encode(sha256(convert_to(token, 'UTF8')), 'hex'), auth.uid(), now() + valid_days * interval '1 day');
  return token; -- Return once; never store the raw bearer token in the database or repository.
end; $$;
create function public.accept_invite(invite_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare invite public.invites; verified_email text;
begin
  select lower(email) into verified_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Verified signed-in email required'; end if;
  select * into invite from public.invites where token_hash = encode(sha256(convert_to(invite_token, 'UTF8')), 'hex') for update;
  if not found or invite.email <> verified_email or invite.expires_at <= now() or invite.accepted_at is not null or invite.revoked_at is not null then
    raise exception 'Invite unavailable';
  end if;
  insert into public.user_roles(user_id, role) values(auth.uid(), 'member') on conflict do nothing;
  update public.invites set accepted_by = auth.uid(), accepted_at = now() where id = invite.id;
end; $$;
create function public.revoke_invite(invite_id uuid) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  update public.invites set revoked_at = now() where id = invite_id and accepted_at is null;
end; $$;
create function public.moderate_story(target_story uuid, decision public.story_status, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare previous public.story_status;
begin
  if not private.is_staff() then raise exception 'Moderator required'; end if;
  if note is null or char_length(btrim(note)) not between 1 and 2000 then raise exception 'Reason required'; end if;
  select status into previous from public.stories where id = target_story for update;
  if not found then raise exception 'Story not found'; end if;
  if not ((previous = 'submitted' and decision in ('published','rejected')) or (previous = 'published' and decision = 'archived') or (previous = 'archived' and decision = 'submitted')) then
    raise exception 'Invalid moderation transition';
  end if;
  update public.stories set status = decision, published_at = case when decision = 'published' then now() else null end where id = target_story;
  insert into public.moderation_log(story_id, actor_id, from_status, to_status, reason) values(target_story, auth.uid(), previous, decision, btrim(note));
end; $$;
-- Explicit function ACLs; PostgreSQL otherwise grants PUBLIC execution by default.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(), private.is_staff(), private.is_admin() to anon, authenticated;
revoke all on function public.create_invite(text, integer), public.accept_invite(text), public.revoke_invite(uuid), public.moderate_story(uuid, public.story_status, text) from public, anon, authenticated;
grant execute on function public.create_invite(text, integer), public.accept_invite(text), public.revoke_invite(uuid), public.moderate_story(uuid, public.story_status, text) to authenticated;
commit;
