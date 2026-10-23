begin;
alter table private.viewer_content_actions add column experienced_at timestamptz;
-- Existing acknowledgements have no known completion time. Preserve NULL.
create function private.stamp_viewer_experience() returns trigger language plpgsql set search_path='' as $$
begin
 if not new.experienced then new.experienced_at:=null;
 elsif TG_OP='INSERT' then new.experienced_at:=clock_timestamp();
 elsif not old.experienced then new.experienced_at:=clock_timestamp();
 else new.experienced_at:=old.experienced_at;end if;
 return new;
end;$$;
create trigger viewer_experience_time before insert or update on private.viewer_content_actions for each row execute function private.stamp_viewer_experience();
revoke all on function private.stamp_viewer_experience() from public,anon,authenticated;
create index viewer_actions_experienced on private.viewer_content_actions(owner_id,experienced_at desc,content_id) where experienced;

create table private.viewer_activity_settings(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 version integer not null default 0 check(version>=0),
 updated_at timestamptz not null default clock_timestamp()
);
create table private.viewer_recent_activity(
 owner_id uuid not null references auth.users(id) on delete cascade,
 content_id uuid not null,
 story_id uuid references public.stories(id) on delete cascade,
 file_id uuid references private.file_content(id) on delete cascade,
 visited_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,content_id),
 check(num_nonnulls(story_id,file_id)=1),check(content_id=coalesce(story_id,file_id))
);
create index viewer_recent_order on private.viewer_recent_activity(owner_id,visited_at desc,content_id);
create index viewer_recent_story on private.viewer_recent_activity(story_id) where story_id is not null;
create index viewer_recent_file on private.viewer_recent_activity(file_id) where file_id is not null;
alter table private.viewer_activity_settings enable row level security;
alter table private.viewer_recent_activity enable row level security;
revoke all on private.viewer_activity_settings,private.viewer_recent_activity from public,anon,authenticated;
grant all on private.viewer_activity_settings,private.viewer_recent_activity to service_role;

create function private.my_activity_settings() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;result jsonb;begin
 caller:=private.require_operator_session();
 select jsonb_build_object('enabled',enabled,'version',version) into result from private.viewer_activity_settings where owner_id=caller;
 return coalesce(result,jsonb_build_object('enabled',false,'version',0));
end;$$;
create function private.set_activity_recording(enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;begin
 caller:=private.require_operator_session();if enabled is null then raise exception 'Choose a recording setting';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,146389896));
 if not private.account_active(caller) then raise exception 'Active account required';end if;
 insert into private.viewer_activity_settings(owner_id,enabled,version) values(caller,enabled,1)
 on conflict(owner_id) do update set enabled=excluded.enabled,version=viewer_activity_settings.version+1,updated_at=clock_timestamp();
 return private.my_activity_settings();
end;$$;
create function private.record_content_visit(content_key text,expected_version integer) returns boolean language plpgsql security definer set search_path='' as $$
declare caller uuid;t jsonb;key uuid;begin
 caller:=private.require_operator_session();
 perform pg_advisory_xact_lock(hashtextextended(caller::text,146389896));
 if not private.account_active(caller) then raise exception 'Active account required';end if;
 if not exists(select 1 from private.viewer_activity_settings where owner_id=caller and enabled and version=expected_version) then return false;end if;
 t:=private.viewer_content_target(content_key);if t is null then return false;end if;key:=(t->>'id')::uuid;
 delete from private.viewer_recent_activity where owner_id=caller and visited_at<clock_timestamp()-interval '90 days';
 insert into private.viewer_recent_activity(owner_id,content_id,story_id,file_id) values(caller,key,case when t->>'source'='studio' then key end,case when t->>'source'='file' then key end)
 on conflict(owner_id,content_id) do update set visited_at=clock_timestamp();
 delete from private.viewer_recent_activity where owner_id=caller and content_id in(
 select content_id from private.viewer_recent_activity where owner_id=caller order by visited_at desc,content_id offset 500);
 return true;
end;$$;
create function private.remove_recent_activity(content_key text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;key uuid;begin
 caller:=private.require_operator_session();
 perform pg_advisory_xact_lock(hashtextextended(caller::text,146389896));
 if not private.account_active(caller) then raise exception 'Active account required';end if;
 -- Removal accepts only a content UUID, including currently unavailable work.
 if content_key is not null then
  begin key:=content_key::uuid;exception when invalid_text_representation then raise exception 'Invalid activity item';end;
  delete from private.viewer_recent_activity where owner_id=caller and content_id=key;
 else delete from private.viewer_recent_activity where owner_id=caller;end if;
 insert into private.viewer_activity_settings(owner_id,version) values(caller,1)
 on conflict(owner_id) do update set version=viewer_activity_settings.version+1,updated_at=clock_timestamp();
 return private.my_activity_settings();
end;$$;
create function private.my_content_history(view_key text,before_time timestamptz default null,after_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;items jsonb;cursor jsonb;begin
 caller:=private.require_operator_session();
 if view_key is null or view_key not in ('recent','completed') or (before_time is null)<>(after_id is null) then raise exception 'Invalid history request';end if;
 with records as(
 select content_id,visited_at activity_at,visited_at order_at from private.viewer_recent_activity where owner_id=caller and view_key='recent' and visited_at>clock_timestamp()-interval '90 days'
 union all select content_id,experienced_at,coalesce(experienced_at,'1970-01-01'::timestamptz) from private.viewer_content_actions where owner_id=caller and experienced and view_key='completed'
 ),page as materialized(
 select r.*,t from records r cross join lateral(select private.viewer_content_target(r.content_id::text) t) target
 where t is not null and (before_time is null or r.order_at<before_time or r.order_at=before_time and r.content_id>after_id)
 order by order_at desc,content_id limit 49
 ),limited as(select * from page order by order_at desc,content_id limit 48)
 select coalesce(jsonb_agg(t||jsonb_build_object('activity_at',activity_at) order by order_at desc,content_id),'[]'::jsonb),
 case when(select count(*) from page)>48 then(select jsonb_build_object('activity_at',order_at,'id',content_id) from limited order by order_at asc,content_id desc limit 1) end
 into items,cursor from limited;
 return jsonb_build_object('items',items,'next_cursor',cursor);
end;$$;
create function private.my_activity_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;begin
 caller:=private.require_operator_session();
 return jsonb_build_object('settings',private.my_activity_settings(),'recent_activity',coalesce((select jsonb_agg(to_jsonb(v)-'owner_id' order by visited_at desc,content_id) from private.viewer_recent_activity v where owner_id=caller and visited_at>clock_timestamp()-interval '90 days'),'[]'::jsonb));
end;$$;
create function public.fas_my_activity_settings() returns jsonb language sql security invoker set search_path='' as $$select private.my_activity_settings();$$;
create function public.fas_set_activity_recording(enabled boolean) returns jsonb language sql security invoker set search_path='' as $$select private.set_activity_recording(enabled);$$;
create function public.fas_record_content_visit(content_key text,expected_version integer) returns boolean language sql security invoker set search_path='' as $$select private.record_content_visit(content_key,expected_version);$$;
create function public.fas_remove_recent_activity(content_key text default null) returns jsonb language sql security invoker set search_path='' as $$select private.remove_recent_activity(content_key);$$;
create function public.fas_my_content_history(view_key text,before_time timestamptz default null,after_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.my_content_history(view_key,before_time,after_id);$$;
create function public.fas_my_activity_data() returns jsonb language sql security invoker set search_path='' as $$select private.my_activity_data();$$;
revoke all on function private.my_activity_settings(),private.set_activity_recording(boolean),private.record_content_visit(text,integer),private.remove_recent_activity(text),private.my_content_history(text,timestamptz,uuid),private.my_activity_data(),public.fas_my_activity_settings(),public.fas_set_activity_recording(boolean),public.fas_record_content_visit(text,integer),public.fas_remove_recent_activity(text),public.fas_my_content_history(text,timestamptz,uuid),public.fas_my_activity_data() from public,anon,authenticated;
grant execute on function private.my_activity_settings(),private.set_activity_recording(boolean),private.record_content_visit(text,integer),private.remove_recent_activity(text),private.my_content_history(text,timestamptz,uuid),private.my_activity_data(),public.fas_my_activity_settings(),public.fas_set_activity_recording(boolean),public.fas_record_content_visit(text,integer),public.fas_remove_recent_activity(text),public.fas_my_content_history(text,timestamptz,uuid),public.fas_my_activity_data() to authenticated;
do $$declare definition text;needle text:='''viewer_actions'',';begin
 definition:=pg_get_functiondef('public.fas_account_snapshot(uuid,uuid)'::regprocedure);
 if position(needle in definition)=0 then raise exception 'Account snapshot shape changed';end if;
 execute replace(definition,needle,'''recent_activity'',coalesce((select jsonb_agg(to_jsonb(v)-''owner_id'' order by visited_at desc,content_id) from private.viewer_recent_activity v where owner_id=target_user and visited_at>clock_timestamp()-interval ''90 days''),''[]''::jsonb),''activity_settings'',(select to_jsonb(v)-''owner_id'' from private.viewer_activity_settings v where owner_id=target_user),'||needle);
end;$$;
-- Bounded retention runs through the existing service-only maintenance routine.
create function private.prune_recent_activity() returns void language sql security definer set search_path='' as $$delete from private.viewer_recent_activity where visited_at<clock_timestamp()-interval '90 days';$$;
revoke all on function private.prune_recent_activity() from public,anon,authenticated;
grant execute on function private.prune_recent_activity() to service_role;
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  execute $job$select cron.schedule('fas-recent-activity-retention','17 4 * * *',
   'select private.prune_recent_activity(); delete from cron.job_run_details where end_time<now()-interval ''7 days'' and jobid=(select jobid from cron.job where jobname=''fas-recent-activity-retention'');')$job$;
 end if;
end;$$;
notify pgrst,'reload schema';
commit;
