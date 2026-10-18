-- Disposable transactional fixtures. Run only in the test engine or hosted DEV.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select v.id::uuid,v.email,now(),case when r.release_id is null then '{}'::jsonb else jsonb_build_object('fas_policy_agreement',jsonb_build_object('mode','published_terms_agreement','release_id',r.release_id,'terms_version',r.terms_version,'privacy_version',r.privacy_version,'terms_sha256',r.terms_sha256,'privacy_sha256',r.privacy_sha256,'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)) end
 from (values('97000000-0000-0000-0000-000000000001','lifecycle-owner@example.invalid'),('97000000-0000-0000-0000-000000000002','lifecycle-other@example.invalid'),('97000000-0000-0000-0000-000000000003','lifecycle-admin@example.invalid'),('97000000-0000-0000-0000-000000000004','lifecycle-viewer@example.invalid'))v(id,email)
 cross join private.account_policy_requirement q left join private.account_policy_releases r on r.release_id=q.release_id;
insert into auth.sessions(id,user_id) select ('98000000-0000-0000-0000-00000000000'||n)::uuid,('97000000-0000-0000-0000-00000000000'||n)::uuid from generate_series(1,4)n;
insert into public.user_roles(user_id,role) values('97000000-0000-0000-0000-000000000001','member'),('97000000-0000-0000-0000-000000000002','member'),('97000000-0000-0000-0000-000000000003','admin');
create temp table lifecycle_row(id uuid,version timestamptz,slug text,public_id uuid);
grant select,update on lifecycle_row to authenticated;grant select on lifecycle_row to anon;
set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"98000000-0000-0000-0000-000000000001"}',true);
insert into public.stories(author_id,title,summary,body,genres,warning_reviewed)
 values(auth.uid(),'Lifecycle fixture','A description for a lifecycle fixture.','Public words for lifecycle checks.',array['fantasy'],true);
reset role;
insert into lifecycle_row select s.id,s.updated_at,s.slug,p.public_id from public.stories s join public.profiles p on p.id=s.author_id where s.author_id='97000000-0000-0000-0000-000000000001';
insert into public.story_assets(id,story_id,object_path,alt_text,pixel_width,pixel_height,verified_at)
 select '96000000-0000-0000-0000-000000000001',id,'97000000-0000-0000-0000-000000000001/'||id||'/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg','A fictional landscape',1600,900,now() from lifecycle_row;
update public.stories set cover_asset_id='96000000-0000-0000-0000-000000000001' where id=(select id from lifecycle_row);
set local role authenticated;
update public.stories set status='published' where id=(select id from lifecycle_row);
update lifecycle_row set version=(select updated_at from public.stories where id=lifecycle_row.id);
do $$ declare n integer;begin
 if public.fas_public_story('lifecycle-fixture')->>'body'<>'Public words for lifecycle checks.' then raise exception 'FAIL approval-free publication';end if;
 begin update public.stories set author_archived_at=now() where id=(select id from lifecycle_row);raise exception 'FAIL forged owner archive';exception when insufficient_privilege then null;end;
 delete from public.stories where id=(select id from lifecycle_row);get diagnostics n=row_count;if n<>0 then raise exception 'FAIL direct published deletion';end if;
 begin perform public.fas_story_lifecycle(id,version,'archive','wrong title') from lifecycle_row;raise exception 'FAIL wrong confirmation';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
-- Another contributor, a viewer, and an expired identity cannot call owner actions.
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"98000000-0000-0000-0000-000000000002"}',true);
do $$ begin begin perform public.fas_story_lifecycle(id,version,'archive','Lifecycle fixture') from lifecycle_row;raise exception 'FAIL cross-owner archive';exception when no_data_found then null;end;end $$;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000004',true);
select set_config('request.jwt.claims','{"session_id":"98000000-0000-0000-0000-000000000004"}',true);
do $$ begin begin perform public.fas_story_lifecycle(id,version,'archive','Lifecycle fixture') from lifecycle_row;raise exception 'FAIL viewer archive';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end $$;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{}',true);
do $$ begin begin perform public.fas_story_lifecycle(id,version,'archive','Lifecycle fixture') from lifecycle_row;raise exception 'FAIL missing session';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end $$;
select set_config('request.jwt.claims','{"session_id":"98000000-0000-0000-0000-000000000001"}',true);
select public.fas_story_lifecycle(id,version,'archive','Lifecycle fixture') from lifecycle_row;
do $$ declare n integer;begin
 if not exists(select 1 from public.stories where id=(select id from lifecycle_row) and status='archived' and author_archived_at is not null and scheduled_at is null) then raise exception 'FAIL author archive';end if;
 begin perform public.fas_story_lifecycle(id,version,'restore',null) from lifecycle_row;raise exception 'FAIL stale archive version';exception when no_data_found then null;end;
 update public.stories set body='Bypass archive' where id=(select id from lifecycle_row);get diagnostics n=row_count;if n<>0 then raise exception 'FAIL archived body edit';end if;
 delete from public.stories where id=(select id from lifecycle_row);get diagnostics n=row_count;if n<>0 then raise exception 'FAIL direct archive deletion';end if;
 if jsonb_array_length(public.fas_my_studio_work('','','archived')->'items')<>1 then raise exception 'FAIL archive library';end if;
 if jsonb_array_length(public.fas_my_studio_work('','','moderation')->'items')<>0 then raise exception 'FAIL owner archive called moderation';end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if public.fas_public_story('lifecycle-fixture') is not null or exists(select 1 from public.stories where slug='lifecycle-fixture') or exists(select 1 from public.story_assets where id='96000000-0000-0000-0000-000000000001') then raise exception 'FAIL archived public state';end if;
 if jsonb_array_length(public.fas_public_profile((select public_id from lifecycle_row),0)->'stories')<>0 then raise exception 'FAIL archived public listing';end if;
 begin perform public.fas_story_lifecycle(null,null,'restore',null);raise exception 'FAIL anon lifecycle';exception when insufficient_privilege then null;end;
end $$;
-- A staff lock supersedes an owner archive and cannot be lifted by the owner.
set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"98000000-0000-0000-0000-000000000003"}',true);
select public.moderate_story(id,'archived','Fictional moderation check') from lifecycle_row;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"98000000-0000-0000-0000-000000000001"}',true);
update lifecycle_row set version=(select updated_at from public.stories where id=lifecycle_row.id);
do $$ begin
 if jsonb_array_length(public.fas_my_studio_work('','','moderation')->'items')<>1 then raise exception 'FAIL moderation filter';end if;
 begin perform public.fas_story_lifecycle(id,version,'restore',null) from lifecycle_row;raise exception 'FAIL owner restores moderation';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin perform public.fas_story_lifecycle(id,version,'delete','Lifecycle fixture') from lifecycle_row;raise exception 'FAIL owner deletes moderation';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"98000000-0000-0000-0000-000000000003"}',true);
select public.fas_admin_restore_story(id,slug,'Restore fictional fixture') from lifecycle_row;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"98000000-0000-0000-0000-000000000001"}',true);
update public.stories set scheduled_at=now()+interval '1 hour' where id=(select id from lifecycle_row);
update lifecycle_row set version=(select updated_at from public.stories where id=lifecycle_row.id);
select public.fas_story_lifecycle(id,version,'archive','Lifecycle fixture') from lifecycle_row;
update lifecycle_row set version=(select updated_at from public.stories where id=lifecycle_row.id);
select public.fas_story_lifecycle(id,version,'restore',null) from lifecycle_row;
do $$ begin
 if not exists(select 1 from public.stories where id=(select id from lifecycle_row) and status='draft' and author_archived_at is null and scheduled_at is null and slug_locked and slug='lifecycle-fixture') then raise exception 'FAIL private restore or stable address';end if;
 if public.fas_public_story('lifecycle-fixture') is not null then raise exception 'FAIL restore published automatically';end if;
end $$;
update public.stories set status='published' where id=(select id from lifecycle_row);
do $$ begin if public.fas_public_story('lifecycle-fixture') is null then raise exception 'FAIL explicit republish';end if;end $$;
update lifecycle_row set version=(select updated_at from public.stories where id=lifecycle_row.id);
select public.fas_story_lifecycle(id,version,'archive','Lifecycle fixture') from lifecycle_row;
update lifecycle_row set version=(select updated_at from public.stories where id=lifecycle_row.id);
-- Contributor removal invalidates the action even if its session remains.
reset role;
delete from public.user_roles where user_id='97000000-0000-0000-0000-000000000001' and role='member';
set local role authenticated;
do $$ begin begin perform public.fas_story_lifecycle(id,version,'restore',null) from lifecycle_row;raise exception 'FAIL removed role restore';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end $$;
reset role;
insert into public.user_roles(user_id,role) values('97000000-0000-0000-0000-000000000001','member');
set local role authenticated;
select public.fas_story_lifecycle(id,version,'delete','Lifecycle fixture') from lifecycle_row;
reset role;
do $$ begin
 if exists(select 1 from public.stories where id=(select id from lifecycle_row)) or exists(select 1 from public.story_assets where id='96000000-0000-0000-0000-000000000001') or public.fas_public_story('lifecycle-fixture') is not null then raise exception 'FAIL permanent deletion';end if;
 if not exists(select 1 from private.studio_reserved_addresses where slug='lifecycle-fixture') then raise exception 'FAIL deleted address reused';end if;
 if not exists(select 1 from public.moderation_log where story_id is null and reason='Fictional moderation check') then raise exception 'FAIL moderation audit removed';end if;
end $$;
set local role authenticated;
insert into public.stories(author_id,title) values(auth.uid(),'Lifecycle fixture');
do $$ begin if exists(select 1 from public.stories where author_id=auth.uid() and slug='lifecycle-fixture') then raise exception 'FAIL deleted permanent link reassigned';end if;end $$;
reset role;
rollback;
