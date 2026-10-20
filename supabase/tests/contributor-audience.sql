-- Fictional fixtures, all rolled back. No production visitor counts.
begin;
insert into auth.users(id,email,email_confirmed_at)values('a5500000-0000-4000-8000-000000000001','insights-owner@example.invalid',now()),('a5500000-0000-4000-8000-000000000002','insights-viewer@example.invalid',now());
insert into public.user_roles(user_id,role)values('a5500000-0000-4000-8000-000000000001','member');
insert into auth.sessions(id,user_id)values('a5510000-0000-4000-8000-000000000001','a5500000-0000-4000-8000-000000000001'),('a5510000-0000-4000-8000-000000000002','a5500000-0000-4000-8000-000000000002');
insert into public.stories(id,author_id,slug,title,body,status,published_at)values('a5520000-0000-4000-8000-000000000001','a5500000-0000-4000-8000-000000000001','insights-published-fixture','Insights public fixture','Public prose','published',now()),('a5520000-0000-4000-8000-000000000002','a5500000-0000-4000-8000-000000000001','insights-private-fixture','Insights private fixture','Private prose','draft',null);
insert into private.file_content(id,owner_id,url,content_type,title,summary,slug,published_at,image,image_alt)values('a5530000-0000-4000-8000-000000000001','a5500000-0000-4000-8000-000000000001','/stories/insights-file-fixture/','story','File fixture','Description','insights-file-fixture',now(),'/assets/images/stories/fixture.png','Fictional image');
set local role service_role;
do $$begin
 if not public.fas_record_page_view('content','a5520000-0000-4000-8000-000000000001','search','desktop') or not public.fas_record_page_view('content','a5530000-0000-4000-8000-000000000001','internal','tablet') then raise exception 'FAIL public content counters';end if;
 if public.fas_record_page_view('content','a5520000-0000-4000-8000-000000000002','direct','mobile') then raise exception 'FAIL private draft counted';end if;
end;$$;
reset role;
do $$declare key uuid;begin
 select public_id into key from public.profiles where id='a5500000-0000-4000-8000-000000000001';
 if not public.fas_record_page_view('profile',key,'social','mobile') or not public.fas_record_page_view('profile',key,'social','mobile') then raise exception 'FAIL public profile counter';end if;
 if (select views from private.page_performance_reports where provider='FAS first-party' and page_id=key)<>2 then raise exception 'FAIL atomic increment';end if;
 select public_id into key from public.profiles where id='a5500000-0000-4000-8000-000000000002';
 if public.fas_record_page_view('profile',key,'direct','desktop') or public.fas_record_page_view('profile',gen_random_uuid(),'direct','desktop') or public.fas_record_page_view('profile',key,'arbitrary-url','desktop') then raise exception 'FAIL private profile or dimensions counted';end if;
 begin perform public.fas_reserve_image_upload('a5500000-0000-4000-8000-000000000002','a5510000-0000-4000-8000-000000000002','a5500000-0000-4000-8000-000000000002/'||key||'/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg','profile');raise exception 'FAIL viewer reservation';exception when raise_exception then if SQLERRM<>'Contributor access required' then raise;end if;end;
 begin perform public.fas_register_profile_image('a5500000-0000-4000-8000-000000000002','a5510000-0000-4000-8000-000000000002','unused','description',gen_random_uuid());raise exception 'FAIL viewer registration';exception when raise_exception then if SQLERRM<>'Contributor access required' then raise;end if;end;
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','a5500000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"session_id":"a5510000-0000-4000-8000-000000000001"}',true);
do $$begin if (public.fas_my_studio_traffic(null,7)->>'views')::int<>4 then raise exception 'FAIL own report';end if;begin perform public.fas_record_page_view('profile',gen_random_uuid(),'direct','desktop');raise exception 'FAIL client forged view';exception when insufficient_privilege then null;end;end;$$;
select set_config('request.jwt.claim.sub','a5500000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"session_id":"a5510000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform public.fas_begin_profile_upload();raise exception 'FAIL viewer preflight';exception when raise_exception then if SQLERRM<>'Contributor access required' then raise;end if;end;
 begin perform public.fas_my_studio_traffic(null,7);raise exception 'FAIL viewer insights';exception when raise_exception then if SQLERRM<>'Contributor access required' then raise;end if;end;
end;$$;
reset role;
-- A second contributor cannot see the first contributor's counts.
insert into public.user_roles(user_id,role)values('a5500000-0000-4000-8000-000000000002','member');
set local role authenticated;
do $$begin if (public.fas_my_studio_traffic(null,30)->>'views')::int<>0 then raise exception 'FAIL cross-owner report';end if;end;$$;
reset role;
insert into private.page_performance_reports(provider,report_key,report_date,page_kind,page_id,views)select provider,'expired-insights-fixture',current_date-90,'profile',p.public_id,1 from public.profiles p cross join (values('FAS first-party'),('unrelated-provider'))v(provider) where p.id='a5500000-0000-4000-8000-000000000001';
select private.prune_page_views();
do $$begin if exists(select 1 from private.page_performance_reports where provider='FAS first-party' and report_key='expired-insights-fixture') or not exists(select 1 from private.page_performance_reports where provider='unrelated-provider' and report_key='expired-insights-fixture') then raise exception 'FAIL anonymous retention or unrelated provider removal';end if;end;$$;
rollback;
