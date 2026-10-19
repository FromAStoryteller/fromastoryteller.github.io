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
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
insert into public.stories(author_id,title,summary,content_type,genres,warning_reviewed,metadata,executable_package) values
 (auth.uid(),'Interactive game fixture','Synthetic game upload description','game',array['arcade'],true,'{"instructions":"Click or tap to move."}','{"version":1,"orientation":"landscape","js":"window.fixture=1;","css":"","assets":[]}');
select set_config('fas.fixture.game',(select id::text from public.stories where slug='interactive-game-fixture'),true);
do $$begin
 if public.fas_public_interactive_package('interactive-game-fixture') is not null then raise exception 'FAIL draft package leaked';end if;
 begin insert into public.stories(author_id,title,content_type) values(auth.uid(),'Forbidden tool','tool');raise exception 'FAIL contributor tool accepted';exception when others then if SQLERRM='FAIL contributor tool accepted' then raise;end if;end;
 begin update public.stories set executable_package='{"version":1,"orientation":"wrong","js":"test","css":"","assets":[]}' where id=current_setting('fas.fixture.game')::uuid;raise exception 'FAIL invalid package accepted';exception when others then if SQLERRM='FAIL invalid package accepted' then raise;end if;end;
 begin update public.stories set status='published' where id=current_setting('fas.fixture.game')::uuid;raise exception 'FAIL no cover published';exception when others then if SQLERRM='FAIL no cover published' then raise;end if;end;
end;$$;
reset role;
insert into public.story_assets(id,story_id,object_path,alt_text,pixel_width,pixel_height,verified_at)
 values('97000000-0000-0000-0000-000000000002',current_setting('fas.fixture.game')::uuid,'93000000-0000-0000-0000-000000000002/'||current_setting('fas.fixture.game')||'/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg','Synthetic game cover',1600,900,now());
set local role authenticated;
update public.stories set cover_asset_id='97000000-0000-0000-0000-000000000002',status='published' where id=current_setting('fas.fixture.game')::uuid;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
insert into public.stories(author_id,title,summary,content_type,genres,warning_reviewed,metadata,executable_package) values
 (auth.uid(),'Interactive tool fixture','Synthetic tool upload description','tool',array['writing-tool'],true,'{"instructions":"Use the controls."}','{"version":1,"orientation":"portrait","js":"window.fixture=2;","css":"","assets":[]}');
select set_config('fas.fixture.tool',(select id::text from public.stories where slug='interactive-tool-fixture'),true);
do $$begin if not exists(select 1 from public.stories where id=current_setting('fas.fixture.tool')::uuid and publishing_identity='fas') then raise exception 'FAIL tool identity not forced';end if;end;$$;
reset role;
insert into public.story_assets(id,story_id,object_path,alt_text,pixel_width,pixel_height,verified_at)
 values('97000000-0000-0000-0000-000000000001',current_setting('fas.fixture.tool')::uuid,'93000000-0000-0000-0000-000000000001/'||current_setting('fas.fixture.tool')||'/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg','Synthetic tool cover',1600,900,now());
set local role authenticated;
update public.stories set cover_asset_id='97000000-0000-0000-0000-000000000001',status='published' where id=current_setting('fas.fixture.tool')::uuid;
do $$declare n integer;begin
 update public.stories set title='Cross owner attack' where id=current_setting('fas.fixture.game')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'FAIL cross-owner package changed';end if;
end;$$;
reset role;
set local role anon;
do $$declare result jsonb;begin
 if public.fas_public_interactive_package('interactive-game-fixture')->'package'->>'js'<>'window.fixture=1;' then raise exception 'FAIL published game package missing';end if;
 if public.fas_public_interactive_package('interactive-tool-fixture')->'package'->>'orientation'<>'portrait' then raise exception 'FAIL portrait tool missing';end if;
 result:=public.fas_public_story('interactive-tool-fixture');if result->'author'->>'kind'<>'organization' or result->'metadata'->>'instructions'<>'Use the controls.' or result ? 'executable_package' then raise exception 'FAIL tool metadata/byline projection';end if;
 if result::text like '%93000000-%' then raise exception 'FAIL private author key leaked';end if;
 if jsonb_array_length(public.fas_public_story_catalog()->'items')<>2 then raise exception 'FAIL published discovery';end if;
 begin insert into public.stories(author_id,title,content_type) values('93000000-0000-0000-0000-000000000001','Anonymous game','game');raise exception 'FAIL anonymous write';exception when insufficient_privilege then null;end;
end;$$;
reset role;
-- Unpublishing revokes the public package endpoint immediately.
set local role authenticated;
update public.stories set status='draft' where id=current_setting('fas.fixture.tool')::uuid;
reset role;
do $$begin if public.fas_public_interactive_package('interactive-tool-fixture') is not null then raise exception 'FAIL unpublished code still available';end if;end;$$;
insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000002','admin');
delete from public.user_roles where user_id='93000000-0000-0000-0000-000000000001' and role='admin';
set local role authenticated;
do $$begin begin update public.stories set title='Revoked admin edit' where id=current_setting('fas.fixture.tool')::uuid;raise exception 'FAIL revoked admin edits tool';exception when others then if SQLERRM='FAIL revoked admin edits tool' then raise;end if;end;end;$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000003"}',true);
do $$begin begin insert into public.stories(author_id,title,content_type) values(auth.uid(),'Viewer game','game');raise exception 'FAIL viewer write';exception when insufficient_privilege then null;end;end;$$;
reset role;
rollback;
