begin;
grant usage on schema private to service_role;
create table private.email_outbox(
 id uuid primary key default gen_random_uuid(),invite_id uuid not null references public.invites(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,session_id uuid not null,request_id uuid not null,
 recipient text not null,invite_token text,expires_at timestamptz not null,created_at timestamptz not null default now(),
 state text not null default 'queued' check(state in('queued','sending','retrying','accepted','delivered','delayed','failed','bounced','complained','suppressed','canceled')),
 attempts integer not null default 0,next_attempt timestamptz not null default now(),lease uuid,
 provider_id uuid unique,last_event_at timestamptz,last_reason text,unique(actor_id,request_id)
);
create index email_outbox_pending on private.email_outbox(next_attempt,created_at) where state in('queued','retrying','sending');
create index email_outbox_invite on private.email_outbox(invite_id,created_at desc);
create index email_outbox_actor on private.email_outbox(actor_id);
create table private.email_worker_config(singleton boolean primary key default true check(singleton),base_url text not null check(base_url in('https://oqmmvjjycpyxvxipcyli.supabase.co','https://vzdicnufhidelaoeqbza.supabase.co')),enabled boolean not null default false);
create table private.email_worker_tokens(hash text primary key,expires_at timestamptz not null);
create table private.email_events(id text primary key check(char_length(id)<=200),provider_id uuid not null,event_type text not null,event_time timestamptz not null,created_at timestamptz not null default now());
create index email_events_provider on private.email_events(provider_id,event_time);
alter table private.email_outbox enable row level security;
alter table private.email_worker_config enable row level security;
alter table private.email_worker_tokens enable row level security;
alter table private.email_events enable row level security;
revoke all on private.email_outbox,private.email_worker_config,private.email_worker_tokens,private.email_events from public,anon,authenticated;
create function private.admin_email_jobs(page_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.require_admin();
 if page_offset is null or page_offset not between 0 and 1000000 then raise exception 'Invalid page';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (select id,invite_id,state,attempts,next_attempt,created_at,last_reason from private.email_outbox order by created_at desc,id limit 25 offset page_offset)x),'[]');
end;$$;
create function public.fas_admin_email_jobs(page_offset integer) returns jsonb language sql set search_path='' as $$select private.admin_email_jobs(page_offset);$$;
revoke all on function private.admin_email_jobs(integer),public.fas_admin_email_jobs(integer) from public,anon,authenticated,service_role;
grant execute on function private.admin_email_jobs(integer),public.fas_admin_email_jobs(integer) to authenticated;
create function private.queue_invitation_email(email_address text,valid_days integer,target_invite uuid,request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;job private.email_outbox;invite public.invites;token text;session_key uuid;recipient_key text;begin
 caller:=private.require_admin();session_key:=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id';
 if request_key is null then raise exception 'Request reference required';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,146389898));
 select * into job from private.email_outbox where actor_id=caller and request_id=request_key;
 if found then return jsonb_build_object('id',job.id,'invite_id',job.invite_id,'state',job.state);end if;
 recipient_key:=case when target_invite is null then lower(btrim(email_address)) else (select email from public.invites where id=target_invite) end;
 if exists(select 1 from private.email_outbox where recipient=recipient_key and state in('bounced','complained','suppressed')) then raise exception 'Delivery blocked for this address';end if;
 if target_invite is null then
  token:=public.create_invite(email_address,valid_days);
  select * into invite from public.invites where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 else
  select * into invite from public.invites where id=target_invite for update;
  if invite.id is null or invite.accepted_at is not null or invite.revoked_at is not null or invite.expires_at<=now() then raise exception 'Invitation unavailable or expired';end if;
  if exists(select 1 from private.email_outbox where invite_id=target_invite and created_at>now()-interval '60 seconds') then raise exception 'Wait one minute before resending';end if;
  if (select count(*) from private.email_outbox where invite_id=target_invite and created_at>now()-interval '1 hour')>=3 then raise exception 'Invitation email retry limit reached';end if;
  token:=gen_random_uuid()::text||gen_random_uuid()::text;
  update public.invites set token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') where id=target_invite;
 end if;
 insert into private.email_outbox(invite_id,actor_id,session_id,request_id,recipient,invite_token,expires_at) values(invite.id,caller,session_key,request_key,invite.email,token,invite.expires_at) returning * into job;
 insert into private.admin_audit(actor_id,action,subject_id,reason) values(caller,'invite_email_queued',invite.id,'Contributor invitation email requested');
 return jsonb_build_object('id',job.id,'invite_id',job.invite_id,'state',job.state);
end;$$;
create function public.fas_queue_invitation_email(email_address text,valid_days integer,target_invite uuid,request_key uuid) returns jsonb language sql set search_path='' as $$select private.queue_invitation_email(email_address,valid_days,target_invite,request_key);$$;
revoke all on function private.queue_invitation_email(text,integer,uuid,uuid),public.fas_queue_invitation_email(text,integer,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.queue_invitation_email(text,integer,uuid,uuid),public.fas_queue_invitation_email(text,integer,uuid,uuid) to authenticated;
create function private.cancel_invitation_mail() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.accepted_at is not null or new.revoked_at is not null or new.token_hash is distinct from old.token_hash then
  update private.email_outbox set state='canceled',invite_token=null,lease=null,last_reason='invitation_changed' where invite_id=new.id and state in('queued','retrying','sending');
 end if;return new;
end;$$;
create trigger fas_cancel_invitation_mail after update on public.invites for each row execute function private.cancel_invitation_mail();
revoke all on function private.cancel_invitation_mail() from public,anon,authenticated;
create function private.set_email_ready(project_url text,is_ready boolean) returns boolean language plpgsql security definer set search_path='' as $$begin
 insert into private.email_worker_config(singleton,base_url,enabled) values(true,project_url,is_ready) on conflict(singleton) do update set enabled=excluded.enabled;
 return is_ready;
end;$$;
create function public.fas_set_email_ready(project_url text,is_ready boolean) returns boolean language sql set search_path='' as $$select private.set_email_ready(project_url,is_ready);$$;
revoke all on function private.set_email_ready(text,boolean),public.fas_set_email_ready(text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.set_email_ready(text,boolean),public.fas_set_email_ready(text,boolean) to service_role;
create function private.claim_invitation_email(job_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare job private.email_outbox;invite public.invites;begin
 -- Invitation rows are always locked before their outbox rows, including cancellation.
 for invite in select i.* from public.invites i where exists(select 1 from private.email_outbox j where j.invite_id=i.id and (job_key is null or j.id=job_key) and j.state in('queued','retrying','sending') and j.next_attempt<=now()) order by i.created_at for update skip locked limit 1 loop
  select * into job from private.email_outbox where invite_id=invite.id and (job_key is null or id=job_key) and state in('queued','retrying','sending') and next_attempt<=now() order by created_at for update skip locked limit 1;
  if not found then continue;end if;
  if invite.accepted_at is not null or invite.revoked_at is not null or invite.expires_at<=now() or job.created_at<now()-interval '1 hour' or job.attempts>=6 or job.invite_token is null
    or not private.account_active(job.actor_id) or not exists(select 1 from public.user_roles where user_id=job.actor_id and role='admin')
    or not exists(select 1 from auth.sessions where id=job.session_id and user_id=job.actor_id and (not_after is null or not_after>now())) then
   update private.email_outbox set state='canceled',invite_token=null,lease=null,last_reason='expired_or_access_changed' where id=job.id;continue;
  end if;
  update private.email_outbox set state='sending',attempts=attempts+1,lease=gen_random_uuid(),next_attempt=now()+interval '2 minutes' where id=job.id returning * into job;
  return jsonb_build_object('id',job.id,'recipient',job.recipient,'token',job.invite_token,'expires_at',job.expires_at,'lease',job.lease,'attempts',job.attempts,'created_at',job.created_at);
 end loop;
 return null;
end;$$;
create function public.fas_claim_invitation_email(job_key uuid) returns jsonb language sql set search_path='' as $$select private.claim_invitation_email(job_key);$$;
revoke all on function private.claim_invitation_email(uuid),public.fas_claim_invitation_email(uuid) from public,anon,authenticated,service_role;
grant execute on function private.claim_invitation_email(uuid),public.fas_claim_invitation_email(uuid) to service_role;
create function private.finish_invitation_email(job_key uuid,lease_key uuid,provider_key uuid,retry_delay integer,failure_reason text) returns boolean language plpgsql security definer set search_path='' as $$declare job private.email_outbox;event_row record;begin
 select * into job from private.email_outbox where id=job_key;
 if job.id is null then return false;end if;
 perform 1 from public.invites where id=job.invite_id for update;
 select * into job from private.email_outbox where id=job_key for update;
 if job.state<>'sending' or job.lease is distinct from lease_key then return false;end if;
 if provider_key is not null then
  update private.email_outbox set state='accepted',provider_id=provider_key,invite_token=null,lease=null,last_reason=null where id=job_key;
  for event_row in select * from private.email_events where provider_id=provider_key order by event_time,id loop perform private.record_email_event(event_row.id,event_row.provider_id,event_row.event_type,event_row.event_time);end loop;
 elsif retry_delay is not null and job.attempts<6 and job.created_at>now()-interval '1 hour' then
  update private.email_outbox set state='retrying',next_attempt=now()+least(900,greatest(30,retry_delay))*interval '1 second',lease=null,last_reason='temporary_provider_failure' where id=job_key;
 else
  update private.email_outbox set state='failed',invite_token=null,lease=null,last_reason=case when failure_reason in('provider_rejected','configuration','invalid_payload') then failure_reason else 'delivery_not_confirmed' end where id=job_key;
 end if;
 return true;
end;$$;
create function public.fas_finish_invitation_email(job_key uuid,lease_key uuid,provider_key uuid,retry_delay integer,failure_reason text) returns boolean language sql set search_path='' as $$select private.finish_invitation_email(job_key,lease_key,provider_key,retry_delay,failure_reason);$$;
revoke all on function private.finish_invitation_email(uuid,uuid,uuid,integer,text),public.fas_finish_invitation_email(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.finish_invitation_email(uuid,uuid,uuid,integer,text),public.fas_finish_invitation_email(uuid,uuid,uuid,integer,text) to service_role;
create function private.record_email_event(event_key text,message_key uuid,event_type text,event_time timestamptz) returns boolean language plpgsql security definer set search_path='' as $$declare current private.email_outbox;new_state text;begin
 if event_key is null or char_length(event_key)>200 or event_time>now()+interval '5 minutes' then return false;end if;
 new_state:=case event_type when 'email.delivered' then 'delivered' when 'email.delivery_delayed' then 'delayed' when 'email.bounced' then 'bounced' when 'email.complained' then 'complained' when 'email.failed' then 'failed' when 'email.suppressed' then 'suppressed' end;
 if new_state is null then return true;end if;
 -- Keep only message IDs and event state, never recipients or authentication links.
 insert into private.email_events(id,provider_id,event_type,event_time) values(event_key,message_key,event_type,event_time) on conflict do nothing;
 select * into current from private.email_outbox where provider_id=message_key for update;
 if not found then return true;end if;
 if current.state in('bounced','complained','suppressed','canceled') or (current.last_event_at is not null and current.last_event_at>event_time) then return true;end if;
 if current.state='delivered' and new_state in('delayed','failed') then return true;end if;
 update private.email_outbox set state=new_state,last_event_at=event_time,last_reason=case when new_state in('failed','bounced','complained','suppressed') then new_state else null end where id=current.id;
 return true;
end;$$;
create function public.fas_record_email_event(event_key text,message_key uuid,event_type text,event_time timestamptz) returns boolean language sql set search_path='' as $$select private.record_email_event(event_key,message_key,event_type,event_time);$$;
revoke all on function private.record_email_event(text,uuid,text,timestamptz),public.fas_record_email_event(text,uuid,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function private.record_email_event(text,uuid,text,timestamptz),public.fas_record_email_event(text,uuid,text,timestamptz) to service_role;
create function private.consume_email_worker_token(worker_token text) returns boolean language plpgsql security definer set search_path='' as $$begin delete from private.email_worker_tokens where hash=encode(sha256(convert_to(worker_token,'UTF8')),'hex') and expires_at>now();return found;end;$$;
create function public.fas_consume_email_worker_token(worker_token text) returns boolean language sql set search_path='' as $$select private.consume_email_worker_token(worker_token);$$;
revoke all on function private.consume_email_worker_token(text),public.fas_consume_email_worker_token(text) from public,anon,authenticated,service_role;
grant execute on function private.consume_email_worker_token(text),public.fas_consume_email_worker_token(text) to service_role;
create function private.request_email_worker() returns bigint language plpgsql security definer set search_path='' as $$
declare config private.email_worker_config;token text:=gen_random_uuid()::text||gen_random_uuid()::text;request_id bigint;begin
 update private.email_outbox set state='failed',invite_token=null,lease=null,last_reason='delivery_window_expired' where created_at<now()-interval '1 hour' and state in('queued','retrying','sending');
 delete from private.email_outbox where created_at<now()-interval '30 days' and invite_token is null;
 delete from private.email_events where created_at<now()-interval '7 days';
 delete from private.email_worker_tokens where expires_at<=now();
 select * into config from private.email_worker_config where singleton;
 if config.base_url is null or not config.enabled then return null;end if;
 if not exists(select 1 from private.email_outbox where state in('queued','retrying','sending') and next_attempt<=now()) then return null;end if;
 insert into private.email_worker_tokens values(encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '2 minutes');
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=55000)' into request_id using config.base_url||'/functions/v1/fas-contributor-email',jsonb_build_object('Content-Type','application/json','X-FAS-Mail',token),'{}'::jsonb;
 return request_id;
end;$$;
revoke all on function private.request_email_worker() from public,anon,authenticated;
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') and exists(select 1 from pg_extension where extname='pg_net') then
  perform cron.schedule('fas-transactional-email','* * * * *','select private.request_email_worker();');
 end if;
end;$$;
commit;
