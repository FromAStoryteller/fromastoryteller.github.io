-- Local/DEV use requires an explicitly selected reviewed FAS target.
-- Production use requires the separate approved rollout, a verified current
-- backup and exact project selection. This never removes uploaded content.
begin;
do $$ begin
  if to_regprocedure('public.fas_purge_account_deletion_records()') is null
    or to_regclass('private.account_deletion_jobs') is null then
    raise exception 'The reviewed FAS account lifecycle migration is required';
  end if;
end $$;
create extension if not exists pg_cron;
select cron.schedule('fas-account-lifecycle-retention','*/15 * * * *',
  'select public.fas_purge_account_deletion_records();');
-- Keep only this workflow's Cron history; leave unrelated jobs/history alone.
select cron.schedule('fas-account-lifecycle-cron-history','37 3 * * *',
  $$delete from cron.job_run_details where end_time < now()-interval '7 days'
    and jobid in (select jobid from cron.job where jobname in ('fas-account-lifecycle-retention','fas-account-lifecycle-cron-history'));$$);
commit;
