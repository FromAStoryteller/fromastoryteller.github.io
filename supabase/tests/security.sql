-- Disposable SQL fixtures. Transaction always rolled back on success.
begin;
insert into auth.users(id, email, email_confirmed_at) values
('20000000-0000-0000-0000-000000000001','security-owner@example.invalid',now()),
('20000000-0000-0000-0000-000000000002','security-viewer@example.invalid',now()),
('20000000-0000-0000-0000-000000000003','security-admin@example.invalid',now()),
('20000000-0000-0000-0000-000000000004','security-other@example.invalid',now());
insert into public.user_roles values
('20000000-0000-0000-0000-000000000001','member'),
('20000000-0000-0000-0000-000000000003','admin'),
('20000000-0000-0000-0000-000000000004','member');
insert into public.stories(id,author_id,slug,title) values
('20000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000001','security-story','Synthetic');
insert into public.story_assets(id,story_id,object_path,alt_text) values
('20000000-0000-0000-0000-000000000021','20000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000011/111.png','Image'),
('20000000-0000-0000-0000-000000000022','20000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000011/222.png','Image');
insert into storage.objects(bucket_id,name) select 'fas-story-images',object_path from public.story_assets;
-- Prove a broad storage policy cannot override FAS restrictions.
create policy security_test_broad_storage on storage.objects for all to anon, authenticated using(true) with check(true);
create policy security_test_broad_stories on public.stories for all to anon, authenticated using(true) with check(true);
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $$ declare n integer; begin
  if exists(select 1 from public.stories) then raise exception 'FAIL viewer draft read'; end if;
  if exists(select 1 from storage.objects) then raise exception 'FAIL broad policy draft leak'; end if;
  begin
    insert into storage.objects(bucket_id,name) values('fas-story-images','20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000011/333.png');
    raise exception 'FAIL viewer upload';
  exception when insufficient_privilege then null; end;
  begin
    update public.user_roles set role='admin' where user_id=auth.uid();
    raise exception 'FAIL role update';
  exception when insufficient_privilege then null; end;
  begin
    perform public.approve_story_image('20000000-0000-0000-0000-000000000021');
    raise exception 'FAIL viewer approval';
  exception when raise_exception then if SQLERRM like 'FAIL%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $$ declare n integer; begin
  update public.stories set body='Tampered'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL cross-author update'; end if;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
select public.approve_story_image('20000000-0000-0000-0000-000000000021');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
update public.story_assets set alt_text='Revised' where id='20000000-0000-0000-0000-000000000021';
do $$ begin
  if exists(select 1 from public.story_assets where approved_at is not null) then raise exception 'FAIL stale approval'; end if;
  begin
    update public.story_assets set approved_at=now(),approved_by=auth.uid();
    raise exception 'FAIL self approval';
  exception when insufficient_privilege then null; end;
end $$;
update public.stories set status='submitted';
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
select public.approve_story_image('20000000-0000-0000-0000-000000000021');
select public.moderate_story('20000000-0000-0000-0000-000000000011','published','Synthetic');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare n integer; begin
  if (select count(*) from public.stories)<>1 then raise exception 'FAIL published hidden'; end if;
  if (select count(*) from public.story_assets)<>1 then raise exception 'FAIL unapproved metadata leak'; end if;
  if exists(select 1 from storage.objects) then raise exception 'FAIL direct Storage delivery bypass'; end if;
  update storage.objects set name='overwrite.png'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL broad policy overwrite'; end if;
  begin
    delete from storage.objects; get diagnostics n=row_count;
    if n<>0 then raise exception 'FAIL broad policy delete'; end if;
  exception when insufficient_privilege or raise_exception then
    -- Newer Supabase Storage rejects SQL deletes before evaluating row access.
    if SQLERRM <> 'Direct deletion from storage tables is not allowed. Use the Storage API instead.' then raise; end if;
  end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
select public.moderate_story('20000000-0000-0000-0000-000000000011','archived','Synthetic');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if exists(select 1 from storage.objects) then raise exception 'FAIL archived bytes leak'; end if;
end $$;
rollback;
