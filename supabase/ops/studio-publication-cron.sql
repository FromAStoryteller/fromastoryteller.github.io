-- Run only after installing storyteller_studio_publishing in the chosen FAS
-- environment. Does not replace an existing differently configured job.
do $$ begin
 if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'Enable the Supabase Cron extension first';end if;
 if exists(select 1 from cron.job where jobname='fas-community-publication' and (schedule<>'* * * * *' or command<>'select private.publish_due_content();')) then raise exception 'Review existing FAS publication job before changing it';end if;
 if not exists(select 1 from cron.job where jobname='fas-community-publication') then
  perform cron.schedule('fas-community-publication','* * * * *','select private.publish_due_content();');
 end if;
end;$$;
