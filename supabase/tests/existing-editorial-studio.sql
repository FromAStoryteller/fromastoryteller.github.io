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

select set_config('fas.editorial.id',(select id::text from private.file_content where slug='a-place-left-behind'),true);
select set_config('fas.editorial.doc',(select source->'body_document' from private.file_editorial_sources where file_id=current_setting('fas.editorial.id')::uuid)::text,true);
select set_config('fas.editorial.date',(select published_at::text from private.file_content where id=current_setting('fas.editorial.id')::uuid),true);
update private.file_content set owner_id='93000000-0000-0000-0000-000000000001' where id=current_setting('fas.editorial.id')::uuid;
insert into storage.objects(bucket_id,name,metadata) select 'fas-story-images','93000000-0000-0000-0000-000000000001/'||file_id||'/'||(source->>'asset_id')||'.jpg','{"size":100,"mimetype":"image/jpeg"}' from private.file_editorial_sources where file_id=current_setting('fas.editorial.id')::uuid;
select private.promote_file_editorial(current_setting('fas.editorial.id')::uuid);
do $$begin
 if not exists(select 1 from public.stories s where s.id=current_setting('fas.editorial.id')::uuid and s.status='published' and s.published_at=current_setting('fas.editorial.date')::timestamptz and s.body_document=current_setting('fas.editorial.doc')::jsonb and s.metadata_version=1 and private.content_ready(s)) then raise exception 'FAIL editorial migration changed identity, date, manuscript or readiness';end if;
 if not exists(select 1 from private.file_content where id=current_setting('fas.editorial.id')::uuid and editorial_migrated) then raise exception 'FAIL file migration marker missing';end if;
 if exists(select 1 from private.file_editorial_sources where file_id=current_setting('fas.editorial.id')::uuid) then raise exception 'FAIL redundant manuscript snapshot retained';end if;
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
do $$declare library jsonb;begin
 library:=public.fas_my_studio_work();if (select count(*) from jsonb_array_elements(library->'items') x where x->>'id'=current_setting('fas.editorial.id'))<>1 or not exists(select 1 from jsonb_array_elements(library->'items') x where x->>'id'=current_setting('fas.editorial.id') and x->>'source_kind'='studio') then raise exception 'FAIL original story is not one editable Studio item';end if;
end;$$;
update public.stories set title='Updated original title',body_document=jsonb_set(body_document,'{blocks,0,runs,0,text}','"Updated opening words."') where id=current_setting('fas.editorial.id')::uuid;
reset role;
set local role anon;
do $$declare result jsonb;begin
 result:=public.fas_public_file_content('/stories/a-place-left-behind/');
 if result->>'title'<>'Updated original title' or result->'editorial'->>'title'<>'Updated original title' or result->'editorial'->>'body' not like '%Updated opening words.%' or result->>'url'<>'/stories/a-place-left-behind/' or (result->>'published_at')::timestamptz<>current_setting('fas.editorial.date')::timestamptz then raise exception 'FAIL live existing route does not use saved Studio values';end if;
 begin perform private.promote_file_editorial(current_setting('fas.editorial.id')::uuid);raise exception 'FAIL anonymous migration';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
do $$declare n int;begin update public.stories set title='Other owner attack' where id=current_setting('fas.editorial.id')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'FAIL other owner edits migrated story';end if;end;$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
update public.stories set status='draft' where id=current_setting('fas.editorial.id')::uuid;
reset role;
set local role anon;
do $$begin
 if public.fas_public_file_content('/stories/a-place-left-behind/') is not null then raise exception 'FAIL unpublished migrated story visible';end if;
 if not exists(select 1 from jsonb_array_elements(public.fas_public_file_catalog()) x where x->>'url'='/stories/a-place-left-behind/' and x->>'unavailable'='true') then raise exception 'FAIL unpublished original card not hidden';end if;
end;$$;
reset role;
rollback;
