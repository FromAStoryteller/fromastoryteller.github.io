-- Named, transactional fixtures only. Safe for local PostgreSQL or FAS DEV.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select v.id::uuid,v.email,now(),case when r.release_id is null then '{}'::jsonb else jsonb_build_object('fas_policy_agreement',jsonb_build_object('mode','published_terms_agreement','release_id',r.release_id,'terms_version',r.terms_version,'privacy_version',r.privacy_version,'terms_sha256',r.terms_sha256,'privacy_sha256',r.privacy_sha256,'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)) end
 from (values('93000000-0000-0000-0000-000000000001','studio-v2-owner@example.invalid'),('93000000-0000-0000-0000-000000000002','studio-v2-other@example.invalid'),('93000000-0000-0000-0000-000000000003','studio-v2-viewer@example.invalid'))v(id,email)
 cross join private.account_policy_requirement q left join private.account_policy_releases r on r.release_id=q.release_id;
insert into auth.sessions(id,user_id) values('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001'),('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002'),('94000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000003');
insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000001','member'),('93000000-0000-0000-0000-000000000002','member');

insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000001','admin');
-- No explicit FAS publisher grant: active administrators receive the FAS identity capability.

update private.file_content set owner_id='93000000-0000-0000-0000-000000000001' where slug in ('brick-blitz','countdown');
select set_config('fas.fixture.file',(select id::text from private.file_content where slug='brick-blitz'),true);
select set_config('fas.fixture.tool',(select id::text from private.file_content where slug='countdown'),true);
select set_config('fas.fixture.version',(select updated_at::text from private.file_content where slug='brick-blitz'),true);
select set_config('fas.fixture.tool_version',(select updated_at::text from private.file_content where slug='countdown'),true);
select set_config('fas.fixture.package','{"version":1,"orientation":"landscape","template":"brick-blitz","js":"window.fixture=1;","css":"","assets":[],"settings":{"saves":false,"saveVersion":1,"saveSchema":{"type":"object","properties":{},"additionalProperties":false},"multiplayer":"off"}}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
select public.fas_save_file_player(current_setting('fas.fixture.file')::uuid,current_setting('fas.fixture.version')::timestamptz,current_setting('fas.fixture.package')::jsonb,'personal');
do $$begin
 if public.fas_my_file_player(current_setting('fas.fixture.file')::uuid)->'package'->>'js'<>'window.fixture=1;' then raise exception 'FAIL source missing';end if;
 begin perform public.fas_save_file_player(current_setting('fas.fixture.file')::uuid,current_setting('fas.fixture.version')::timestamptz,current_setting('fas.fixture.package')::jsonb,'personal');raise exception 'FAIL stale save accepted';exception when sqlstate 'P0002' then null;end;
 begin perform public.fas_save_file_player(current_setting('fas.fixture.tool')::uuid,current_setting('fas.fixture.tool_version')::timestamptz,current_setting('fas.fixture.package')::jsonb,'fas');raise exception 'FAIL wrong template accepted';exception when others then if SQLERRM='FAIL wrong template accepted' then raise;end if;end;
end;$$;
select public.fas_save_file_player(current_setting('fas.fixture.tool')::uuid,current_setting('fas.fixture.tool_version')::timestamptz,jsonb_set(current_setting('fas.fixture.package')::jsonb,'{template}','"countdown"'),'fas');
reset role;
set local role anon;
do $$declare p jsonb;begin
 p:=public.fas_public_file_player('brick-blitz');if p->'package'->>'js'<>'window.fixture=1;' or p::text like '%93000000-%' then raise exception 'FAIL public projection';end if;
 begin perform public.fas_my_file_player(current_setting('fas.fixture.file')::uuid);raise exception 'FAIL anonymous source editing';exception when insufficient_privilege then null;end;
 begin perform * from private.file_interactive_overrides;raise exception 'FAIL raw table visible';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
do $$begin
 begin perform public.fas_my_file_player(current_setting('fas.fixture.file')::uuid);raise exception 'FAIL cross owner read';exception when others then if SQLERRM='FAIL cross owner read' then raise;end if;end;
 begin perform public.fas_save_file_player(current_setting('fas.fixture.file')::uuid,current_setting('fas.fixture.version')::timestamptz,current_setting('fas.fixture.package')::jsonb,'personal');raise exception 'FAIL cross owner write';exception when sqlstate 'P0002' then null;end;
end;$$;
reset role;
-- A transferred tool owner still needs current admin access.
update private.file_content set owner_id='93000000-0000-0000-0000-000000000002' where slug='countdown';
select set_config('fas.fixture.tool_current',(select updated_at::text from private.file_content where slug='countdown'),true);
set local role authenticated;
do $$begin
 begin perform public.fas_save_file_player(current_setting('fas.fixture.tool')::uuid,current_setting('fas.fixture.tool_current')::timestamptz,jsonb_set(current_setting('fas.fixture.package')::jsonb,'{template}','"countdown"'),'fas');raise exception 'FAIL nonadmin tool write';exception when others then if SQLERRM='FAIL nonadmin tool write' then raise;end if;end;
end;$$;
reset role;
do $$begin if public.fas_public_file_player('countdown') is not null then raise exception 'FAIL stale owner source published';end if;end;$$;
rollback;
