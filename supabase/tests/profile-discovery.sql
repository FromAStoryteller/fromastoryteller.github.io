-- Fictional records, rollback only. Hosted execution is restricted to DEV.
BEGIN;
insert into auth.users(id,email,email_confirmed_at)
select ('a6100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'discovery-'||n||'@example.invalid',now() from generate_series(1,29) n;
insert into public.user_roles(user_id,role) select id,'member' from auth.users where id::text like 'a6100000-0000-4000-8000-%' and id<>'a6100000-0000-4000-8000-000000000029';
update public.profiles set display_name='Discovery fixture '||right(id::text,2),bio='Quiet fantasy and folklore',welcome_line='Fictional public introduction' where id::text like 'a6100000-0000-4000-8000-%';
insert into public.stories(id,author_id,slug,title,body,status) values('a6110000-0000-4000-8000-000000000001','a6100000-0000-4000-8000-000000000001','discovery-secret-fixture','Private discovery manuscript','Do not expose','draft');
set local role anon;
do $$declare page jsonb;next_page jsonb;profile jsonb;begin
 page:=public.fas_public_profile_catalog('Discovery fixture');
 if jsonb_array_length(page->'items')<>24 or page->'next_cursor'='null'::jsonb then raise exception 'FAIL directory pagination';end if;
 next_page:=public.fas_public_profile_catalog('Discovery fixture',page->'next_cursor'->>'name',(page->'next_cursor'->>'id')::uuid);
 if jsonb_array_length(next_page->'items')<>4 or next_page->'next_cursor'<>'null'::jsonb then raise exception 'FAIL directory continuation';end if;
 if exists(select 1 from jsonb_array_elements(page->'items') a cross join jsonb_array_elements(next_page->'items') b where a->>'public_id'=b->>'public_id') then raise exception 'FAIL duplicate directory records';end if;
 if page::text like '%@example.invalid%' or page::text like '%a6100000%' or page::text like '%Private discovery manuscript%' or page::text like '%owner_id%' then raise exception 'FAIL private directory fields';end if;
 if jsonb_array_length(public.fas_public_profile_catalog('Discovery fixture 29')->'items')<>0 then raise exception 'FAIL viewer listed';end if;
 if jsonb_array_length(public.fas_public_profile_catalog('Discovery fixture 01')->'items')<>1 then raise exception 'FAIL exact name search';end if;
 if jsonb_array_length(public.fas_public_profile_catalog('fixture %')->'items')<>0 then raise exception 'FAIL search wildcard treated as pattern';end if;
 begin perform public.fas_public_profile_catalog(repeat('x',101));raise exception 'FAIL excessive query accepted';exception when raise_exception then if SQLERRM<>'Invalid storyteller search' then raise;end if;end;
 profile:=public.fas_public_profile((page->'items'->0->>'public_id')::uuid);
 if profile is null or jsonb_array_length(profile->'stories')<>0 then raise exception 'FAIL public profile lookup/draft privacy';end if;
end;$$;
reset role;
delete from public.user_roles where user_id='a6100000-0000-4000-8000-000000000001' and role='member';
insert into private.account_deletion_jobs(user_id,receipt_hash) values('a6100000-0000-4000-8000-000000000002',repeat('a',64));
set local role anon;
do $$begin if jsonb_array_length(public.fas_public_profile_catalog('Discovery fixture 01')->'items')<>0 then raise exception 'FAIL revoked contributor remains discoverable';end if;end;$$;
do $$begin if jsonb_array_length(public.fas_public_profile_catalog('Discovery fixture 02')->'items')<>0 then raise exception 'FAIL removed contributor remains discoverable';end if;end;$$;
reset role;
ROLLBACK;
