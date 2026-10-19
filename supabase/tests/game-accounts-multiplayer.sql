-- Named, transactional fixtures only. Safe for local PostgreSQL or FAS DEV.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select v.id::uuid,v.email,now(),case when r.release_id is null then '{}'::jsonb else jsonb_build_object('fas_policy_agreement',jsonb_build_object('mode','published_terms_agreement','release_id',r.release_id,'terms_version',r.terms_version,'privacy_version',r.privacy_version,'terms_sha256',r.terms_sha256,'privacy_sha256',r.privacy_sha256,'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)) end
 from (values('93000000-0000-0000-0000-000000000001','studio-v2-owner@example.invalid'),('93000000-0000-0000-0000-000000000002','studio-v2-other@example.invalid'),('93000000-0000-0000-0000-000000000003','studio-v2-viewer@example.invalid'))v(id,email)
 cross join private.account_policy_requirement q left join private.account_policy_releases r on r.release_id=q.release_id;
insert into auth.sessions(id,user_id) values('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001'),('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002'),('94000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000003');
insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000001','member'),('93000000-0000-0000-0000-000000000002','member');

insert into public.user_roles(user_id,role) values('93000000-0000-0000-0000-000000000001','admin');
update private.game_services_config set enabled=true;
insert into public.stories(author_id,title,summary,status,published_at,content_type,publishing_identity,genres,warning_reviewed,metadata,executable_package) values
 ('93000000-0000-0000-0000-000000000001','Online game fixture','Synthetic private room and save tests','published',now(),'game','fas',array['arcade'],true,'{"instructions":"Synthetic controls"}','{"version":1,"orientation":"landscape","js":"// fixture","css":"","assets":[],"settings":{"saves":true,"saveVersion":1,"multiplayer":"realtime","saveSchema":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","minimum":1,"maximum":999},"score":{"type":"integer","minimum":0,"maximum":1000000000}},"required":["level","score"]}}}');
select set_config('fas.fixture.game',(select id::text from public.stories where slug='online-game-fixture'),true);
select set_config('fas.fixture.game_version',(select updated_at::text from public.stories where slug='online-game-fixture'),true);
create function pg_temp.game_call(action text,params jsonb default '{}') returns jsonb language sql as $$select public.fas_game_api(current_setting('fas.fixture.game')::uuid,current_setting('fas.fixture.game_version')::timestamptz,action,params||jsonb_build_object('account',auth.uid()));$$;
create function pg_temp.ok(result jsonb) returns jsonb language plpgsql as $$begin if result ? 'error' then raise exception 'Unexpected game API error: %',result->'error';end if;return result;end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000003"}',true);
do $$declare r jsonb;begin
 select value into r from jsonb_array_elements(public.fas_public_story_catalog()->'items') where value->>'id'=current_setting('fas.fixture.game');if r->'game_features' is distinct from '{"saves":true,"multiplayer":"realtime"}'::jsonb or r ? 'executable_package' or r ? 'author_id' then raise exception 'FAIL public game badges or private package fields';end if;
 r:=pg_temp.ok(pg_temp.game_call('status'));if r->>'saves' is distinct from 'true' or r->>'policyCurrent' is distinct from 'true' then raise exception 'FAIL viewer online feature status';end if;
 r:=pg_temp.ok(pg_temp.game_call('save.put','{"slot":"main","revision":0,"version":1,"data":{"level":1,"score":5}}'));if r->>'revision' is distinct from '1' then raise exception 'FAIL viewer save';end if;
 begin perform pg_temp.game_call('save.put','{"slot":"main","revision":1,"version":1,"data":{"level":2,"score":7}}');raise exception 'FAIL save rate limit';exception when raise_exception then if SQLERRM not like 'Too many game requests%' then raise;end if;end;
end;$$;
reset role;delete from private.game_api_limits;
set local role authenticated;
do $$declare r jsonb;begin
 r:=pg_temp.game_call('save.put','{"slot":"main","revision":0,"version":1,"data":{"level":2,"score":7}}');if r->'error'->>'code' is distinct from 'P0002' then raise exception 'FAIL stale save was not rejected';end if;
end;$$;
reset role;delete from private.game_api_limits;
set local role authenticated;
do $$declare r jsonb;begin
 r:=pg_temp.game_call('save.put','{"slot":"main","revision":1,"version":1,"data":{"level":2,"score":7,"private_email":"not-permitted"}}');if not r ? 'error' then raise exception 'FAIL schema accepted unknown field';end if;
 r:=pg_temp.ok(pg_temp.game_call('save.get','{"slot":"main"}'));if r->'data'->>'score' is distinct from '5' or r->>'revision' is distinct from '1' then raise exception 'FAIL invalid writes changed existing save';end if;
 r:=public.fas_my_game_data();if jsonb_array_length(r->'saves')<>1 or r::text like '%94000000-%' then raise exception 'FAIL private game export';end if;
end;$$;
-- A different account cannot choose the save owner through a forged parameter.
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
do $$begin if pg_temp.game_call('save.get','{"slot":"main","owner_id":"93000000-0000-0000-0000-000000000003"}') is distinct from 'null'::jsonb then raise exception 'FAIL another player save leaked';end if;begin perform 1 from private.game_saves;raise exception 'FAIL raw saves readable';exception when insufficient_privilege then null;end;end;$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
-- Capture the invite code from the authorized create response only.
do $$declare r jsonb;begin r:=pg_temp.ok(pg_temp.game_call('room.create','{"capacity":2}'));perform set_config('fas.fixture.room',r->>'id',true);perform set_config('fas.fixture.code',r->>'code',true);if r::text like '%93000000-%' or char_length(r->>'code')<>16 then raise exception 'FAIL room exposes account identifiers or weak code';end if;end;$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000003"}',true);
do $$declare r jsonb;begin
 r:=pg_temp.ok(pg_temp.game_call('room.join',jsonb_build_object('code',current_setting('fas.fixture.code'))));if jsonb_array_length(r->'players')<>2 then raise exception 'FAIL viewer room join';end if;perform set_config('fas.fixture.player',r->>'self',true);
 r:=pg_temp.ok(pg_temp.game_call('room.player',jsonb_build_object('room',current_setting('fas.fixture.room'),'revision',0,'data',jsonb_build_object('x',50,'y',20))));if r->>'revision' is distinct from '1' then raise exception 'FAIL own state update';end if;
 r:=pg_temp.game_call('room.shared',jsonb_build_object('room',current_setting('fas.fixture.room'),'revision',0,'data',jsonb_build_object('winner','forged')));if not r ? 'error' then raise exception 'FAIL guest changed host state';end if;
 begin update public.game_player_state set payload='{}';raise exception 'FAIL direct state write';exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000002"}',true);
do $$declare r jsonb;begin
 r:=pg_temp.game_call('room.read',jsonb_build_object('room',current_setting('fas.fixture.room')));if not r ? 'error' then raise exception 'FAIL nonmember room snapshot';end if;
 if exists(select 1 from public.game_player_state) or exists(select 1 from public.game_room_state) then raise exception 'FAIL realtime state RLS';end if;
 r:=pg_temp.game_call('room.join',jsonb_build_object('code',current_setting('fas.fixture.code')));if not r ? 'error' then raise exception 'FAIL room over capacity';end if;
end;$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-0000-0000-000000000001"}',true);
do $$declare r jsonb;begin
 r:=pg_temp.ok(pg_temp.game_call('room.shared',jsonb_build_object('room',current_setting('fas.fixture.room'),'revision',0,'data',jsonb_build_object('round',1))));if r->>'revision' is distinct from '1' then raise exception 'FAIL host shared state';end if;
 if (select count(*) from public.game_player_state)<>2 then raise exception 'FAIL member realtime state';end if;
end;$$;
reset role;
do $$declare r jsonb;begin r:=public.fas_account_snapshot('93000000-0000-0000-0000-000000000003','94000000-0000-0000-0000-000000000003');if jsonb_array_length(r->'data'->'game_saves')<>1 or jsonb_array_length(r->'data'->'game_participation')<>1 or (r->'data'->'game_participation')::text like '%93000000-%' then raise exception 'FAIL unified game export';end if;end;$$;
-- Viewer deletion removes only that viewer's saves and participation.
select public.fas_prepare_account_deletion('93000000-0000-0000-0000-000000000003','94000000-0000-0000-0000-000000000003',repeat('e',64));
select public.fas_begin_account_deletion('93000000-0000-0000-0000-000000000003','94000000-0000-0000-0000-000000000003',repeat('e',64));
do $$begin if exists(select 1 from private.game_saves where owner_id='93000000-0000-0000-0000-000000000003') or exists(select 1 from private.game_members where user_id='93000000-0000-0000-0000-000000000003') or not exists(select 1 from private.game_rooms) then raise exception 'FAIL player deletion cleanup or unrelated host room removed';end if;end;$$;
update private.game_rooms set expires_at=now()-interval '1 second';
set local role authenticated;
do $$declare r jsonb;begin r:=pg_temp.game_call('room.read',jsonb_build_object('room',current_setting('fas.fixture.room')));if not r ? 'error' or exists(select 1 from public.game_room_state) then raise exception 'FAIL expired room access';end if;begin perform private.purge_expired_game_rooms();raise exception 'FAIL user invokes cleanup';exception when insufficient_privilege then null;end;end;$$;
reset role;select private.purge_expired_game_rooms();
do $$begin if exists(select 1 from private.game_rooms) or exists(select 1 from public.game_player_state) then raise exception 'FAIL transient state cleanup';end if;end;$$;
delete from auth.sessions where id='94000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$begin begin perform pg_temp.game_call('status');raise exception 'FAIL revoked session';exception when raise_exception then if SQLERRM='FAIL revoked session' then raise;end if;end;end;$$;
reset role;
set local role anon;
do $$begin begin perform public.fas_my_game_data();raise exception 'FAIL anonymous saves';exception when insufficient_privilege then null;end;end;$$;
reset role;
rollback;
