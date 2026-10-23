begin;
insert into auth.users(id,email,email_confirmed_at)values
('a6900000-0000-4000-8000-000000000001','activity-writer@example.invalid',now()),
('a6900000-0000-4000-8000-000000000002','activity-reader@example.invalid',now()),
('a6900000-0000-4000-8000-000000000003','activity-other@example.invalid',now());
insert into public.user_roles(user_id,role)values('a6900000-0000-4000-8000-000000000001','member');
insert into auth.sessions(id,user_id)values
('a6910000-0000-4000-8000-000000000002','a6900000-0000-4000-8000-000000000002'),
('a6910000-0000-4000-8000-000000000003','a6900000-0000-4000-8000-000000000003');
insert into public.stories(id,author_id,slug,title,body,status,published_at)values
('a6920000-0000-4000-8000-000000000001','a6900000-0000-4000-8000-000000000001','activity-public-fixture','Activity public','Prose','published',now()),
('a6920000-0000-4000-8000-000000000002','a6900000-0000-4000-8000-000000000001','activity-private-fixture','Activity private','Private','draft',null);
set local role anon;
do $$begin
 begin perform public.fas_my_activity_settings();raise exception 'FAIL anonymous settings';exception when insufficient_privilege then null;end;
 begin perform public.fas_my_content_history('recent');raise exception 'FAIL anonymous history';exception when insufficient_privilege then null;end;
 begin perform public.fas_record_content_visit('/stories/activity-public-fixture/',0);raise exception 'FAIL anonymous record';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a6900000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"a6910000-0000-4000-8000-000000000002"}',true);
do $$declare s jsonb;stamp jsonb;begin
 if public.fas_my_activity_settings()->>'enabled'<>'false' then raise exception 'FAIL default opt in';end if;
 if public.fas_record_content_visit('/stories/activity-public-fixture/',0) then raise exception 'FAIL recorded without consent';end if;
 s:=public.fas_set_activity_recording(true);
 if public.fas_record_content_visit('/stories/activity-private-fixture/',(s->>'version')::int) then raise exception 'FAIL private visit';end if;
 if public.fas_record_content_visit('/stories/activity-public-fixture/?secret=1',(s->>'version')::int) then raise exception 'FAIL query recorded';end if;
 if not public.fas_record_content_visit('/stories/activity-public-fixture/',(s->>'version')::int) then raise exception 'FAIL valid visit';end if;
 perform public.fas_record_content_visit('/stories/activity-public-fixture/',(s->>'version')::int);
 if jsonb_array_length(public.fas_my_content_history('recent')->'items')<>1 then raise exception 'FAIL duplicate visit';end if;
 if public.fas_my_content_history('completed')->'items'<>'[]'::jsonb then raise exception 'FAIL auto completion';end if;
 perform public.fas_set_viewer_action('/stories/activity-public-fixture/','experienced',true);
 stamp:=public.fas_my_content_history('completed')->'items'->0->'activity_at';
 perform public.fas_set_viewer_action('/stories/activity-public-fixture/','loved',true);
 perform public.fas_set_viewer_action('/stories/activity-public-fixture/','experienced',true);
 if stamp='null'::jsonb or stamp<>public.fas_my_content_history('completed')->'items'->0->'activity_at' then raise exception 'FAIL completion timestamp changes on unrelated action';end if;
 perform public.fas_remove_recent_activity('a6920000-0000-4000-8000-000000000001');
 if public.fas_record_content_visit('/stories/activity-public-fixture/',(s->>'version')::int) then raise exception 'FAIL removed visit resurrected';end if;
 if jsonb_array_length(public.fas_my_content_history('completed')->'items')<>1 then raise exception 'FAIL removal changed completion';end if;
 s:=public.fas_my_activity_settings();perform public.fas_record_content_visit('/stories/activity-public-fixture/',(s->>'version')::int);
 perform public.fas_remove_recent_activity();
 if public.fas_record_content_visit('/stories/activity-public-fixture/',(s->>'version')::int) then raise exception 'FAIL clear resurrected';end if;
 s:=public.fas_set_activity_recording(false);
 if public.fas_record_content_visit('/stories/activity-public-fixture/',(s->>'version')::int) then raise exception 'FAIL paused record';end if;
 s:=public.fas_set_activity_recording(true);perform public.fas_record_content_visit('/stories/activity-public-fixture/',(s->>'version')::int);
 if jsonb_array_length(public.fas_my_activity_data()->'recent_activity')<>1 then raise exception 'FAIL own export';end if;
 begin perform * from private.viewer_recent_activity;raise exception 'FAIL table access';exception when insufficient_privilege then null;end;
 begin perform public.fas_my_content_history('arbitrary');raise exception 'FAIL invalid view';exception when raise_exception then if SQLERRM<>'Invalid history request' then raise;end if;end;
end;$$;
select set_config('request.jwt.claim.sub','a6900000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"a6910000-0000-4000-8000-000000000003"}',true);
do $$begin
 if public.fas_my_content_history('recent')->'items'<>'[]'::jsonb or public.fas_my_content_history('completed')->'items'<>'[]'::jsonb then raise exception 'FAIL cross-account read';end if;
 perform public.fas_remove_recent_activity('a6920000-0000-4000-8000-000000000001');
end;$$;
reset role;
do $$begin
 if (select count(*) from private.viewer_recent_activity where owner_id='a6900000-0000-4000-8000-000000000002')<>1 then raise exception 'FAIL cross-account delete';end if;
 if jsonb_array_length(public.fas_account_snapshot('a6900000-0000-4000-8000-000000000002','a6910000-0000-4000-8000-000000000002')->'data'->'recent_activity')<>1 then raise exception 'FAIL lifecycle snapshot';end if;
end;$$;
update private.viewer_recent_activity set visited_at=now()-interval '91 days';
select private.prune_recent_activity();
do $$begin if exists(select 1 from private.viewer_recent_activity where owner_id='a6900000-0000-4000-8000-000000000002') then raise exception 'FAIL expiry';end if;end;$$;
-- Pagination with equal timestamps and legacy unknown completion dates.
insert into public.stories(id,author_id,slug,title,body,status,published_at)
select md5('activity-page-'||n)::uuid,'a6900000-0000-4000-8000-000000000001','activity-page-'||n,'Page '||n,'Prose','published',now() from generate_series(1,52)n;
set local role authenticated;
select set_config('request.jwt.claim.sub','a6900000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"a6910000-0000-4000-8000-000000000002"}',true);
do $$declare n int;s jsonb;begin
 s:=public.fas_my_activity_settings();for n in 1..52 loop
 perform public.fas_record_content_visit('/stories/activity-page-'||n||'/',(s->>'version')::int);
 perform public.fas_set_viewer_action('/stories/activity-page-'||n||'/','experienced',true);
 end loop;
end;$$;
reset role;
update private.viewer_recent_activity set visited_at=now() where owner_id='a6900000-0000-4000-8000-000000000002';
set local role authenticated;
do $$declare a jsonb;b jsonb;begin
 a:=public.fas_my_content_history('recent');b:=public.fas_my_content_history('recent',(a->'next_cursor'->>'activity_at')::timestamptz,(a->'next_cursor'->>'id')::uuid);
 if jsonb_array_length(a->'items')<>48 or jsonb_array_length(b->'items')<>4 or b->'next_cursor'<>'null'::jsonb then raise exception 'FAIL stable pagination';end if;
end;$$;
reset role;
update public.stories set status='archived' where id='a6920000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin if exists(select 1 from jsonb_array_elements(public.fas_my_content_history('completed')->'items') t where t->>'id'='a6920000-0000-4000-8000-000000000001') then raise exception 'FAIL archived exposure';end if;end;$$;
reset role;
delete from auth.sessions where id='a6910000-0000-4000-8000-000000000002';
set local role authenticated;
do $$begin begin perform public.fas_my_content_history('recent');raise exception 'FAIL revoked session';exception when raise_exception then if SQLERRM='FAIL revoked session' then raise;end if;end;end;$$;
reset role;
delete from auth.users where id='a6900000-0000-4000-8000-000000000002';
do $$begin if exists(select 1 from private.viewer_activity_settings where owner_id='a6900000-0000-4000-8000-000000000002') or exists(select 1 from private.viewer_recent_activity where owner_id='a6900000-0000-4000-8000-000000000002') then raise exception 'FAIL account deletion cascade';end if;end;$$;
rollback;
