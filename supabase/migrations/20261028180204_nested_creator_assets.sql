begin;
-- Preserve media subfolders without allowing traversal, remote URLs or executable assets.
create or replace function private.valid_interactive_package_v1(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb; names text[]:='{}'; ext text; mime text;
begin
 if p is null then return true;end if;
 if jsonb_typeof(p)<>'object' or (p->>'version') is distinct from '1' or jsonb_typeof(p->'version') is distinct from 'number' or coalesce(p->>'orientation','') not in ('landscape','portrait') or jsonb_typeof(p->'js') is distinct from 'string' or jsonb_typeof(p->'css') is distinct from 'string' or jsonb_typeof(p->'assets') is distinct from 'array' then return false;end if;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('version','orientation','js','css','assets')) or octet_length(p::text)>4194304 or octet_length(p->>'js')>262144 or octet_length(p->>'css')>65536 or jsonb_array_length(p->'assets')>24 then return false;end if;
 for a in select value from jsonb_array_elements(p->'assets') loop
  if jsonb_typeof(a)<>'object' then return false;end if;
  if exists(select 1 from jsonb_object_keys(a) k where k not in ('name','type','data')) or jsonb_typeof(a->'name') is distinct from 'string' or coalesce(a->>'name','')!~'^(?:[A-Za-z0-9][A-Za-z0-9_-]{0,39}/){0,3}[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.[a-zA-Z0-9]{2,4}$' or jsonb_typeof(a->'data') is distinct from 'string' or coalesce(a->>'data','')='' or length(a->>'data')>1398104 or length(a->>'data')%4<>0 or (a->>'data')!~'^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$' or lower(a->>'name')=any(names) then return false;end if;
  ext:=lower(substring(a->>'name' from '\.([^.]+)$'));
  mime:=case ext when 'png' then 'image/png' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg' when 'webp' then 'image/webp' when 'gif' then 'image/gif' when 'mp3' then 'audio/mpeg' when 'ogg' then 'audio/ogg' when 'wav' then 'audio/wav' else null end;
  if mime is null or (a->>'type') is distinct from mime then return false;end if;names:=array_append(names,lower(a->>'name'));
 end loop;return true;
end;$$;
notify pgrst,'reload schema';
commit;
