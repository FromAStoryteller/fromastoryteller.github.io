-- FAS Community V1 only. No imports or changes to existing static stories.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create type public.community_role as enum ('member', 'moderator', 'admin');
create type public.story_status as enum ('draft', 'submitted', 'published', 'rejected', 'archived');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Storyteller' check (char_length(display_name) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 1000),
  created_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.community_role not null default 'member'
);
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  token_hash text not null unique check (length(token_hash) = 64),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  title text not null check (char_length(title) between 1 and 200),
  summary text not null default '' check (char_length(summary) <= 1000),
  body text not null default '' check (char_length(body) <= 200000),
  status public.story_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check ((status = 'published') = (published_at is not null))
);
create table public.story_assets (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  object_path text not null unique,
  alt_text text not null check (char_length(alt_text) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.moderation_log (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.stories(id),
  actor_id uuid references public.profiles(id) on delete set null,
  from_status public.story_status not null,
  to_status public.story_status not null,
  reason text not null check (char_length(reason) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index stories_author_status on public.stories(author_id, status);
create index stories_publication on public.stories(published_at desc) where status = 'published';
create index story_assets_story on public.story_assets(story_id);
create index moderation_log_story on public.moderation_log(story_id);

create function private.is_member() returns boolean language sql stable security definer
set search_path = '' as $$ select exists(select 1 from public.user_roles where user_id = (select auth.uid())); $$;
create function private.is_staff() returns boolean language sql stable security definer
set search_path = '' as $$ select exists(select 1 from public.user_roles where user_id = (select auth.uid()) and role in ('moderator','admin')); $$;
create function private.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$ select exists(select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'); $$;
create function private.new_profile() returns trigger language plpgsql security definer
set search_path = '' as $$ begin
  insert into public.profiles(id) values (new.id);
  return new;
end; $$;
create trigger fas_new_profile after insert on auth.users for each row execute function private.new_profile();
-- Supports already-existing Auth users without importing any website content.
insert into public.profiles(id) select id from auth.users on conflict do nothing;

-- Guards apply in addition to RLS. Authors cannot publish or rewrite a reviewed story.
create function private.guard_story() returns trigger language plpgsql set search_path = '' as $$ begin
  if TG_OP = 'UPDATE' then
    if new.id <> old.id or new.author_id <> old.author_id or new.created_at <> old.created_at then
      raise exception 'Story identity is immutable';
    end if;
    if current_user = 'authenticated' then
      if old.status not in ('draft','rejected') or new.status not in ('draft','submitted') or new.published_at is not null then
        raise exception 'Authors can edit drafts/rejections and submit for review only';
      end if;
    end if;
    new.updated_at := now();
  elsif current_user = 'authenticated' and (new.status <> 'draft' or new.published_at is not null) then
    raise exception 'New stories must be drafts';
  end if;
  return new;
end; $$;
create trigger fas_guard_story before insert or update on public.stories for each row execute function private.guard_story();
create function private.guard_asset() returns trigger language plpgsql set search_path = '' as $$
declare owner_id uuid; story_state public.story_status;
begin
  if TG_OP = 'UPDATE' and (new.id <> old.id or new.story_id <> old.story_id or new.object_path <> old.object_path or new.created_at <> old.created_at) then
    raise exception 'Asset identity is immutable';
  end if;
  -- Serializes registration with moderation so publication cannot race metadata edits.
  select author_id, status into owner_id, story_state from public.stories where id = new.story_id for update;
  if current_user = 'authenticated' and story_state not in ('draft','rejected') then
    raise exception 'Assets are frozen during review and publication';
  end if;
  if new.object_path !~ ('^' || owner_id::text || '/' || new.story_id::text || '/[a-f0-9-]+\.(jpg|jpeg|png|webp)$') then
    raise exception 'Use author UUID/story UUID/unique image filename';
  end if;
  return new;
end; $$;
create trigger fas_guard_asset before insert or update on public.story_assets for each row execute function private.guard_asset();
commit;
