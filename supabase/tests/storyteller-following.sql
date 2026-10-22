-- Fictional verified accounts; rollback only. Hosted execution is DEV only.
begin;
insert into auth.users(id,email,email_confirmed_at)
select ('a6300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'following-'||n||'@example.invalid',now() from generate_series(1,29)n;
insert into public.user_roles(user_id,role) select id,'member' from auth.users where id::text like 'a6300000-0000-4000-8000-%' and right(id::text,2)::integer<=27;
update public.profiles set display_name='Following fixture '||right(id::text,2) where id::text like 'a6300000-0000-4000-8000-%';
insert into auth.sessions(id,user_id) select ('a6310000-0000-4000-8000-'||right(id::text,12))::uuid,id from auth.users where id::text like 'a6300000-0000-4000-8000-%';
create temporary table follow_fixture_keys as select id,public_id,display_name from public.profiles where id::text like 'a6300000-0000-4000-8000-%';
grant select on follow_fixture_keys to authenticated;
set local role anon;
do $$begin
 begin perform public.fas_my_following();raise exception 'FAIL anonymous following';exception when insufficient_privilege then null;end;
 begin perform public.fas_my_follower_count();raise exception 'FAIL anonymous count';exception when insufficient_privilege then null;end;
 begin perform public.fas_set_storyteller_follow(gen_random_uuid(),true);raise exception 'FAIL anonymous follow';exception when insufficient_privilege then null;end;
 begin perform count(*) from private.storyteller_follows;raise exception 'FAIL anonymous table';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a6300000-0000-4000-8000-000000000028',true);
select set_config('request.jwt.claims','{"session_id":"a6310000-0000-4000-8000-000000000028"}',true);
do $$declare key uuid;page jsonb;next_page jsonb;begin
 for key in select public_id from follow_fixture_keys where display_name like 'Following fixture %' and right(display_name,2)::integer<=27 loop perform public.fas_set_storyteller_follow(key,true);end loop;
 select public_id into key from follow_fixture_keys where display_name='Following fixture 01';
 perform public.fas_set_storyteller_follow(key,true);
 if public.fas_my_storyteller_follow(key)->>'following'<>'true' then raise exception 'FAIL follow state';end if;
 if jsonb_array_length(public.fas_my_following_data())<>27 then raise exception 'FAIL idempotent follow/export';end if;
 page:=public.fas_my_following();next_page:=public.fas_my_following(page->'next_cursor'->>'name',(page->'next_cursor'->>'id')::uuid);
 if jsonb_array_length(page->'items')<>24 or jsonb_array_length(next_page->'items')<>3 or next_page->'next_cursor'<>'null'::jsonb then raise exception 'FAIL following pagination';end if;
 if exists(select 1 from jsonb_array_elements(page->'items') a join jsonb_array_elements(next_page->'items') b on a->>'public_id'=b->>'public_id') then raise exception 'FAIL duplicate continuation';end if;
 if page::text like '%@example.invalid%' or page::text like '%a6300000%' or page::text like '%follower_id%' or page::text like '%people_following%' then raise exception 'FAIL private following fields';end if;
 begin perform public.fas_my_follower_count();raise exception 'FAIL viewer count';exception when raise_exception then if SQLERRM<>'Contributor access required' then raise;end if;end;
 begin perform count(*) from private.storyteller_follows;raise exception 'FAIL authenticated table';exception when insufficient_privilege then null;end;
 begin perform public.fas_set_storyteller_follow(gen_random_uuid(),true);raise exception 'FAIL invalid target';exception when raise_exception then if SQLERRM<>'Storyteller unavailable' then raise;end if;end;
end;$$;
select set_config('request.jwt.claim.sub','a6300000-0000-4000-8000-000000000029',true);
select set_config('request.jwt.claims','{"session_id":"a6310000-0000-4000-8000-000000000029"}',true);
do $$declare key uuid;snapshot jsonb;begin
 if jsonb_array_length(public.fas_my_following()->'items')<>0 then raise exception 'FAIL cross-account list';end if;
 select public_id into key from follow_fixture_keys where display_name='Following fixture 01';perform public.fas_set_storyteller_follow(key,true);
 begin perform public.fas_account_snapshot('a6300000-0000-4000-8000-000000000029','a6310000-0000-4000-8000-000000000029');raise exception 'FAIL direct snapshot API';exception when insufficient_privilege then null;end;
end;$$;
reset role;
do $$declare key uuid;snapshot jsonb;begin
 select public_id into key from public.profiles where display_name='Following fixture 01';
 snapshot:=public.fas_account_snapshot('a6300000-0000-4000-8000-000000000029','a6310000-0000-4000-8000-000000000029');
 if jsonb_array_length(snapshot->'data'->'following')<>1 then raise exception 'FAIL complete account export';end if;
 perform public.fas_set_storyteller_follow(key,false);perform public.fas_set_storyteller_follow(key,false);
 if public.fas_account_snapshot('a6300000-0000-4000-8000-000000000029','a6310000-0000-4000-8000-000000000029')->>'fingerprint'=snapshot->>'fingerprint' then raise exception 'FAIL deletion fingerprint';end if;
 perform public.fas_set_storyteller_follow(key,true);
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','a6300000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"a6310000-0000-4000-8000-000000000001"}',true);
do $$declare key uuid;begin
 if public.fas_my_follower_count()->>'people_following'<>'2' then raise exception 'FAIL private count';end if;
 select public_id into key from follow_fixture_keys where display_name='Following fixture 01';
 begin perform public.fas_set_storyteller_follow(key,true);raise exception 'FAIL self follow';exception when raise_exception then if SQLERRM<>'You cannot follow your own profile' then raise;end if;end;
 if public.fas_my_storyteller_follow(key)->>'can_follow'<>'false' then raise exception 'FAIL self control';end if;
 if public.fas_public_profile(key)::text like '%people_following%' then raise exception 'FAIL public count';end if;
end;$$;
reset role;
insert into private.account_deletion_jobs(user_id,receipt_hash) values('a6300000-0000-4000-8000-000000000029',repeat('a',64));
set local role authenticated;
select set_config('request.jwt.claim.sub','a6300000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"a6310000-0000-4000-8000-000000000001"}',true);
do $$begin if public.fas_my_follower_count()->>'people_following'<>'1' then raise exception 'FAIL closing follower count';end if;end;$$;
reset role;
delete from public.user_roles where user_id='a6300000-0000-4000-8000-000000000027';
set local role authenticated;
select set_config('request.jwt.claim.sub','a6300000-0000-4000-8000-000000000028',true);
select set_config('request.jwt.claims','{"session_id":"a6310000-0000-4000-8000-000000000028"}',true);
do $$declare key uuid;begin
 select public_id into key from follow_fixture_keys where display_name='Following fixture 27';
 if public.fas_my_storyteller_follow(key)->>'available'<>'false' then raise exception 'FAIL revoked target';end if;
 perform public.fas_set_storyteller_follow(key,false);
end;$$;
select set_config('request.jwt.claims','{"session_id":"a6310000-0000-4000-8000-000000000099"}',true);
do $$begin begin perform public.fas_my_following();raise exception 'FAIL expired session';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end;$$;
reset role;
delete from auth.users where id='a6300000-0000-4000-8000-000000000028';
do $$begin if exists(select 1 from private.storyteller_follows where follower_id='a6300000-0000-4000-8000-000000000028') then raise exception 'FAIL follower deletion cascade';end if;end;$$;
delete from auth.users where id='a6300000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from private.storyteller_follows f left join public.profiles p on p.public_id=f.person_key where f.person_key is not null and p.id is null) then raise exception 'FAIL storyteller deletion cascade';end if;end;$$;
rollback;
