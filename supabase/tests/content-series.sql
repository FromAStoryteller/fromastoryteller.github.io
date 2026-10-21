-- Fictional identities, local/DEV transaction only; no persistent content changes.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('a5900000-0000-4000-8000-000000000001','series-author@example.invalid',now()),
('a5900000-0000-4000-8000-000000000002','series-viewer@example.invalid',now()),
('a5900000-0000-4000-8000-000000000003','series-other@example.invalid',now());
insert into public.user_roles(user_id,role) values('a5900000-0000-4000-8000-000000000001','member'),('a5900000-0000-4000-8000-000000000003','member');
insert into auth.sessions(id,user_id) values
('a5910000-0000-4000-8000-000000000001','a5900000-0000-4000-8000-000000000001'),
('a5910000-0000-4000-8000-000000000002','a5900000-0000-4000-8000-000000000002'),
('a5910000-0000-4000-8000-000000000003','a5900000-0000-4000-8000-000000000003');
insert into public.stories(id,author_id,slug,title,body,status,published_at) values
('a5920000-0000-4000-8000-000000000001','a5900000-0000-4000-8000-000000000001','series-first-fixture','First part','Text','published',now()),
('a5920000-0000-4000-8000-000000000002','a5900000-0000-4000-8000-000000000001','series-next-fixture','Secret next part','Secret','draft',null),
('a5920000-0000-4000-8000-000000000003','a5900000-0000-4000-8000-000000000001','series-third-fixture','Third part','Text','draft',null),
('a5920000-0000-4000-8000-000000000004','a5900000-0000-4000-8000-000000000003','series-foreign-fixture','Other writer secret','Secret','draft',null);
set local role authenticated;
select set_config('request.jwt.claim.sub','a5900000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"a5910000-0000-4000-8000-000000000001"}',true);
do $$declare result jsonb;version timestamptz;begin
 result:=public.fas_series_editor('a5920000-0000-4000-8000-000000000002','studio');
 if result::text like '%Other writer secret%' then raise exception 'FAIL foreign draft exposed in choices';end if;
 result:=public.fas_save_content_series('a5920000-0000-4000-8000-000000000002','studio','Moon world','Moon story','studio:a5920000-0000-4000-8000-000000000001');version:=(result->>'updated_at')::timestamptz;
 if public.fas_series_editor('a5920000-0000-4000-8000-000000000001','studio')->'current'->>'series_name'<>'Moon story' then raise exception 'FAIL previous part not automatically enrolled';end if;
 begin perform public.fas_save_content_series('a5920000-0000-4000-8000-000000000003','studio','Moon world','Moon story','studio:a5920000-0000-4000-8000-000000000001');raise exception 'FAIL competing successor';exception when raise_exception then if SQLERRM not like 'That piece already%' then raise;end if;end;
 begin perform public.fas_save_content_series('a5920000-0000-4000-8000-000000000003','studio','Moon world','Moon story','studio:a5920000-0000-4000-8000-000000000004');raise exception 'FAIL foreign predecessor';exception when raise_exception then if SQLERRM not like 'Reopen editable%' then raise;end if;end;
 begin perform public.fas_save_content_series('a5920000-0000-4000-8000-000000000002','studio','Moon world','Moon story',null,null);raise exception 'FAIL stale write';exception when sqlstate 'P0002' then null;end;
 result:=public.fas_series_editor('a5920000-0000-4000-8000-000000000001','studio');
 begin perform public.fas_save_content_series('a5920000-0000-4000-8000-000000000001','studio','Moon world','Moon story','studio:a5920000-0000-4000-8000-000000000002',(result->'current'->>'updated_at')::timestamptz);raise exception 'FAIL cycle';exception when raise_exception then if SQLERRM<>'Series links cannot form a loop' then raise;end if;end;
 begin perform * from private.content_series;raise exception 'FAIL direct relationship access';exception when insufficient_privilege then null;end;
 if jsonb_array_length(public.fas_my_series_data())<>2 then raise exception 'FAIL relationship export';end if;
end;$$;
reset role;
set local role anon;
do $$declare result jsonb;begin
 result:=public.fas_public_content_series('/stories/series-first-fixture/');
 if result->'next'<>'null'::jsonb or result::text like '%Secret next part%' then raise exception 'FAIL unpublished next exposed';end if;
 if public.fas_public_content_series('/stories/series-next-fixture/') is not null then raise exception 'FAIL draft membership exposed';end if;
 begin perform public.fas_series_editor('a5920000-0000-4000-8000-000000000001','studio');raise exception 'FAIL anonymous editor';exception when insufficient_privilege then null;end;
end;$$;
reset role;
-- Service-owned publication simulates the scheduled-publication job.
update public.stories set status='published',published_at=now() where id='a5920000-0000-4000-8000-000000000002';
set local role anon;
do $$declare result jsonb;scope text;begin
 result:=public.fas_public_content_series('/stories/series-first-fixture/');
 if result->'next'->>'url'<>'/stories/series-next-fixture/' or result->'next'->>'title'<>'Secret next part' then raise exception 'FAIL published successor missing';end if;
 scope:=result->>'scope';result:=public.fas_public_content_collection(scope,'Moon world');
 if jsonb_array_length(result->'items')<>2 then raise exception 'FAIL published collection';end if;
end;$$;
reset role;
update public.stories set status='archived' where id='a5920000-0000-4000-8000-000000000002';
set local role anon;
do $$begin if public.fas_public_content_series('/stories/series-first-fixture/')->'next'<>'null'::jsonb then raise exception 'FAIL archived successor exposed';end if;end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a5900000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"a5910000-0000-4000-8000-000000000002"}',true);
do $$begin
 if public.fas_my_series_data()<>'[]'::jsonb then raise exception 'FAIL foreign relationship export';end if;
 begin perform public.fas_series_editor('a5920000-0000-4000-8000-000000000001','studio');raise exception 'FAIL viewer edit';exception when raise_exception then if SQLERRM not like 'Reopen editable%' then raise;end if;end;
end;$$;
reset role;
delete from public.stories where id='a5920000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from private.content_series where content_id='a5920000-0000-4000-8000-000000000001' or previous_id='a5920000-0000-4000-8000-000000000001') then raise exception 'FAIL deletion cleanup';end if;end;$$;
rollback;
