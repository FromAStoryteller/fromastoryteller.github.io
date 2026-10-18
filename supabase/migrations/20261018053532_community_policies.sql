begin;
-- Existing jobs retain their rendering version, including retries after rollout.
alter table private.email_outbox add column template_version smallint not null default 1 check(template_version in (1,2));
alter table private.email_outbox alter column template_version set default 2;
create or replace function private.claim_invitation_email(job_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare job private.email_outbox;invite public.invites;begin
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
  return jsonb_build_object('id',job.id,'recipient',job.recipient,'token',job.invite_token,'expires_at',job.expires_at,'lease',job.lease,'attempts',job.attempts,'created_at',job.created_at,'template_version',job.template_version);
 end loop;
 return null;
end;$$;
CREATE OR REPLACE FUNCTION private.accept_contributor_invitation(invite_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare invite public.invites; caller uuid; verified_email text;
begin
 caller:=private.require_operator_session();
 if not private.current_policies_accepted(caller) then raise exception 'Review the current account and contributor policies'; end if;
 if invite_token is null or char_length(invite_token)<>72 then raise exception 'Invite unavailable'; end if;
 select lower(email) into verified_email from auth.users where id=caller;
 select * into invite from public.invites where token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex') for update;
 if not found or invite.email<>verified_email or invite.expires_at<=now() or invite.accepted_at is not null or invite.revoked_at is not null then raise exception 'Invite unavailable'; end if;
 insert into public.user_roles(user_id,role) values(caller,'member') on conflict do nothing;
 update public.invites set accepted_by=caller,accepted_at=now() where id=invite.id;
 insert into private.admin_audit(actor_id,action,subject_id,reason) values(caller,'invite_accepted',invite.id,'Contributor invitation accepted');
end; $function$
;
revoke all on function private.accept_contributor_invitation(text) from public,anon,authenticated;
grant execute on function private.accept_contributor_invitation(text) to authenticated;
create or replace function public.accept_invite(invite_token text) returns void
language sql security invoker set search_path='' as $$ select private.accept_contributor_invitation(invite_token); $$;
revoke all on function public.accept_invite(text) from public,anon,authenticated;
grant execute on function public.accept_invite(text) to authenticated;
commit;
