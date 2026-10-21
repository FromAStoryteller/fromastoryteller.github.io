begin;
-- Disabled catalogue entry only: this does not enable Gallery uploads.
insert into public.studio_content_types(id,label,enabled,required_fields,metadata_fields,genre_ids)
 values('gallery','Gallery',false,'{}','[]','{}') on conflict(id) do nothing;

-- Keep the existing ownership/session gates and RPC grants; expose dates only
-- through the private editor, never through the public series projection.
create or replace function private.series_editor(content_key uuid,source_key text,page_after text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare target jsonb;items jsonb;cursor text;begin
 target:=private.series_edit_target(source_key,content_key);
 if page_after is not null and length(page_after)>50 then raise exception 'Invalid series page';end if;
 with page as materialized(
 select i.*,s.scheduled_at,coalesce(s.published_at,f.published_at) published_at,coalesce(s.updated_at,f.updated_at) content_updated_at,i.source||':'||i.id::text key,r.collection_name,r.series_name,r.previous_source,r.previous_id
 from private.series_content_index i left join public.stories s on i.source='studio' and s.id=i.id left join private.file_content f on i.source='file' and f.id=i.id left join private.content_series r on (r.source,r.content_id)=(i.source,i.id)
 where i.status<>'archived' and private.can_edit_studio_content(i.owner_id,i.publishing_identity,auth.uid()) and (target->>'publishing_identity'='fas' and i.publishing_identity='fas' or target->>'publishing_identity'='personal' and i.publishing_identity='personal' and i.owner_id=(target->>'owner_id')::uuid)
 and (page_after is null or i.source||':'||i.id::text>page_after)
 order by i.source||':'||i.id::text limit 101
 ),limited as(select * from page order by key limit 100)
 select coalesce(jsonb_agg(jsonb_build_object('key',key,'id',id,'source',source,'title',title,'type',content_type,'status',status,'scheduled_at',scheduled_at,'published_at',published_at,'updated_at',content_updated_at,'collection_name',coalesce(collection_name,''),'series_name',coalesce(series_name,''),'previous_key',case when previous_id is not null then previous_source||':'||previous_id::text end) order by key),'[]'),
 case when(select count(*) from page)>100 then(select key from limited order by key desc limit 1) end into items,cursor from limited;
 return jsonb_build_object('current',coalesce((select to_jsonb(r) from private.content_series r where (r.source,r.content_id)=(source_key,content_key)),'{}'),'items',items,'next_cursor',cursor);
end;$$;
notify pgrst,'reload schema';
commit;
