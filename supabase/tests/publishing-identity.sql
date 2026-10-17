-- Named, transactional fixtures only. Safe for local PostgreSQL or FAS DEV.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select v.id::uuid,v.email,now(),case when r.release_id is null then '{}'::jsonb else jsonb_build_object('fas_policy_agreement',jsonb_build_object('mode','published_terms_agreement','release_id',r.release_id,'terms_version',r.terms_version,'privacy_version',r.privacy_version,'terms_sha256',r.terms_sha256,'privacy_sha256',r.privacy_sha256,'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)) end
 from (values('93000000-0000-0000-0000-000000000001','studio-v2-owner@example.invalid'),('93000000-0000-0000-0000-000000000002','studio-v2-other@example.invalid'),('93000000-0000-0000-0000-000000000003','studio-v2-viewer@example.invalid'))v(id,email)
 cross join private.account_policy_requirement q left join private.account_policy_releases r on r.release_id=q.release_id;
insert into auth.sessions(id,user_id) values('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001'),('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002'),('94000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000003');
insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000001','member'),('93000000-0000-0000-0000-000000000002','member');

insert into private.fas_publishers(user_id) values('93000000-0000-0000-0000-000000000001');
update private.publishing_brand set owner_id='93000000-0000-0000-0000-000000000001';
update private.file_content set owner_id='93000000-0000-0000-0000-000000000001' where owner_id is null;
select set_config('fas.fixture.file',id::text,true) from private.file_content where url='/games/brick-blitz/';
select set_config('fas.fixture.version',updated_at::text,true) from private.file_content where id=current_setting('fas.fixture.file')::uuid;
insert into public.stories(author_id,title,body,status,published_at) values('93000000-0000-0000-0000-000000000001','Publishing identity fixture','Synthetic text','published',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
do $$declare result jsonb;begin
 if not (public.fas_my_publishing_options()->>'can_publish_as_fas')::boolean then raise exception 'FAIL FAS capability missing';end if;
 result:=public.fas_public_story('publishing-identity-fixture');
 if result->'author'->>'kind'<>'person' then raise exception 'FAIL personal default';end if;
 if jsonb_array_length(public.fas_my_studio_work('','game','published')->'items')<>2 then raise exception 'FAIL game library association';end if;
 if jsonb_array_length(public.fas_my_studio_work('','tool','published')->'items')<>2 then raise exception 'FAIL tool library association';end if;
 begin perform 1 from private.fas_publishers;raise exception 'FAIL raw capability readable';exception when insufficient_privilege then null;end;
 begin perform public.fas_update_file_publishing((select id from jsonb_to_recordset(public.fas_my_studio_work('Countdown','','')->'items')as x(id uuid)),now(),'personal');raise exception 'FAIL stale/tool edit accepted';exception when raise_exception then if SQLERRM not like 'Content changed%' and SQLERRM not like 'Tools always%' then raise;end if;end;
 perform public.fas_update_file_publishing(current_setting('fas.fixture.file')::uuid,current_setting('fas.fixture.version')::timestamptz,'fas');
 begin perform public.fas_update_file_publishing(current_setting('fas.fixture.file')::uuid,current_setting('fas.fixture.version')::timestamptz,'personal');raise exception 'FAIL stale file save accepted';exception when raise_exception then if SQLERRM not like 'Content changed%' then raise;end if;end;
end;$$;
reset role;
-- Existing production rows are never used; every changed row rolls back.
update public.stories set publishing_identity='fas' where slug='publishing-identity-fixture';
set local role anon;
do $$declare data jsonb;begin
 data:=public.fas_public_file_content('/games/brick-blitz/');
 if data->'author'->>'display_name'<>'From A Storyteller' or data->'author'->>'kind'<>'organization' then raise exception 'FAIL file brand projection';end if;
 if data ? 'owner_id' or data::text like '%@example.invalid%' or data::text like '%93000000-%' then raise exception 'FAIL private ownership leak';end if;
 if public.fas_public_file_content('/tools/countdown/')->'author'->>'display_name'<>'From A Storyteller' then raise exception 'FAIL fixed tool author';end if;
 data:=public.fas_public_story('publishing-identity-fixture');
 if data->'author'->>'kind'<>'organization' then raise exception 'FAIL community brand author';end if;
 data:=public.fas_public_profile('fa500000-0000-4000-8000-000000000001');
 if jsonb_array_length(data->'stories')<>4 then raise exception 'FAIL brand profile contents';end if;
 begin perform public.fas_my_publishing_options();raise exception 'FAIL anonymous capability access';exception when insufficient_privilege then null;end;
 begin perform public.fas_my_studio_work();raise exception 'FAIL anonymous work access';exception when insufficient_privilege then null;end;
end;$$;
reset role;
do $$declare p jsonb;begin
 select public.fas_public_profile(public_id) into p from public.profiles where id='93000000-0000-0000-0000-000000000001';
 if jsonb_array_length(p->'stories')<>11 then raise exception 'FAIL personal profile byline separation';end if;
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
do $$begin
 if (public.fas_my_publishing_options()->>'can_publish_as_fas')::boolean then raise exception 'FAIL unauthorized FAS capability';end if;
 if jsonb_array_length(public.fas_my_studio_work('','game','')->'items')<>0 then raise exception 'FAIL other owner file leak';end if;
 begin perform public.fas_update_file_publishing(current_setting('fas.fixture.file')::uuid,now(),'fas');raise exception 'FAIL other owner file save';exception when raise_exception then if SQLERRM not like 'Content changed%' then raise;end if;end;
 begin insert into public.stories(author_id,title,publishing_identity)values(auth.uid(),'Forbidden brand','fas');raise exception 'FAIL unauthorized brand publication';exception when raise_exception then if SQLERRM<>'FAS publishing access required' then raise;end if;end;
end;$$;
reset role;
-- Metrics remain attributed to the owner, including a FAS byline and profile.
insert into private.page_performance_reports(provider,report_key,report_date,page_kind,page_id,views)values
 ('synthetic','publishing-file',current_date,'content',current_setting('fas.fixture.file')::uuid,7),
 ('synthetic','publishing-brand-profile',current_date,'profile','fa500000-0000-4000-8000-000000000001',3);
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
do $$begin if (public.fas_my_studio_traffic(null,30)->>'views')::int<>10 then raise exception 'FAIL file or brand report attribution';end if;end;$$;
reset role;
do $$declare v timestamptz;begin
 select updated_at into v from private.file_content where content_type='tool' limit 1;
 perform set_config('fas.fixture.tool', (select id::text from private.file_content where content_type='tool' limit 1),true);
 perform set_config('fas.fixture.toolversion',v::text,true);
end;$$;
set local role authenticated;
do $$begin
 begin perform public.fas_update_file_publishing(current_setting('fas.fixture.tool')::uuid,current_setting('fas.fixture.toolversion')::timestamptz,'personal');raise exception 'FAIL tool personal author';exception when raise_exception then if SQLERRM<>'Tools always publish as From A Storyteller' then raise;end if;end;
end;$$;
reset role;
delete from public.user_roles where user_id='93000000-0000-0000-0000-000000000001' and role='member';
do $$begin if public.fas_public_file_content('/games/brick-blitz/') is not null or public.fas_public_story('publishing-identity-fixture') is not null then raise exception 'FAIL contributor removal visibility';end if;end;$$;
rollback;
