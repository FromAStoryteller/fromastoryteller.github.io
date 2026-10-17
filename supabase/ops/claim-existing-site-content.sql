-- Explicit operator request: own the existing site content as the verified account.
-- Run only after a fresh verified production backup and the reviewed migration.
-- No Community stories, drafts, uploaded files or canonical URLs are rewritten.
begin;
do $$
declare owner_key uuid;
begin
 if (select count(*) from auth.users where lower(email)='fromastoryteller@gmail.com' and email_confirmed_at is not null)<>1 then raise exception 'Exactly one verified site-owner account is required';end if;
 select id into owner_key from auth.users where lower(email)='fromastoryteller@gmail.com' and email_confirmed_at is not null;
 perform 1 from public.profiles where id=owner_key for update;
 if not private.account_active(owner_key) or not exists(select 1 from public.user_roles where user_id=owner_key and role='member') then raise exception 'An active contributor account is required';end if;
 if (select count(*) from private.file_content)<>14 or (select count(*) from private.file_content where content_type='story')<>10 or (select count(*) from private.file_content where content_type='game')<>2 or (select count(*) from private.file_content where content_type='tool')<>2 then raise exception 'Reviewed file content inventory changed';end if;
 if exists(select 1 from private.file_content where owner_id is not null and owner_id<>owner_key) then raise exception 'Existing ownership differs; review before reassigning';end if;
 if exists(select 1 from private.fas_publishers where user_id<>owner_key) then raise exception 'FAS publishing access differs; review before granting';end if;
 insert into private.fas_publishers(user_id) values(owner_key) on conflict do nothing;
 update private.file_content set owner_id=owner_key where owner_id is null;
end;$$;
commit;
