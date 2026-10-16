-- Disposable fixture transaction. Run only in the SQL test engine or FAS DEV.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('61000000-0000-0000-0000-000000000001','permission-owner@example.invalid',now()),
('61000000-0000-0000-0000-000000000002','permission-other@example.invalid',now()),
('61000000-0000-0000-0000-000000000003','permission-viewer@example.invalid',now()),
('61000000-0000-0000-0000-000000000004','permission-admin@example.invalid',now());
insert into public.user_roles values
('61000000-0000-0000-0000-000000000001','member'),
('61000000-0000-0000-0000-000000000002','member'),
('61000000-0000-0000-0000-000000000004','admin');
insert into public.stories(id,author_id,slug,title,body) values
('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','permission-story','Self published','First draft');
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
insert into public.stories(author_id,slug,title) values(auth.uid(),'permission-created','Own new draft');
update public.stories set status='published' where slug='permission-story';
do $$ begin
  if not exists(select 1 from public.stories where slug='permission-story' and published_at is not null) then raise exception 'FAIL own publish'; end if;
end $$;
update public.stories set body='Immediate live edit' where slug='permission-story';
insert into storage.objects(bucket_id,name) values('fas-story-images','61000000-0000-0000-0000-000000000001/62000000-0000-0000-0000-000000000001/111.png');
insert into public.story_assets(story_id,object_path,alt_text) values
('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001/62000000-0000-0000-0000-000000000001/111.png','New cover');
update public.stories set cover_asset_id=(select id from public.story_assets where story_id='62000000-0000-0000-0000-000000000001') where slug='permission-story';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if (select body from public.stories where slug='permission-story') <> 'Immediate live edit' then raise exception 'FAIL live edit hidden'; end if;
  if public.fas_public_story('permission-story')->>'body' <> 'Immediate live edit' then raise exception 'FAIL public projection stale'; end if;
  if exists(select 1 from public.story_assets where story_id='62000000-0000-0000-0000-000000000001') then raise exception 'FAIL unapproved image public'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
do $$ declare n integer; begin
  update public.stories set body='Tampered' where slug='permission-story'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL other author edit'; end if;
  delete from public.stories where slug='permission-story'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL other author delete'; end if;
  begin
    insert into storage.objects(bucket_id,name) values('fas-story-images','61000000-0000-0000-0000-000000000001/62000000-0000-0000-0000-000000000001/222.png');
    raise exception 'FAIL cross author upload';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000003',true);
do $$ declare n integer; begin
  begin
    insert into public.stories(author_id,slug,title) values(auth.uid(),'permission-viewer-denied','Denied');
    raise exception 'FAIL viewer create';
  exception when insufficient_privilege then null; end;
  update public.stories set status='draft' where slug='permission-story'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL viewer unpublish'; end if;
end $$;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
do $$ begin
  begin update public.stories set author_id='61000000-0000-0000-0000-000000000002' where slug='permission-story'; raise exception 'FAIL transfer'; exception when insufficient_privilege then null; end;
  begin update public.stories set published_at=now() where slug='permission-story'; raise exception 'FAIL timestamp forge'; exception when insufficient_privilege then null; end;
  begin update public.user_roles set role='admin' where user_id=auth.uid(); raise exception 'FAIL promotion'; exception when insufficient_privilege then null; end;
end $$;
update public.stories set status='draft' where slug='permission-story';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if exists(select 1 from public.stories where slug='permission-story') or public.fas_public_story('permission-story') is not null then raise exception 'FAIL unpublished public'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
update public.stories set status='published' where slug='permission-story';
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
do $$ declare n integer; begin
  update public.stories set body='Admin rewrite' where slug='permission-story'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL admin rewrite'; end if;
  begin perform public.moderate_story('62000000-0000-0000-0000-000000000001','published','Admin publishing'); raise exception 'FAIL staff publishing'; exception when raise_exception then if SQLERRM like 'FAIL%' then raise; end if; end;
end $$;
select public.moderate_story('62000000-0000-0000-0000-000000000001','archived','Moderation test');
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
do $$ declare n integer; begin
  update public.stories set status='published' where slug='permission-story'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL author bypassed moderation'; end if;
  update public.story_assets set alt_text='Bypass' where story_id='62000000-0000-0000-0000-000000000001'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL archived asset edit'; end if;
end $$;
delete from public.stories where slug='permission-story';
reset role;
-- A revoked role takes effect immediately, including for an existing identity.
delete from public.user_roles where user_id='61000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
do $$ declare n integer; begin
  update public.stories set body='Revoked edit' where slug='permission-created'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL revoked contributor update'; end if;
  delete from public.stories where slug='permission-created'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL revoked contributor delete'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.stories where slug='permission-story') or exists(select 1 from public.story_assets where story_id='62000000-0000-0000-0000-000000000001') then raise exception 'FAIL own delete'; end if;
  if not exists(select 1 from public.moderation_log where story_id is null and reason='Moderation test') then raise exception 'FAIL audit lost on delete'; end if;
end $$;
rollback;
