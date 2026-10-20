-- Fictional identities; all changes are rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at)values
('a5800000-0000-4000-8000-000000000001','viewer-actions-writer@example.invalid',now()),
('a5800000-0000-4000-8000-000000000002','viewer-actions-reader@example.invalid',now()),
('a5800000-0000-4000-8000-000000000003','viewer-actions-other@example.invalid',now());
insert into public.user_roles(user_id,role)values('a5800000-0000-4000-8000-000000000001','member');
insert into auth.sessions(id,user_id)values
('a5810000-0000-4000-8000-000000000001','a5800000-0000-4000-8000-000000000001'),
('a5810000-0000-4000-8000-000000000002','a5800000-0000-4000-8000-000000000002'),
('a5810000-0000-4000-8000-000000000003','a5800000-0000-4000-8000-000000000003');
insert into public.stories(id,author_id,slug,title,body,status,published_at)values
('a5820000-0000-4000-8000-000000000001','a5800000-0000-4000-8000-000000000001','viewer-public-fixture','Viewer public fixture','Prose','published',now()),
('a5820000-0000-4000-8000-000000000002','a5800000-0000-4000-8000-000000000001','viewer-private-fixture','Viewer private fixture','Secret prose','draft',null);
insert into private.file_content(id,owner_id,url,content_type,title,summary,slug,published_at,image,image_alt)values
('a5830000-0000-4000-8000-000000000001','a5800000-0000-4000-8000-000000000001','/games/viewer-file-fixture/','game','Game fixture','Description','viewer-file-fixture',now(),'/assets/images/games/fixture.png','Fictional image');
set local role anon;
do $$begin
 begin perform public.fas_my_viewer_actions(array['/stories/viewer-public-fixture/']);raise exception 'FAIL anonymous read';exception when insufficient_privilege then null;end;
 begin perform public.fas_set_viewer_action('/stories/viewer-public-fixture/','loved',true);raise exception 'FAIL anonymous write';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a5800000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"a5810000-0000-4000-8000-000000000002"}',true);
do $$declare result jsonb;begin
 if public.fas_my_viewer_actions(array['/stories/viewer-private-fixture/'])<>'[]'::jsonb then raise exception 'FAIL private target leak';end if;
 begin perform public.fas_set_viewer_action('/stories/viewer-private-fixture/','loved',true);raise exception 'FAIL private write';exception when raise_exception then if SQLERRM<>'Content unavailable' then raise;end if;end;
 result:=public.fas_set_viewer_action('/stories/viewer-public-fixture/','saved',true);
 if result->>'saved'<>'true' or result->>'experienced'<>'false' or result->>'loved'<>'false' then raise exception 'FAIL independent save';end if;
 perform public.fas_set_viewer_action('/stories/viewer-public-fixture/','loved',true);
 perform public.fas_set_viewer_action('/stories/viewer-public-fixture/','loved',true);
 result:=public.fas_set_viewer_action('a5820000-0000-4000-8000-000000000001','experienced',true);
 if result->>'saved'<>'true' or result->>'loved'<>'true' then raise exception 'FAIL actions overwrite each other';end if;
 perform public.fas_set_viewer_action('/games/viewer-file-fixture/','saved',true);
 perform public.fas_set_viewer_action('/games/viewer-file-fixture/','experienced',true);
 if jsonb_array_length(public.fas_my_viewer_collection('later')->'items')<>1 or jsonb_array_length(public.fas_my_viewer_collection('favourites')->'items')<>1 then raise exception 'FAIL collection split';end if;
 if jsonb_array_length(public.fas_my_viewer_data())<>2 then raise exception 'FAIL own data export';end if;
 begin perform public.fas_set_viewer_action('/games/viewer-file-fixture/','arbitrary',true);raise exception 'FAIL unknown action';exception when raise_exception then if SQLERRM<>'Choose a supported action' then raise;end if;end;
 begin perform public.fas_my_studio_acknowledgements();raise exception 'FAIL viewer contributor totals';exception when raise_exception then if SQLERRM<>'Contributor access required' then raise;end if;end;
 begin perform * from private.viewer_content_actions;raise exception 'FAIL direct table read';exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','a5800000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"a5810000-0000-4000-8000-000000000003"}',true);
do $$begin
 if public.fas_my_viewer_data()<>'[]'::jsonb or public.fas_my_viewer_actions(array['/stories/viewer-public-fixture/'])->0->>'saved'<>'false' then raise exception 'FAIL cross-account leak';end if;
 if public.fas_my_viewer_collection('later')->'items'<>'[]'::jsonb then raise exception 'FAIL cross-account collection';end if;
 perform public.fas_set_viewer_action('/stories/viewer-public-fixture/','loved',true);
end;$$;
select set_config('request.jwt.claim.sub','a5800000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"a5810000-0000-4000-8000-000000000001"}',true);
do $$declare report jsonb;begin
 report:=public.fas_my_studio_acknowledgements();
 if report->>'loved'<>'2' or report->>'experienced'<>'2' or report::text like '%saved%' or report::text like '%a5800000%' then raise exception 'FAIL private aggregate report';end if;
 if public.fas_my_studio_acknowledgements('a5820000-0000-4000-8000-000000000001')->>'experienced'<>'1' then raise exception 'FAIL per piece report';end if;
end;$$;
reset role;
-- A different contributor receives no totals for the owner.
insert into public.user_roles(user_id,role)values('a5800000-0000-4000-8000-000000000003','member');

-- UUIDs can be supplied by a contributor using the API. A colliding Studio row
-- must never claim a legacy game's choices or hide it from saved collections.
insert into public.stories(id,author_id,slug,title,body,status,published_at)values
('a5830000-0000-4000-8000-000000000001','a5800000-0000-4000-8000-000000000003','viewer-colliding-fixture','Collision fixture','Prose','published',now());

set local role authenticated;
select set_config('request.jwt.claim.sub','a5800000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"a5810000-0000-4000-8000-000000000003"}',true);
do $$begin
 if public.fas_my_studio_acknowledgements()->>'loved'<>'0' or public.fas_my_studio_acknowledgements()->>'experienced'<>'0' then raise exception 'FAIL other contributor totals';end if;
 begin perform public.fas_set_viewer_action('/stories/viewer-colliding-fixture/','saved',true);raise exception 'FAIL collision accepted';exception when raise_exception then if SQLERRM<>'Content unavailable' then raise;end if;end;
end;$$;
reset role;
-- Hidden work is omitted, but the viewer's own choices remain exportable.
update public.stories set status='archived' where id='a5820000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','a5800000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"a5810000-0000-4000-8000-000000000002"}',true);
do $$begin if public.fas_my_viewer_collection('later')->'items'<>'[]'::jsonb then raise exception 'FAIL hidden collection content';end if;if jsonb_array_length(public.fas_my_viewer_collection('favourites')->'items')<>1 or public.fas_my_viewer_collection('favourites')->'items'->0->>'type'<>'game' then raise exception 'FAIL collision hid original game';end if;end;$$;
reset role;
do $$begin
 if jsonb_array_length(public.fas_account_snapshot('a5800000-0000-4000-8000-000000000002','a5810000-0000-4000-8000-000000000002')->'data'->'viewer_actions')<>2 then raise exception 'FAIL snapshot export';end if;
end;$$;
delete from auth.sessions where id='a5810000-0000-4000-8000-000000000002';
set local role authenticated;
do $$begin
 begin perform public.fas_my_viewer_data();raise exception 'FAIL revoked session';exception when raise_exception then if SQLERRM='FAIL revoked session' then raise;end if;end;
end;$$;
reset role;
delete from public.stories where id='a5820000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from private.viewer_content_actions where content_id='a5820000-0000-4000-8000-000000000001') then raise exception 'FAIL deleted content cascade';end if;end;$$;

-- Collection cursor boundaries: no missing or duplicated items across pages.
insert into public.stories(id,author_id,slug,title,body,status,published_at)
select md5('viewer-pagination-'||n)::uuid,'a5800000-0000-4000-8000-000000000001','viewer-pagination-'||n,'Pagination '||n,'Prose','published',now() from generate_series(1,50)n;
set local role authenticated;
select set_config('request.jwt.claim.sub','a5800000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"a5810000-0000-4000-8000-000000000003"}',true);
do $$declare n integer;first_page jsonb;second_page jsonb;begin
 for n in 1..50 loop perform public.fas_set_viewer_action('/stories/viewer-pagination-'||n||'/','saved',true);end loop;
 first_page:=public.fas_my_viewer_collection('later');
 second_page:=public.fas_my_viewer_collection('later',(first_page->'next_cursor'->>'saved_at')::timestamptz,(first_page->'next_cursor'->>'id')::uuid);
 if jsonb_array_length(first_page->'items')<>48 or jsonb_array_length(second_page->'items')<>2 or second_page->'next_cursor'<>'null'::jsonb then raise exception 'FAIL collection pagination';end if;
 if exists(select 1 from jsonb_array_elements(first_page->'items')a join jsonb_array_elements(second_page->'items')b on a->>'id'=b->>'id') then raise exception 'FAIL pagination duplicate';end if;
end;$$;
reset role;

delete from auth.users where id='a5800000-0000-4000-8000-000000000002';
do $$begin if exists(select 1 from private.viewer_content_actions where owner_id='a5800000-0000-4000-8000-000000000002') then raise exception 'FAIL deleted account cascade';end if;end;$$;
rollback;
