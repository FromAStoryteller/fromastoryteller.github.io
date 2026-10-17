-- Named, transactional fixtures only. Safe for local PostgreSQL or FAS DEV.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select v.id::uuid,v.email,now(),case when r.release_id is null then '{}'::jsonb else jsonb_build_object('fas_policy_agreement',jsonb_build_object('mode','published_terms_agreement','release_id',r.release_id,'terms_version',r.terms_version,'privacy_version',r.privacy_version,'terms_sha256',r.terms_sha256,'privacy_sha256',r.privacy_sha256,'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)) end
 from (values('93000000-0000-0000-0000-000000000001','studio-v2-owner@example.invalid'),('93000000-0000-0000-0000-000000000002','studio-v2-other@example.invalid'),('93000000-0000-0000-0000-000000000003','studio-v2-viewer@example.invalid'))v(id,email)
 cross join private.account_policy_requirement q left join private.account_policy_releases r on r.release_id=q.release_id;
insert into auth.sessions(id,user_id) values('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001'),('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002'),('94000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000003');
insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000001','member'),('93000000-0000-0000-0000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
insert into public.stories(author_id,slug,title,summary,genres,content_type,body_document,scene_style,drop_caps)
 values(auth.uid(),'manual-address-is-ignored','Studio v2 fixture','A description of the synthetic story',array['fantasy','dark-fantasy'],'blog','{"version":1,"blocks":[{"type":"paragraph","runs":[{"text":"First words","bold":true}]},{"type":"scene"},{"type":"paragraph","text":"After the scene"}]}','diamond',true);
do $$ begin
 if not exists(select 1 from public.stories where slug='studio-v2-fixture' and body=E'First words\n\n***\n\nAfter the scene' and content_type='blog') then raise exception 'FAIL automatic address or manuscript';end if;
 begin update public.stories set warning_reviewed=true,status='published' where slug='studio-v2-fixture';raise exception 'FAIL missing cover publish';exception when raise_exception then if SQLERRM not like 'Publication requires%' then raise;end if;end;
 begin update public.stories set warning_reviewed=true,scheduled_at=now()+interval '1 hour' where slug='studio-v2-fixture';raise exception 'FAIL incomplete schedule';exception when raise_exception then if SQLERRM not like 'Publication requires%' then raise;end if;end;
 begin update public.stories set genres=array['fantasy','dark-fantasy','horror','mystery'] where slug='studio-v2-fixture';raise exception 'FAIL fourth genre';exception when check_violation then null;when raise_exception then if SQLERRM not like 'Choose up to%' then raise;end if;end;
 begin update public.stories set genres=array['invented-private-genre'] where slug='studio-v2-fixture';raise exception 'FAIL noncatalog genre';exception when raise_exception then if SQLERRM not like 'Choose up to%' then raise;end if;end;
 begin update public.stories set body_document='{"version":1,"blocks":[{"type":"paragraph","html":"<script>bad()</script>"}]}' where slug='studio-v2-fixture';raise exception 'FAIL arbitrary HTML';exception when raise_exception then if SQLERRM not like 'Unsupported manuscript%' then raise;end if;end;
 begin perform private.publish_due_content();raise exception 'FAIL caller invokes scheduler';exception when insufficient_privilege then null;end;
end $$;
update public.profiles set social_links='[{"platform":"instagram","url":"https://instagram.com/example"},{"platform":"website","url":"https://example.com/"}]' where id=auth.uid();
do $$ begin
 begin update public.profiles set social_links='[{"platform":"website","url":"javascript:alert(1)"}]' where id=auth.uid();raise exception 'FAIL unsafe social URL';exception when check_violation then null;end;
 begin update public.profiles set social_links='[{"platform":"website"}]' where id=auth.uid();raise exception 'FAIL missing social URL';exception when check_violation then null;end;
end $$;
reset role;
insert into public.story_assets(id,story_id,object_path,alt_text,pixel_width,pixel_height,approved_at,approved_by)
 select '95000000-0000-0000-0000-000000000001',id,author_id::text||'/'||id::text||'/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg','A synthetic landscape',1600,900,now(),author_id from public.stories where slug='studio-v2-fixture';
update public.stories set cover_asset_id='95000000-0000-0000-0000-000000000001' where slug='studio-v2-fixture';
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
do $$ begin begin update public.story_assets set pixel_width=1600 where id='95000000-0000-0000-0000-000000000001';raise exception 'FAIL forged dimensions';exception when insufficient_privilege then null;end;end $$;
update public.stories set warning_reviewed=true,scheduled_at=now()+interval '1 hour' where slug='studio-v2-fixture';
do $$ begin if public.fas_public_story('studio-v2-fixture') is not null then raise exception 'FAIL schedule leaked';end if;end $$;
reset role;
do $$ begin if private.publish_due_content()<>0 then raise exception 'FAIL published too early';end if;end $$;
update public.stories set scheduled_at=now()-interval '1 second' where slug='studio-v2-fixture';
do $$ begin if private.publish_due_content()<>1 then raise exception 'FAIL due publication';end if;if private.publish_due_content()<>0 then raise exception 'FAIL duplicate publication';end if;end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
update public.stories set title='A changed published title',slug='attempted-link-change' where slug='studio-v2-fixture';
do $$ declare data jsonb;begin
 data:=public.fas_public_story('studio-v2-fixture');
 if data->>'title'<>'A changed published title' or data->>'content_type'<>'blog' or jsonb_array_length(data->'author'->'social_links')<>2 or data->'cover'->>'width'<>'1600' then raise exception 'FAIL public projection';end if;
 if data ? 'author_id' or data->'author' ? 'email' or data->'cover' ? 'object_path' then raise exception 'FAIL private metadata exposed';end if;
end $$;
update public.stories set status='draft',scheduled_at=now()+interval '1 hour' where slug='studio-v2-fixture';
reset role;
delete from public.user_roles where user_id='93000000-0000-0000-0000-000000000001';
do $$ begin if exists(select 1 from public.stories where slug='studio-v2-fixture' and scheduled_at is not null) then raise exception 'FAIL revocation kept schedule';end if;end $$;
insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000001','member');
do $$ begin if private.publish_due_content()<>0 then raise exception 'FAIL reinstatement republished';end if;end $$;

-- Trusted reports can never be reattributed by the caller, even if its import
-- payload supplies the wrong beneficiary. No contributor can submit view counts.
insert into public.stories(id,author_id,slug,title) values('96000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002','other-report-fixture','Other report fixture');
insert into private.page_performance_reports(provider,report_key,report_date,page_kind,page_id,beneficiary_id,views,engaged_views,completed_reads,source_group,reported_revenue_micros,currency)
 select 'synthetic','studio-v2-content',current_date,'content',s.id,b.id,10,7,5,'Instagram',1500000,'NZD' from public.stories s cross join private.creator_beneficiaries b where s.slug='studio-v2-fixture' and b.user_id='93000000-0000-0000-0000-000000000002';
insert into private.page_performance_reports(provider,report_key,report_date,page_kind,page_id,views,source_group)
 select 'synthetic','studio-v2-profile',current_date,'profile',public_id,5,'Direct' from public.profiles where id='93000000-0000-0000-0000-000000000001';
insert into private.page_performance_reports(provider,report_key,report_date,page_kind,page_id,views) values('synthetic','studio-v2-other',current_date,'content','96000000-0000-0000-0000-000000000002',99);
insert into private.page_performance_reports(provider,report_key,report_date,page_kind,page_path,views) values('synthetic','studio-v2-site',current_date,'site','/',1000);
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
do $$ declare data jsonb;begin
 data:=public.fas_my_studio_traffic(null,30);if (data->>'views')::int<>15 or (data->'revenue'->0->>'micros')::bigint<>1500000 then raise exception 'FAIL own report or revenue attribution';end if;
 if (public.fas_my_studio_traffic('96000000-0000-0000-0000-000000000002',30)->>'views')::int<>0 then raise exception 'FAIL cross-owner report leak';end if;
 begin perform 1 from private.page_performance_reports;raise exception 'FAIL raw reports readable';exception when insufficient_privilege then null;end;
 begin insert into private.page_performance_reports(provider,report_key,report_date,page_kind,page_path,views) values('fake','fake',current_date,'site','/',100000);raise exception 'FAIL forged traffic';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
do $$ begin if (public.fas_my_studio_traffic(null,30)->>'views')::int<>99 then raise exception 'FAIL other reports isolated';end if;end $$;
set local role anon;
do $$ begin begin perform public.fas_my_studio_traffic(null,30);raise exception 'FAIL anonymous reports';exception when insufficient_privilege then null;end;end $$;
reset role;
do $$ begin
 if exists(select 1 from private.page_performance_reports where page_kind='site' and beneficiary_id is not null) then raise exception 'FAIL FAS site attribution';end if;
 begin update private.page_performance_reports set beneficiary_id=null where report_key='studio-v2-content';raise exception 'FAIL report owner mutation';exception when raise_exception then if SQLERRM<>'Report ownership is immutable' then raise;end if;end;
end $$;

-- Version changes flag existing work without unpublishing it.
update public.stories set status='published',warning_reviewed=true where slug='studio-v2-fixture';
update public.studio_content_types set metadata_version=2,metadata_fields='[{"key":"audience","label":"Audience","type":"select","options":["General","Adults"],"required":true}]' where id='blog';
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
do $$ declare data jsonb;begin
 data:=public.fas_my_studio_work('changed','blog','needs-update');
 if jsonb_array_length(data->'items')<>1 or not (data->'items'->0->>'needs_metadata_update')::boolean then raise exception 'FAIL schema update not flagged';end if;
 if public.fas_public_story('studio-v2-fixture') is null then raise exception 'FAIL schema update hid page';end if;
 begin update public.stories set summary='Changed description' where slug='studio-v2-fixture';raise exception 'FAIL missing new required metadata';exception when raise_exception then if SQLERRM not like 'Publication requires%' then raise;end if;end;
 begin update public.stories set metadata='{"audience":"Unknown"}' where slug='studio-v2-fixture';raise exception 'FAIL invalid type selection';exception when raise_exception then if SQLERRM not like 'Invalid metadata%' then raise;end if;end;
end $$;
update public.stories set metadata='{"audience":"General"}' where slug='studio-v2-fixture';
do $$ begin if jsonb_array_length(public.fas_my_studio_work('changed','blog','needs-update')->'items')<>0 then raise exception 'FAIL version not acknowledged';end if;begin update public.stories set metadata_version=100;raise exception 'FAIL caller acknowledged schema';exception when insufficient_privilege then null;end;end $$;
select public.fas_request_content_warning('Synthetic warning request','Synthetic reason');
do $$ begin begin perform public.fas_admin_warning_requests();raise exception 'FAIL contributor accessed admin queue';exception when raise_exception then if SQLERRM<>'Administrator access required' then raise;end if;end;if jsonb_array_length(public.fas_my_warning_requests())<>1 then raise exception 'FAIL own requests';end if;end $$;
reset role;
insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000002','admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
select public.fas_admin_review_warning((public.fas_admin_warning_requests()->0->>'id')::uuid,true,'Synthetic approval');
do $$ begin if not exists(select 1 from public.content_warnings where id='synthetic-warning-request') then raise exception 'FAIL approved warning missing';end if;if jsonb_array_length(public.fas_my_warning_requests())<>0 then raise exception 'FAIL other requests exposed';end if;end $$;
reset role;
insert into public.stories(author_id,slug,title) select '93000000-0000-0000-0000-000000000001','studio-library-'||n,'Library fixture '||n from generate_series(1,45)n;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
do $$ declare p jsonb; c jsonb; ids uuid[]:='{}';item jsonb;pages int:=0;begin
 loop
  p:=public.fas_my_studio_work('Library fixture','story','draft',(c->>'updated_at')::timestamptz,(c->>'id')::uuid);pages:=pages+1;
  for item in select value from jsonb_array_elements(p->'items') loop if (item->>'id')::uuid=any(ids) then raise exception 'FAIL duplicate page row';end if;ids:=array_append(ids,(item->>'id')::uuid);end loop;
  c:=p->'next_cursor';exit when c is null or c='null';if pages>3 then raise exception 'FAIL infinite library';end if;
 end loop;
 if cardinality(ids)<>45 or pages<>3 then raise exception 'FAIL library paging';end if;
end $$;
reset role;
-- Private titles owned by another contributor must not collide on automatic URLs.
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
insert into public.stories(author_id,title) values(auth.uid(),'Studio v2 fixture');
do $$ begin if not exists(select 1 from public.stories where author_id=auth.uid() and title='Studio v2 fixture' and slug ~ '^studio-v2-fixture-[a-f0-9]{32}$') then raise exception 'FAIL cross-contributor automatic address collision';end if;end $$;
reset role;
-- Contributor-only automatic verification, reserved URLs and permanent content type.
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
do $$ begin
 begin update public.stories set content_type='story' where slug='studio-v2-fixture';raise exception 'FAIL published type changed';exception when raise_exception then if SQLERRM<>'The content type is permanent after first publication' then raise;end if;end;
end $$;
insert into public.stories(author_id,title,summary,body,genres,warning_reviewed) values(auth.uid(),'The Deal','A synthetic description','A synthetic manuscript',array['fantasy'],true);
select set_config('fas.test_story_id',id::text,true) from public.stories where title='The Deal' and author_id=auth.uid();
do $$ begin if not exists(select 1 from public.stories where id=current_setting('fas.test_story_id')::uuid and slug like 'the-deal-%') then raise exception 'FAIL reserved static address reused';end if;end $$;
reset role;
select public.fas_register_verified_cover(current_setting('fas.test_story_id')::uuid,'93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001/'||current_setting('fas.test_story_id')||'/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg','Verified without staff review');
select public.fas_register_verified_cover(current_setting('fas.test_story_id')::uuid,'93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001/'||current_setting('fas.test_story_id')||'/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jpg','Unselected verified alternative');
set local role authenticated;
update public.stories set cover_asset_id=(select id from public.story_assets where story_id=current_setting('fas.test_story_id')::uuid order by created_at,id limit 1) where id=current_setting('fas.test_story_id')::uuid;
do $$ begin begin update public.story_assets set verified_at=now() where story_id=current_setting('fas.test_story_id')::uuid;raise exception 'FAIL forged image verification';exception when insufficient_privilege then null;end;end $$;
update public.stories set status='published' where id=current_setting('fas.test_story_id')::uuid;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin if not exists(select 1 from public.story_assets where story_id=current_setting('fas.test_story_id')::uuid and verified_at is not null and approved_at is null and approved_by is null) then raise exception 'FAIL verified cover needs approval';end if;if (select count(*) from public.story_assets where story_id=current_setting('fas.test_story_id')::uuid)<>1 then raise exception 'FAIL unselected verified cover public';end if;end $$;
reset role;
update public.stories set status='draft' where id=current_setting('fas.test_story_id')::uuid;
set local role anon;
do $$ begin if exists(select 1 from public.story_assets where story_id=current_setting('fas.test_story_id')::uuid) then raise exception 'FAIL unpublished verified cover public';end if;end $$;
reset role;
-- Match lifecycle cleanup: remove owned content before deleting the Auth record.
delete from public.stories where author_id='93000000-0000-0000-0000-000000000001';
delete from auth.users where id='93000000-0000-0000-0000-000000000001';
do $$ begin if exists(select 1 from private.content_warning_requests where label='Synthetic warning request') then raise exception 'FAIL deleted account retained request text';end if;end $$;
rollback;
