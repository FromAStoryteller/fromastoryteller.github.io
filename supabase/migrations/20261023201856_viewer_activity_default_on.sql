begin;
-- Preserve every existing account choice; only the absence of a choice defaults on.
alter table private.viewer_activity_settings alter column enabled set default true;
create or replace function private.my_activity_settings() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;result jsonb;begin
 caller:=private.require_operator_session();
 select jsonb_build_object('enabled',enabled,'version',version) into result from private.viewer_activity_settings where owner_id=caller;
 return coalesce(result,jsonb_build_object('enabled',true,'version',0));
end;$$;

create or replace function private.record_content_visit(content_key text,expected_version integer) returns boolean language plpgsql security definer set search_path='' as $$
declare caller uuid;t jsonb;key uuid;begin
 caller:=private.require_operator_session();
 perform pg_advisory_xact_lock(hashtextextended(caller::text,146389896));
 if not private.account_active(caller) then raise exception 'Active account required';end if;
 insert into private.viewer_activity_settings(owner_id) values(caller) on conflict(owner_id) do nothing;
 if not exists(select 1 from private.viewer_activity_settings where owner_id=caller and enabled and version=expected_version) then return false;end if;
 t:=private.viewer_content_target(content_key);if t is null then return false;end if;key:=(t->>'id')::uuid;
 delete from private.viewer_recent_activity where owner_id=caller and visited_at<clock_timestamp()-interval '90 days';
 insert into private.viewer_recent_activity(owner_id,content_id,story_id,file_id) values(caller,key,case when t->>'source'='studio' then key end,case when t->>'source'='file' then key end)
 on conflict(owner_id,content_id) do update set visited_at=clock_timestamp();
 delete from private.viewer_recent_activity where owner_id=caller and content_id in(
 select content_id from private.viewer_recent_activity where owner_id=caller order by visited_at desc,content_id offset 500);
 return true;
end;$$;

notify pgrst,'reload schema';
commit;
