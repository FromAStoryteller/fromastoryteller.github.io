-- Transactional fixtures for local PostgreSQL or the named FAS DEV project only.
begin;
-- Synthetic accounts carry test declarations matching the installed release.
-- No real user's policy acceptance is created or changed.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select v.id::uuid,v.email,now(),case when r.release_id is null then '{}'::jsonb else
  jsonb_build_object('fas_policy_agreement',jsonb_build_object('mode','published_terms_agreement',
   'release_id',r.release_id,'terms_version',r.terms_version,'privacy_version',r.privacy_version,
   'terms_sha256',r.terms_sha256,'privacy_sha256',r.privacy_sha256,
   'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)) end
 from (values
 ('91000000-0000-0000-0000-000000000001','studio-owner@example.invalid'),
 ('91000000-0000-0000-0000-000000000002','studio-other@example.invalid'),
 ('91000000-0000-0000-0000-000000000003','studio-viewer@example.invalid')) v(id,email)
 cross join private.account_policy_requirement q left join private.account_policy_releases r on r.release_id=q.release_id;
insert into public.user_roles(user_id,role) values
 ('91000000-0000-0000-0000-000000000001','member'),('91000000-0000-0000-0000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
insert into public.stories(author_id,slug,title,body,genre,tags,content_warning) values
 (auth.uid(),'studio-sql-fixture','Studio SQL fixture','Private prose','Fantasy',array['folklore','magic'],'Fictional warning');
do $$ begin
 if not exists(select 1 from public.stories where slug='studio-sql-fixture' and status='draft' and genre='Fantasy' and tags=array['folklore','magic']) then raise exception 'FAIL metadata draft';end if;
 begin update public.stories set genre=repeat('x',81) where slug='studio-sql-fixture';raise exception 'FAIL genre bound';exception when check_violation then null;end;
 begin update public.stories set tags=array_fill('x'::text,array[13]) where slug='studio-sql-fixture';raise exception 'FAIL tag bound';exception when check_violation then null;end;
 begin update public.stories set tags=array[null::text] where slug='studio-sql-fixture';raise exception 'FAIL null tag';exception when check_violation then null;end;
 begin update public.stories set content_warning=repeat('x',1001) where slug='studio-sql-fixture';raise exception 'FAIL warning bound';exception when check_violation then null;end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin if public.fas_public_story('studio-sql-fixture') is not null then raise exception 'FAIL draft public projection';end if;end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
do $$ declare n int;begin
 if exists(select 1 from public.stories where slug='studio-sql-fixture') then raise exception 'FAIL other draft read';end if;
 update public.stories set genre='Tampered',tags=array['tampered'],content_warning='Tampered' where slug='studio-sql-fixture';get diagnostics n=row_count;
 if n<>0 then raise exception 'FAIL cross author metadata write';end if;
end $$;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
do $$ begin
 begin insert into public.stories(author_id,slug,title,genre) values(auth.uid(),'studio-viewer-denied','Denied','Denied');raise exception 'FAIL viewer insert';exception when insufficient_privilege then null;when raise_exception then if SQLERRM<>'Contributor access required' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
reset role;
insert into public.story_assets(story_id,object_path,alt_text,pixel_width,pixel_height,approved_at,approved_by)
 select id,author_id::text||'/'||id::text||'/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg','A fictional landscape',1600,900,now(),author_id from public.stories where slug='studio-sql-fixture';
update public.stories set summary='A synthetic metadata check',genres=array['fantasy'],cover_asset_id=(select id from public.story_assets where story_id=stories.id) where slug='studio-sql-fixture';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
update public.stories set warning_ids=array['violence'],warning_reviewed=true,status='published' where slug='studio-sql-fixture';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare result jsonb;begin
 result:=public.fas_public_story('studio-sql-fixture');
 if result->>'genre'<>'Fantasy' or result->'tags'<>'["folklore","magic"]'::jsonb or result->>'content_warning'<>'Violence' then raise exception 'FAIL public metadata';end if;
 if result->'author' ? 'id' or result->'author' ? 'email' or result ? 'author_id' then raise exception 'FAIL private fields exposed';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
update public.stories set genre='Mystery',body='Live edited prose' where slug='studio-sql-fixture';
do $$ declare n int;begin
 update public.stories set body='Stale editor overwrite' where slug='studio-sql-fixture' and updated_at='2000-01-01';get diagnostics n=row_count;
 if n<>0 then raise exception 'FAIL stale update guard';end if;
end $$;
update public.stories set status='draft' where slug='studio-sql-fixture';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin if public.fas_public_story('studio-sql-fixture') is not null then raise exception 'FAIL unpublish';end if;end $$;
reset role;
update public.stories set status='archived' where slug='studio-sql-fixture';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
do $$ declare n int;begin update public.stories set genre='Bypass moderation' where slug='studio-sql-fixture';get diagnostics n=row_count;if n<>0 then raise exception 'FAIL moderation metadata lock';end if;end $$;
reset role;
rollback;
