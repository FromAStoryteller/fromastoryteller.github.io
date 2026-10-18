
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select v.id::uuid,v.email,now(),case when r.release_id is null then '{}'::jsonb else jsonb_build_object('fas_policy_agreement',jsonb_build_object('mode','published_terms_agreement','release_id',r.release_id,'terms_version',r.terms_version,'privacy_version',r.privacy_version,'terms_sha256',r.terms_sha256,'privacy_sha256',r.privacy_sha256,'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true)) end
 from(values('a4000000-0000-0000-0000-000000000001','mail-admin@example.invalid'),('a4000000-0000-0000-0000-000000000002','mail-member@example.invalid'))v(id,email)
 cross join private.account_policy_requirement q left join private.account_policy_releases r on r.release_id=q.release_id;
insert into public.user_roles(user_id,role) values('a4000000-0000-0000-0000-000000000001','admin'),('a4000000-0000-0000-0000-000000000002','member');
insert into auth.sessions(id,user_id) values('a5000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001'),('a5000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','a4000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"a5000000-0000-0000-0000-000000000002"}',true);
do $$begin
 begin perform public.fas_queue_invitation_email('mail-target@example.invalid',7,null,gen_random_uuid());raise exception 'FAIL contributor queued email';exception when raise_exception then if SQLERRM<>'Administrator access required' then raise;end if;end;
 begin perform 1 from private.email_outbox;raise exception 'FAIL private payload readable';exception when insufficient_privilege then null;end;
 begin perform public.fas_claim_invitation_email(null);raise exception 'FAIL caller claimed mail';exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','a4000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"a5000000-0000-0000-0000-000000000001"}',true);
do $$declare first jsonb;again jsonb;begin
 first:=public.fas_queue_invitation_email('mail-target@example.invalid',7,null,'a6000000-0000-0000-0000-000000000001');
 again:=public.fas_queue_invitation_email('mail-target@example.invalid',7,null,'a6000000-0000-0000-0000-000000000001');
 if first<>again then raise exception 'FAIL request idempotency';end if;
 if first ? 'invite_token' or first ? 'recipient' then raise exception 'FAIL private queue response';end if;
 if public.fas_admin_email_jobs(0)::text like '%invite_token%' then raise exception 'FAIL token in status';end if;
end;$$;
reset role;
do $$declare j private.email_outbox;first jsonb;second jsonb;token text;begin
 select * into j from private.email_outbox where request_id='a6000000-0000-0000-0000-000000000001';
 if (select count(*) from private.email_outbox where request_id=j.request_id)<>1 then raise exception 'FAIL duplicate job';end if;
 token:=j.invite_token;first:=public.fas_claim_invitation_email(j.id);
 if first->>'token'<>token or (first->>'attempts')::int<>1 then raise exception 'FAIL first claim';end if;
 if public.fas_claim_invitation_email(j.id) is not null then raise exception 'FAIL concurrent claim';end if;
 if public.fas_finish_invitation_email(j.id,gen_random_uuid(),null,60,null) then raise exception 'FAIL wrong lease';end if;
 perform public.fas_finish_invitation_email(j.id,(first->>'lease')::uuid,null,120,null);
 if not exists(select 1 from private.email_outbox where id=j.id and state='retrying' and invite_token=token and next_attempt>=now()+interval '119 seconds') then raise exception 'FAIL retry lost credential';end if;
 update private.email_outbox set next_attempt=now()-interval '1 second' where id=j.id;
 second:=public.fas_claim_invitation_email(j.id);
 if second->>'token'<>token or second->>'id'<>first->>'id' or (second->>'attempts')::int<>2 then raise exception 'FAIL retry identity';end if;
 perform public.fas_record_email_event('mail-fixture-race','a7000000-0000-0000-0000-000000000001','email.delivered',now());
 perform public.fas_finish_invitation_email(j.id,(second->>'lease')::uuid,'a7000000-0000-0000-0000-000000000001',null,null);
 if not exists(select 1 from private.email_outbox where id=j.id and state='delivered' and invite_token is null) then raise exception 'FAIL early event or token purge';end if;
 perform public.fas_record_email_event('mail-fixture-race','a7000000-0000-0000-0000-000000000001','email.delivered',now());
 perform public.fas_record_email_event('mail-fixture-old','a7000000-0000-0000-0000-000000000001','email.delivery_delayed',now()-interval '1 minute');
 if not exists(select 1 from private.email_outbox where id=j.id and state='delivered') then raise exception 'FAIL delivery regressed';end if;
 perform public.fas_record_email_event('mail-fixture-bounce','a7000000-0000-0000-0000-000000000001','email.bounced',now());
end;$$;
set local role authenticated;
do $$declare key uuid;begin
 select (value->>'invite_id')::uuid into key from jsonb_array_elements(public.fas_admin_email_jobs(0));
 begin perform public.fas_queue_invitation_email(null,7,key,gen_random_uuid());raise exception 'FAIL bounced recipient retried';exception when raise_exception then if SQLERRM<>'Delivery blocked for this address' then raise;end if;end;
 perform public.fas_queue_invitation_email('mail-revoke@example.invalid',7,null,'a6000000-0000-0000-0000-000000000002');
 select (value->>'invite_id')::uuid into key from jsonb_array_elements(public.fas_admin_email_jobs(0)) where value->>'state'='queued';
 perform public.revoke_invite(key);
end;$$;
reset role;
do $$declare j private.email_outbox;begin
 select * into j from private.email_outbox where request_id='a6000000-0000-0000-0000-000000000002';
 if j.state<>'canceled' or j.invite_token is not null or public.fas_claim_invitation_email(j.id) is not null then raise exception 'FAIL revoke retained queued mail';end if;
end;$$;
set local role authenticated;
select public.fas_queue_invitation_email('mail-rotate@example.invalid',7,null,'a6000000-0000-0000-0000-000000000003');
reset role;
update private.email_outbox set created_at=now()-interval '2 minutes' where request_id='a6000000-0000-0000-0000-000000000003';
select set_config('fas.mail.old_hash',token_hash,true) from public.invites where email='mail-rotate@example.invalid';
set local role authenticated;
do $$declare key uuid;begin
 select (value->>'invite_id')::uuid into key from jsonb_array_elements(public.fas_admin_email_jobs(0)) where value->>'state'='queued';
 perform public.fas_queue_invitation_email(null,7,key,'a6000000-0000-0000-0000-000000000004');
end;$$;
reset role;
do $$begin
 if exists(select 1 from public.invites where email='mail-rotate@example.invalid' and token_hash=current_setting('fas.mail.old_hash')) then raise exception 'FAIL resend retained old link';end if;
 if exists(select 1 from private.email_outbox where request_id='a6000000-0000-0000-0000-000000000003' and (state<>'canceled' or invite_token is not null)) then raise exception 'FAIL resend retained old queued token';end if;
end;$$;
set local role authenticated;
select public.fas_queue_invitation_email('mail-member@example.invalid',7,null,'a6000000-0000-0000-0000-000000000005');
select public.fas_queue_invitation_email('mail-wrong@example.invalid',7,null,'a6000000-0000-0000-0000-000000000006');
reset role;
do $$begin
 perform set_config('fas.mail.own_token',(select invite_token from private.email_outbox where request_id='a6000000-0000-0000-0000-000000000005'),true);
 perform set_config('fas.mail.wrong_token',(select invite_token from private.email_outbox where request_id='a6000000-0000-0000-0000-000000000006'),true);
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','a4000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"a5000000-0000-0000-0000-000000000002"}',true);
do $$begin
 begin perform public.accept_invite(current_setting('fas.mail.wrong_token'));raise exception 'FAIL wrong recipient accepted';exception when raise_exception then if SQLERRM<>'Invite unavailable' then raise;end if;end;
 perform public.accept_invite(current_setting('fas.mail.own_token'));
 begin perform public.accept_invite(current_setting('fas.mail.own_token'));raise exception 'FAIL invitation reused';exception when raise_exception then if SQLERRM<>'Invite unavailable' then raise;end if;end;
end;$$;
reset role;
do $$begin
 if exists(select 1 from private.email_outbox where request_id='a6000000-0000-0000-0000-000000000005' and (state<>'canceled' or invite_token is not null)) then raise exception 'FAIL acceptance retained pending credential';end if;
 update public.invites set email='mail-member@example.invalid',created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' where email='mail-wrong@example.invalid';
end;$$;
set local role authenticated;
do $$begin
 begin perform public.accept_invite(current_setting('fas.mail.wrong_token'));raise exception 'FAIL expired invitation accepted';exception when raise_exception then if SQLERRM<>'Invite unavailable' then raise;end if;end;
end;$$;
select set_config('request.jwt.claim.sub','a4000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"a5000000-0000-0000-0000-000000000001"}',true);
reset role;
do $$declare key uuid;begin
 select id into key from private.email_outbox where request_id='a6000000-0000-0000-0000-000000000006';
 if public.fas_claim_invitation_email(key) is not null then raise exception 'FAIL expired invitation claimed';end if;
 if exists(select 1 from private.email_outbox where id=key and (state<>'canceled' or invite_token is not null)) then raise exception 'FAIL expired invitation retained token';end if;
end;$$;
update auth.sessions set not_after=now()-interval '1 second' where id='a5000000-0000-0000-0000-000000000001';
set local role service_role;
select public.fas_claim_invitation_email(null);
reset role;
do $$begin
 if exists(select 1 from private.email_outbox where request_id='a6000000-0000-0000-0000-000000000004' and (state<>'canceled' or invite_token is not null)) then raise exception 'FAIL expired session sent';end if;
end;$$;
set local role anon;
do $$begin
 begin perform public.fas_admin_email_jobs(0);raise exception 'FAIL anonymous status';exception when insufficient_privilege then null;end;
 begin perform public.fas_record_email_event('fake',gen_random_uuid(),'email.delivered',now());raise exception 'FAIL anonymous event';exception when insufficient_privilege then null;end;
end;$$;
reset role;
rollback;
