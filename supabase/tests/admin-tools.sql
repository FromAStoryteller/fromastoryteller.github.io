begin;
insert into auth.users(id,email,email_confirmed_at) values
('91000000-0000-0000-0000-000000000001','admin-tools-a@example.invalid',now()),
('91000000-0000-0000-0000-000000000002','admin-tools-b@example.invalid',now()),
('91000000-0000-0000-0000-000000000003','admin-tools-v@example.invalid',now());
insert into auth.sessions(id,user_id) values
('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001'),
('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002'),
('92000000-0000-0000-0000-000000000003','91000000-0000-0000-0000-000000000003');
insert into public.user_roles values
('91000000-0000-0000-0000-000000000001','admin'),('91000000-0000-0000-0000-000000000001','member'),
('91000000-0000-0000-0000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"92000000-0000-0000-0000-000000000001"}',true);
select public.fas_admin_overview();
select public.fas_admin_set_role('91000000-0000-0000-0000-000000000002','admin',true,'admin-tools-b@example.invalid','Synthetic admin tools check');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"92000000-0000-0000-0000-000000000002"}',true);
select public.fas_admin_set_role('91000000-0000-0000-0000-000000000002','admin',false,'admin-tools-b@example.invalid','Synthetic relinquishment');
do $$ begin
 if not private.is_member() or private.is_admin() then raise exception 'FAIL independent admin relinquishment'; end if;
 begin perform public.fas_admin_overview();raise exception 'FAIL former admin tools access';exception when raise_exception then if SQLERRM like 'FAIL%' then raise; end if;end;
end $$;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"92000000-0000-0000-0000-000000000001"}',true);
select public.fas_admin_set_role('91000000-0000-0000-0000-000000000002','admin',true,'admin-tools-b@example.invalid','Synthetic admin regrant');
select public.fas_admin_set_role('91000000-0000-0000-0000-000000000002','member',false,'admin-tools-b@example.invalid','Synthetic contributor removal');
do $$ begin perform set_config('fas.admin_test_invite',public.create_invite('admin-tools-v@example.invalid',7),true);end $$;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"92000000-0000-0000-0000-000000000002"}',true);
do $$ begin
 if private.is_member() or not private.is_admin() then raise exception 'FAIL independent contributor removal';end if;
 begin insert into public.stories(author_id,slug,title) values(auth.uid(),'admin-tools-denied','Denied');raise exception 'FAIL admin-only publishing';exception when insufficient_privilege then null;end;
 begin perform public.accept_invite(current_setting('fas.admin_test_invite'));raise exception 'FAIL wrong invite email';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"92000000-0000-0000-0000-000000000003"}',true);
select public.accept_invite(current_setting('fas.admin_test_invite'));
do $$ begin
 if not private.is_member() or private.is_admin() then raise exception 'FAIL invitation role';end if;
 begin perform public.accept_invite(current_setting('fas.admin_test_invite'));raise exception 'FAIL reused invite';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin perform public.fas_admin_activity();raise exception 'FAIL contributor audit read';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
reset role;
delete from auth.sessions where id='92000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"92000000-0000-0000-0000-000000000002"}',true);
do $$ begin
 begin perform public.fas_admin_overview();raise exception 'FAIL revoked session admin';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
rollback;
select 'PASS hosted admin role/session/invitation checks; fixtures rolled back' result;
