-- Named, transactional fixtures only. Safe for local PostgreSQL or FAS DEV.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select v.id::uuid,v.email,now(),case when r.release_id is null then '{}'::jsonb else jsonb_build_object('fas_policy_agreement',jsonb_build_object('mode','published_terms_agreement','release_id',r.release_id,'terms_version',r.terms_version,'privacy_version',r.privacy_version,'terms_sha256',r.terms_sha256,'privacy_sha256',r.privacy_sha256,'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)) end
 from (values('98000000-0000-0000-0000-000000000001','image-storage-owner@example.invalid'),('98000000-0000-0000-0000-000000000002','image-storage-other@example.invalid'),('98000000-0000-0000-0000-000000000003','image-storage-viewer@example.invalid'))v(id,email)
 cross join private.account_policy_requirement q left join private.account_policy_releases r on r.release_id=q.release_id;
insert into auth.sessions(id,user_id) values('98100000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000001'),('98100000-0000-0000-0000-000000000002','98000000-0000-0000-0000-000000000002'),('98100000-0000-0000-0000-000000000003','98000000-0000-0000-0000-000000000003');
insert into public.user_roles(user_id,role) values('98000000-0000-0000-0000-000000000001','member'),('98000000-0000-0000-0000-000000000002','member');

-- Only synthetic SQL metadata; all changes roll back.
insert into public.stories(id,author_id,title) values('98200000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000001','Image fixture');
do $$
declare owner uuid:='98000000-0000-0000-0000-000000000001'; session uuid:='98100000-0000-0000-0000-000000000001'; story uuid:='98200000-0000-0000-0000-000000000001'; path text; asset jsonb;
begin
 if has_function_privilege('anon','public.fas_register_verified_cover_v2(uuid,uuid,uuid,text,text,integer,integer)','execute') or has_function_privilege('authenticated','public.fas_register_verified_cover_v2(uuid,uuid,uuid,text,text,integer,integer)','execute') then raise exception 'Master registration exposed';end if;
 path:=owner::text||'/'||story::text||'/cccccccc-cccc-cccc-cccc-cccccccccccc.jpg';
 perform public.fas_reserve_image_upload(owner,session,path,'cover');
 asset:=public.fas_register_verified_cover_v2(story,owner,session,path,'Synthetic high-resolution cover',3200,1800);
 if (asset->>'pixel_width')::int<>3200 or not exists(select 1 from public.story_assets where id=(asset->>'id')::uuid and pixel_width=3200 and pixel_height=1800) then raise exception 'Master dimensions lost';end if;
end;$$;
do $$
declare owner uuid:='98000000-0000-0000-0000-000000000001';session uuid:='98100000-0000-0000-0000-000000000001';key uuid;v uuid;first jsonb;second jsonb;path1 text;path2 text;batch jsonb;
begin
 select public_id,image_version into key,v from public.profiles where id=owner;
 path1:=owner::text||'/'||key::text||'/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg';
 path2:=owner::text||'/'||key::text||'/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jpg';
 perform public.fas_reserve_image_upload(owner,session,path1,'profile');
 first:=public.fas_register_profile_image(owner,session,path1,'A fictional portrait',v);
 if first->>'asset_id' is null then raise exception 'FAIL profile registration';end if;
 if public.fas_abandon_image_upload(path1) then raise exception 'FAIL active image retired after uncertain response';end if;
 perform public.fas_reserve_image_upload(owner,session,path2,'profile');
 begin perform public.fas_register_profile_image(owner,session,path2,'Replacement',v);raise exception 'FAIL stale replacement';exception when no_data_found then null;end;
 if (select image_path from public.profiles where id=owner)<>path1 then raise exception 'FAIL stale changed active image';end if;
 second:=public.fas_register_profile_image(owner,session,path2,'Replacement',(first->>'version')::uuid);
 if not exists(select 1 from private.image_cleanup where path=path1 and done_at is null) then raise exception 'FAIL replacement not queued';end if;
 batch:=public.fas_claim_image_cleanup(owner);
 if jsonb_array_length(batch)<>1 or batch->0->>'path'<>path1 then raise exception 'FAIL cleanup claims active image';end if;
 if public.fas_ack_image_cleanup(path1,gen_random_uuid()) then raise exception 'FAIL wrong cleanup lease';end if;
 if not public.fas_ack_image_cleanup(path1,(batch->0->>'lease')::uuid) then raise exception 'FAIL cleanup ack';end if;
 if jsonb_array_length(public.fas_claim_image_cleanup(owner))<>0 then raise exception 'FAIL cleanup repeated completed image';end if;
 begin perform public.fas_reserve_image_upload(owner,session,path1,'profile');raise exception 'FAIL retired path reused';exception when raise_exception then if SQLERRM<>'Retired image path' then raise;end if;end;
 -- Exports contain both profile metadata and all owned private-bucket objects.
 insert into storage.objects(bucket_id,name,metadata) values('fas-story-images',path2,'{"size":10,"mimetype":"image/jpeg"}');
 if (public.fas_account_snapshot(owner,session)->'data'->'profile'->>'image_path')<>path2 then raise exception 'FAIL export omitted profile';end if;
 if jsonb_array_length(public.fas_account_snapshot(owner,session)->'data'->'objects')<>1 then raise exception 'FAIL export omitted profile bytes';end if;
end;$$;
set local role anon;
do $$declare asset uuid;data jsonb;begin
 -- Explicit IDs aren't needed: projected public profile never exposes a path or Auth ID.
 select public.fas_public_profile((select '00000000-0000-0000-0000-000000000000'::uuid)) into data;
 begin perform public.fas_claim_image_cleanup(null);raise exception 'FAIL anonymous cleanup';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"98100000-0000-0000-0000-000000000002"}',true);
do $$begin
 begin perform public.fas_register_profile_image('98000000-0000-0000-0000-000000000001','98100000-0000-0000-0000-000000000001','x','x',gen_random_uuid());raise exception 'FAIL caller registers verified image';exception when insufficient_privilege then null;end;
 begin update public.profiles set image_alt='Tampered' where id=auth.uid();raise exception 'FAIL direct image metadata write';exception when insufficient_privilege then null;end;
 begin perform public.fas_change_profile_image((select (public.fas_my_profile_image()->>'version')::uuid),'Tampered',true);raise exception 'FAIL remove absent own image';exception when no_data_found then null;end;
end;$$;
reset role;
-- A former contributor's retained image stays private after contributor removal.
insert into public.user_roles(user_id,role) values('98000000-0000-0000-0000-000000000003','member');
do $$declare key uuid;v uuid;asset jsonb;path text;begin
 select public_id,image_version into key,v from public.profiles where id='98000000-0000-0000-0000-000000000003';
 path:='98000000-0000-0000-0000-000000000003/'||key::text||'/cccccccc-cccc-cccc-cccc-cccccccccccc.jpg';
 perform public.fas_reserve_image_upload('98000000-0000-0000-0000-000000000003','98100000-0000-0000-0000-000000000003',path,'profile');
 asset:=public.fas_register_profile_image('98000000-0000-0000-0000-000000000003','98100000-0000-0000-0000-000000000003',path,'Viewer portrait',v);
 delete from public.user_roles where user_id='98000000-0000-0000-0000-000000000003' and role='member';
 perform set_config('request.jwt.claim.sub','',true);
 if public.fas_visible_profile_image((asset->>'asset_id')::uuid) is true then raise exception 'FAIL viewer image public';end if;
 perform set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000003',true);
 if public.fas_visible_profile_image((asset->>'asset_id')::uuid) is not true then raise exception 'FAIL owner image hidden';end if;
end;$$;
-- Cover removal refuses a selected reference and queues unused images.
insert into public.story_assets(id,story_id,object_path,alt_text,pixel_width,pixel_height,verified_at)
 values('98300000-0000-0000-0000-000000000001','98200000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000001/98200000-0000-0000-0000-000000000001/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee.jpg','Cover',1600,900,now());
update public.stories set cover_asset_id='98300000-0000-0000-0000-000000000001' where id='98200000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"98100000-0000-0000-0000-000000000001"}',true);
do $$declare v timestamptz;begin
 select updated_at into v from public.stories where id='98200000-0000-0000-0000-000000000001';
 begin perform public.fas_change_cover_image('98200000-0000-0000-0000-000000000001','98300000-0000-0000-0000-000000000001',v,'Cover',true);raise exception 'FAIL selected cover removed';exception when raise_exception then if SQLERRM not like 'Choose and save a replacement%' then raise;end if;end;
 update public.stories set cover_asset_id=null where id='98200000-0000-0000-0000-000000000001';
 select updated_at into v from public.stories where id='98200000-0000-0000-0000-000000000001';
 perform public.fas_change_cover_image('98200000-0000-0000-0000-000000000001','98300000-0000-0000-0000-000000000001',v,'Cover',true);
 if exists(select 1 from public.story_assets where id='98300000-0000-0000-0000-000000000001') then raise exception 'FAIL cover record remained';end if;
end;$$;
reset role;
do $$begin
 if not exists(select 1 from private.image_cleanup where path like '%eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee.jpg') then raise exception 'FAIL cover bytes not queued';end if;
end;$$;
-- Exercise hosted INVOKER wrappers as the actual trusted service role.
set local role service_role;
select public.fas_claim_image_cleanup('00000000-0000-0000-0000-000000000000');
select public.fas_consume_cleanup_token('invalid-fixture-token');
reset role;
rollback;
