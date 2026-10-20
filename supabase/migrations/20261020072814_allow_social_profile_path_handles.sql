begin;
-- The anchored HTTPS-host pattern rejects authority credentials; @ is valid in profile paths.
create or replace function private.valid_social_links(links jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; names text[]:='{}'; platform text; url text; host text;
begin
 if jsonb_typeof(links)<>'array' or jsonb_array_length(links)>10 then return false;end if;
 for item in select value from jsonb_array_elements(links) loop
  platform:=item->>'platform';url:=item->>'url';
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'url') is distinct from 'string' or platform is null or not platform=any(array['website','instagram','facebook','tiktok','youtube','bluesky','threads','x','linkedin','github','twitch','mastodon'])
   or platform=any(names) or char_length(url)>500 or url!~'^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#]|$)' or url~'[[:space:]]' then return false;end if;
  host:=lower(substring(url from '^https://([^/?#]+)'));host:=regexp_replace(host,'^www\.','');
  if platform not in ('website','mastodon') and not (
   (platform='instagram' and host='instagram.com') or (platform='facebook' and host='facebook.com') or (platform='tiktok' and host='tiktok.com') or
   (platform='youtube' and host in ('youtube.com','youtu.be')) or (platform='bluesky' and host='bsky.app') or (platform='threads' and host in ('threads.net','threads.com')) or
   (platform='x' and host in ('x.com','twitter.com')) or (platform='linkedin' and host='linkedin.com') or (platform='github' and host='github.com') or (platform='twitch' and host='twitch.tv')) then return false;end if;
  names:=array_append(names,platform);
 end loop;return true;
end;$$;
commit;
