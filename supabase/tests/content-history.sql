-- Named, transactional fixtures only. Safe for local PostgreSQL or FAS DEV.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select v.id::uuid,v.email,now(),case when r.release_id is null then '{}'::jsonb else jsonb_build_object('fas_policy_agreement',jsonb_build_object('mode','published_terms_agreement','release_id',r.release_id,'terms_version',r.terms_version,'privacy_version',r.privacy_version,'terms_sha256',r.terms_sha256,'privacy_sha256',r.privacy_sha256,'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)) end
 from (values('93000000-0000-0000-0000-000000000001','studio-v2-owner@example.invalid'),('93000000-0000-0000-0000-000000000002','studio-v2-other@example.invalid'),('93000000-0000-0000-0000-000000000003','studio-v2-viewer@example.invalid'))v(id,email)
 cross join private.account_policy_requirement q left join private.account_policy_releases r on r.release_id=q.release_id;
insert into auth.sessions(id,user_id) values('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001'),('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002'),('94000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000003');
insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000001','member'),('93000000-0000-0000-0000-000000000002','member');

insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000001','admin');

insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000002','admin');
insert into public.stories(id,author_id,title,slug,publishing_identity,updated_at) values
 ('95000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','Shared FAS fixture','shared-fas-fixture','fas','2020-01-01'),
 ('95000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001','Personal protected fixture','personal-protected-fixture','personal','2020-01-01'),
 ('95000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000002','Editor personal fixture','editor-personal-fixture','personal','2020-01-01');
update private.file_content set owner_id='93000000-0000-0000-0000-000000000001',publishing_identity=case when slug='countdown' then 'fas' else 'personal' end where slug in ('countdown','brick-blitz');
update public.stories set slug_locked=true where id='95000000-0000-0000-0000-000000000001';
select set_config('fas.shared.file',(select id::text from private.file_content where slug='countdown'),true);
select set_config('fas.shared.file_version',(select updated_at::text from private.file_content where slug='countdown'),true);
select set_config('fas.shared.package','{"version":1,"orientation":"landscape","template":"countdown","js":"window.sharedFixture=1;","css":"","assets":[],"settings":{"saves":false,"saveVersion":1,"saveSchema":{"type":"object","properties":{},"additionalProperties":false},"multiplayer":"off"}}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
do $$declare library jsonb;n integer;begin
 library:=public.fas_studio_library('fas');
 if not exists(select 1 from jsonb_array_elements(library->'items') i where i->>'id'='95000000-0000-0000-0000-000000000001') or exists(select 1 from jsonb_array_elements(library->'items') i where i->>'publishing_identity'<>'fas') then raise exception 'FAIL shared FAS library';end if;
 library:=public.fas_studio_library('own');if jsonb_array_length(library->'items')<>1 or library->'items'->0->>'title'<>'Editor personal fixture' then raise exception 'FAIL separate personal library';end if;
 update public.stories set body='Edited by another FAS administrator' where id='95000000-0000-0000-0000-000000000001';get diagnostics n=row_count;if n<>1 then raise exception 'FAIL shared FAS edit';end if;
 update public.stories set body='forged personal edit' where id='95000000-0000-0000-0000-000000000002';get diagnostics n=row_count;if n<>0 then raise exception 'FAIL personal edit crossed ownership';end if;
 begin update public.stories set publishing_identity='personal' where id='95000000-0000-0000-0000-000000000001';raise exception 'FAIL shared FAS reattribution';exception when others then if SQLERRM='FAIL shared FAS reattribution' then raise;end if;end;
 if not exists(select 1 from public.stories where id='95000000-0000-0000-0000-000000000001' and author_id='93000000-0000-0000-0000-000000000001' and slug='shared-fas-fixture') then raise exception 'FAIL ownership changed';end if;
 if public.fas_begin_cover_upload('95000000-0000-0000-0000-000000000001')->>'author_id'<>'93000000-0000-0000-0000-000000000001' then raise exception 'FAIL delegated cover context';end if;
end;$$;
select public.fas_save_file_player(current_setting('fas.shared.file')::uuid,current_setting('fas.shared.file_version')::timestamptz,current_setting('fas.shared.package')::jsonb,'fas');
do $$begin if public.fas_my_file_player(current_setting('fas.shared.file')::uuid)->'package'->>'js'<>'window.sharedFixture=1;' then raise exception 'FAIL shared source edit';end if;end;$$;
do $$declare h jsonb;r jsonb;v timestamptz;begin
 h:=public.fas_content_history('95000000-0000-0000-0000-000000000001','studio');if jsonb_array_length(h)<>1 then raise exception 'FAIL story history capture';end if;
 r:=public.fas_content_history('95000000-0000-0000-0000-000000000001','studio',(h->0->>'id')::uuid);if r->'snapshot'->>'body'<>' ' and r->'snapshot'->>'body'<>'' then raise exception 'FAIL original story snapshot';end if;
 begin perform public.fas_content_history('95000000-0000-0000-0000-000000000002','studio');raise exception 'FAIL cross-owner history';exception when others then if SQLERRM='FAIL cross-owner history' then raise;end if;end;
 h:=public.fas_content_history(current_setting('fas.shared.file')::uuid,'file');if jsonb_array_length(h)<>1 then raise exception 'FAIL original file baseline';end if;
 r:=public.fas_restore_file_revision(current_setting('fas.shared.file')::uuid,(h->0->>'id')::uuid,(select (public.fas_my_file_player(current_setting('fas.shared.file')::uuid)->>'version')::timestamptz));
 if public.fas_my_file_player(current_setting('fas.shared.file')::uuid)->'package'<>'null'::jsonb then raise exception 'FAIL restore original files';end if;
 begin perform public.fas_restore_file_revision(current_setting('fas.shared.file')::uuid,(h->0->>'id')::uuid,(r->>'updated_at')::timestamptz-interval '1 second');raise exception 'FAIL stale restore';exception when sqlstate 'P0002' then null;end;
 h:=public.fas_content_history(current_setting('fas.shared.file')::uuid,'file');
 r:=public.fas_restore_file_revision(current_setting('fas.shared.file')::uuid,(h->0->>'id')::uuid,(r->>'updated_at')::timestamptz);
 if public.fas_my_file_player(current_setting('fas.shared.file')::uuid)->'package'->>'js'<>'window.sharedFixture=1;' then raise exception 'FAIL restore replaced files';end if;
end;$$;
reset role;
-- Keep history bounded even when repeatedly editing. Cover-only changes add none.
do $$declare n int;begin for n in 1..25 loop update public.stories set body='history version '||n where id='95000000-0000-0000-0000-000000000001';end loop;
 if (select count(*) from private.content_revisions where story_id='95000000-0000-0000-0000-000000000001')<>20 then raise exception 'FAIL revision retention';end if;
 update public.stories set updated_at=clock_timestamp() where id='95000000-0000-0000-0000-000000000001';
 if (select count(*) from private.content_revisions where story_id='95000000-0000-0000-0000-000000000001')<>20 then raise exception 'FAIL cover-only history';end if;
end;$$;
select public.fas_reserve_image_upload('93000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001/95000000-0000-0000-0000-000000000001/96000000-0000-0000-0000-000000000001.jpg','cover');
select public.fas_register_verified_cover('95000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001/95000000-0000-0000-0000-000000000001/96000000-0000-0000-0000-000000000001.jpg','Shared FAS cover');
do $$begin
 if not exists(select 1 from private.file_interactive_overrides where file_id=current_setting('fas.shared.file')::uuid and owner_id='93000000-0000-0000-0000-000000000001') then raise exception 'FAIL source ownership changed';end if;
 if not exists(select 1 from private.admin_audit where action='fas_content_edited' and actor_id='93000000-0000-0000-0000-000000000002') then raise exception 'FAIL shared edit audit';end if;
end;$$;
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.fas_story_lifecycle('95000000-0000-0000-0000-000000000001',(select updated_at from public.stories where id='95000000-0000-0000-0000-000000000001'),'archive','Shared FAS fixture');if r->>'status'<>'archived' then raise exception 'FAIL shared archive';end if;
 r:=public.fas_story_lifecycle('95000000-0000-0000-0000-000000000001',(r->>'updated_at')::timestamptz,'restore',null);if r->>'status'<>'draft' then raise exception 'FAIL shared restore';end if;
end;$$;
reset role;
-- Removing admin rights immediately denies FAS library and cross-owner edits.
delete from public.user_roles where user_id='93000000-0000-0000-0000-000000000002' and role='admin';
set local role authenticated;
do $$declare n int;begin
 begin perform public.fas_content_history('95000000-0000-0000-0000-000000000001','studio');raise exception 'FAIL revoked history';exception when others then if SQLERRM='FAIL revoked history' then raise;end if;end;
 begin perform public.fas_studio_library('fas');raise exception 'FAIL nonadmin FAS library';exception when others then if SQLERRM='FAIL nonadmin FAS library' then raise;end if;end;
 update public.stories set body='forged after revocation' where id='95000000-0000-0000-0000-000000000001';get diagnostics n=row_count;if n<>0 then raise exception 'FAIL revoked FAS edit';end if;
 begin perform public.fas_my_file_player(current_setting('fas.shared.file')::uuid);raise exception 'FAIL revoked file access';exception when others then if SQLERRM='FAIL revoked file access' then raise;end if;end;
end;$$;
reset role;
set local role anon;
do $$begin begin perform public.fas_studio_library('fas');raise exception 'FAIL anonymous FAS library';exception when insufficient_privilege then null;end;end;$$;
reset role;
delete from public.stories where id='95000000-0000-0000-0000-000000000001';
do $$begin if exists(select 1 from private.content_revisions where story_id='95000000-0000-0000-0000-000000000001') then raise exception 'FAIL deleted content history';end if;end;$$;
insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000002','admin');
delete from public.stories where author_id='93000000-0000-0000-0000-000000000001';
delete from auth.users where id='93000000-0000-0000-0000-000000000001';
do $$begin if exists(select 1 from private.content_revisions where owner_id='93000000-0000-0000-0000-000000000001') then raise exception 'FAIL deleted account history';end if;end;$$;
rollback;
