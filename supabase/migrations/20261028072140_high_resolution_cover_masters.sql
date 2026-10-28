begin;
-- Preserve the existing verified-upload/session/ownership boundary. Only the
-- trusted image processor can register dimensions it measured from saved bytes.
create function public.fas_register_verified_cover_v2(target_story uuid,owner_key uuid,session_key uuid,image_path text,image_alt text,master_width integer,master_height integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if master_width is null or master_width not in(1600,2400,3200) or master_height*16<>master_width*9 or master_height is null then raise exception 'Invalid master dimensions';end if;
 result:=public.fas_register_verified_cover(target_story,owner_key,session_key,image_path,image_alt);
 update public.story_assets set pixel_width=master_width,pixel_height=master_height where id=(result->>'id')::uuid;
 return result||jsonb_build_object('pixel_width',master_width,'pixel_height',master_height);
end;$$;
revoke all on function public.fas_register_verified_cover_v2(uuid,uuid,uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.fas_register_verified_cover_v2(uuid,uuid,uuid,text,text,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
