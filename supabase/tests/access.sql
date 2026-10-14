-- Disposable LOCAL database only. All fixture changes roll back.
-- Run as postgres with ON_ERROR_STOP=1; any raised exception means failure.
begin;
insert into auth.users(id, email, email_confirmed_at) values
('10000000-0000-0000-0000-000000000001','author@example.invalid', now()),
('10000000-0000-0000-0000-000000000002','other@example.invalid', now()),
('10000000-0000-0000-0000-000000000003','admin@example.invalid', now()),
('10000000-0000-0000-0000-000000000004','new@example.invalid', now());
insert into public.user_roles(user_id, role) values
('10000000-0000-0000-0000-000000000001','member'),
('10000000-0000-0000-0000-000000000002','member'),
('10000000-0000-0000-0000-000000000003','admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
insert into public.stories(author_id, slug, title) values (auth.uid(),'test-draft','Test draft');
insert into public.story_assets(story_id, object_path, alt_text)
select id, author_id::text || '/' || id::text || '/11111111-1111-1111-1111-111111111111.png','Test image' from public.stories where slug='test-draft';
insert into storage.objects(bucket_id, name) select 'fas-story-images',object_path from public.story_assets;
do $$ begin
  begin
    update public.stories set status='published' where slug='test-draft';
    raise exception 'FAIL: author published';
  exception when insufficient_privilege or raise_exception then
    if SQLERRM like 'FAIL:%' then raise; end if;
  end;
  begin
    insert into public.user_roles(user_id, role) values(auth.uid(),'admin');
    raise exception 'FAIL: role escalation';
  exception when insufficient_privilege then null; end;
  begin
    perform public.moderate_story((select id from public.stories where slug='test-draft'),'published','Unauthorized');
    raise exception 'FAIL: member moderation';
  exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
  if exists(select 1 from public.stories where slug='test-draft') then raise exception 'FAIL: other user sees draft'; end if;
  if exists(select 1 from public.story_assets) then raise exception 'FAIL: other user sees draft assets'; end if;
  if exists(select 1 from storage.objects where bucket_id='fas-story-images') then raise exception 'FAIL: other user sees draft objects'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if exists(select 1 from public.stories where slug='test-draft') then raise exception 'FAIL: anonymous draft access'; end if;
  begin
    perform public.accept_invite('invalid');
    raise exception 'FAIL: anonymous RPC';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
do $$ begin
  begin
    insert into public.stories(author_id,slug,title) values(auth.uid(),'uninvited','Uninvited');
    raise exception 'FAIL: uninvited author';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
update public.stories set status='submitted' where slug='test-draft';
do $$ declare changed integer; begin
  update public.stories set body='Changed during review' where slug='test-draft';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: submitted story edited'; end if;
  begin
    insert into storage.objects(bucket_id,name) select 'fas-story-images',author_id::text || '/' || id::text || '/22222222-2222-2222-2222-222222222222.png' from public.stories where slug='test-draft';
    raise exception 'FAIL: submitted image upload';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select public.moderate_story(id,'published','Test approval') from public.stories where slug='test-draft';
do $$ begin
  if (select count(*) from public.moderation_log) <> 1 then raise exception 'FAIL: missing audit'; end if;
  begin
    delete from public.moderation_log;
    raise exception 'FAIL: audit deletion';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('fas.test_token', public.create_invite('new@example.invalid'), true);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
  begin
    perform public.accept_invite(current_setting('fas.test_token'));
    raise exception 'FAIL: wrong invite email';
  exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select public.accept_invite(current_setting('fas.test_token'));
do $$ begin
  if not private.is_member() then raise exception 'FAIL: invite not accepted'; end if;
  begin
    perform public.accept_invite(current_setting('fas.test_token'));
    raise exception 'FAIL: reused invite';
  exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if (select count(*) from public.stories where slug='test-draft') <> 1 then raise exception 'FAIL: published story hidden'; end if;
  if (select count(*) from public.story_assets) <> 1 then raise exception 'FAIL: published asset hidden'; end if;
  if (select count(*) from storage.objects where bucket_id='fas-story-images') <> 1 then raise exception 'FAIL: published object hidden'; end if;
  begin
    select count(*) from public.invites;
    raise exception 'FAIL: invites exposed';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ declare changed integer; begin
  update public.stories set body='Changed after publication' where slug='test-draft';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: published story edited'; end if;
  begin
    delete from storage.objects where bucket_id='fas-story-images';
    -- No DELETE policy means zero rows, not necessarily an error.
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'FAIL: published image deleted'; end if;
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select public.moderate_story(id,'archived','Test unpublish') from public.stories where slug='test-draft';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if exists(select 1 from public.stories where slug='test-draft') then raise exception 'FAIL: archived story public'; end if;
  if exists(select 1 from storage.objects where bucket_id='fas-story-images') then raise exception 'FAIL: archived object public'; end if;
end $$;
rollback;
select 'PASS: FAS access and workflow assertions; fixtures rolled back' as result;
