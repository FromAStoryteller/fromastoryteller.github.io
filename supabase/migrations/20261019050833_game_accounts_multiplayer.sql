begin;
-- Data APIs are narrow, session-checked wrappers; no player credentials reach uploaded code.
create function private.valid_game_schema(s jsonb,depth integer default 0) returns boolean language plpgsql immutable set search_path='' as $$
declare kind text;k text;c jsonb;allowed text[];
begin
 if s is null or jsonb_typeof(s)<>'object' or depth>6 or octet_length(s::text)>8192 then return false;end if;kind:=s->>'type';
 allowed:=case kind when 'object' then array['type','properties','required','additionalProperties'] when 'array' then array['type','items','minItems','maxItems'] when 'string' then array['type','minLength','maxLength'] when 'number' then array['type','minimum','maximum'] when 'integer' then array['type','minimum','maximum'] when 'boolean' then array['type'] when 'null' then array['type'] end;
 if allowed is null or exists(select 1 from jsonb_object_keys(s) x where not x=any(allowed)) then return false;end if;
 if kind='object' then
  if (s->'additionalProperties') is distinct from 'false'::jsonb or jsonb_typeof(s->'properties') is distinct from 'object' then return false;end if;
  if (select count(*) from jsonb_object_keys(s->'properties'))>24 or exists(select 1 from jsonb_object_keys(s->'properties') x where x!~'^[A-Za-z][A-Za-z0-9_]{0,39}$') then return false;end if;
  if s ? 'required' then if jsonb_typeof(s->'required')<>'array' then return false;end if;if exists(select 1 from jsonb_array_elements(s->'required') x where jsonb_typeof(x)<>'string' or not (s->'properties') ? (x#>>'{}')) then return false;end if;end if;
  for c in select value from jsonb_each(s->'properties') loop if not private.valid_game_schema(c,depth+1) then return false;end if;end loop;
 elsif kind='array' then
  if coalesce(s->>'maxItems','')!~'^[0-9]+$' or (s->>'maxItems')::numeric not between 1 and 64 or coalesce(s->>'minItems','0')!~'^[0-9]+$' or coalesce((s->>'minItems')::numeric,0) not between 0 and (s->>'maxItems')::numeric or not private.valid_game_schema(s->'items',depth+1) then return false;end if;
 elsif kind='string' then
  if coalesce(s->>'maxLength','')!~'^[0-9]+$' or (s->>'maxLength')::numeric not between 1 and 2048 or coalesce(s->>'minLength','0')!~'^[0-9]+$' or coalesce((s->>'minLength')::numeric,0) not between 0 and (s->>'maxLength')::numeric then return false;end if;
 elsif kind in ('integer','number') then
  if (s ? 'minimum' and jsonb_typeof(s->'minimum')<>'number') or (s ? 'maximum' and jsonb_typeof(s->'maximum')<>'number') then return false;end if;
  if coalesce((s->>'minimum')::numeric,-1000000000000)<-1000000000000 or coalesce((s->>'maximum')::numeric,1000000000000)>1000000000000 or coalesce((s->>'minimum')::numeric,-1000000000000)>coalesce((s->>'maximum')::numeric,1000000000000) then return false;end if;
 end if;return true;
exception when others then return false;
end;$$;
create function private.game_data_matches(s jsonb,v jsonb,depth integer default 0) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;c jsonb;kind text:=s->>'type';begin
 if depth>6 or v is null then return false;end if;
 if kind='object' then
  if jsonb_typeof(v)<>'object' then return false;end if;
  if exists(select 1 from jsonb_object_keys(v)x where not (s->'properties') ? x) or exists(select 1 from jsonb_array_elements_text(coalesce(s->'required','[]'))x where not v ? x) then return false;end if;
  for k,c in select key,value from jsonb_each(v) loop if not private.game_data_matches(s->'properties'->k,c,depth+1) then return false;end if;end loop;return true;
 elsif kind='array' then
  if jsonb_typeof(v)<>'array' then return false;end if;if jsonb_array_length(v) not between coalesce((s->>'minItems')::int,0) and (s->>'maxItems')::int then return false;end if;
  for c in select value from jsonb_array_elements(v) loop if not private.game_data_matches(s->'items',c,depth+1) then return false;end if;end loop;return true;
 elsif kind='string' then return jsonb_typeof(v)='string' and char_length(v#>>'{}') between coalesce((s->>'minLength')::int,0) and (s->>'maxLength')::int;
 elsif kind in ('number','integer') then if jsonb_typeof(v)<>'number' then return false;end if;return (kind='number' or (v#>>'{}')::numeric=trunc((v#>>'{}')::numeric)) and (v#>>'{}')::numeric between coalesce((s->>'minimum')::numeric,-1000000000000) and coalesce((s->>'maximum')::numeric,1000000000000);
 else return jsonb_typeof(v)=kind;end if;
exception when others then return false;
end;$$;
create function private.valid_game_settings(s jsonb) returns boolean language plpgsql immutable set search_path='' as $$begin
 if s is null then return true;end if;
 if jsonb_typeof(s)<>'object' then return false;end if;
 return not exists(select 1 from jsonb_object_keys(s)x where x not in ('saves','saveVersion','saveSchema','multiplayer')) and jsonb_typeof(s->'saves')='boolean' and jsonb_typeof(s->'saveVersion')='number' and coalesce(s->>'saveVersion','')~'^[0-9]+$' and (s->>'saveVersion')::numeric between 1 and 10000 and coalesce(s->>'multiplayer','') in ('off','casual','realtime') and private.valid_game_schema(s->'saveSchema');
exception when others then return false;end;$$;

create function private.valid_interactive_package_v1(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb; names text[]:='{}'; ext text; mime text;
begin
 if p is null then return true;end if;
 if jsonb_typeof(p)<>'object' or (p->>'version') is distinct from '1' or jsonb_typeof(p->'version') is distinct from 'number' or coalesce(p->>'orientation','') not in ('landscape','portrait') or jsonb_typeof(p->'js') is distinct from 'string' or jsonb_typeof(p->'css') is distinct from 'string' or jsonb_typeof(p->'assets') is distinct from 'array' then return false;end if;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('version','orientation','js','css','assets')) or octet_length(p::text)>4194304 or octet_length(p->>'js')>262144 or octet_length(p->>'css')>65536 or jsonb_array_length(p->'assets')>24 then return false;end if;
 for a in select value from jsonb_array_elements(p->'assets') loop
  if jsonb_typeof(a)<>'object' then return false;end if;
  if exists(select 1 from jsonb_object_keys(a) k where k not in ('name','type','data')) or jsonb_typeof(a->'name') is distinct from 'string' or coalesce(a->>'name','')!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.[a-zA-Z0-9]{2,4}$' or jsonb_typeof(a->'data') is distinct from 'string' or coalesce(a->>'data','')='' or length(a->>'data')>1398104 or length(a->>'data')%4<>0 or (a->>'data')!~'^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$' or lower(a->>'name')=any(names) then return false;end if;
  ext:=lower(substring(a->>'name' from '\.([^.]+)$'));
  mime:=case ext when 'png' then 'image/png' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg' when 'webp' then 'image/webp' when 'gif' then 'image/gif' when 'mp3' then 'audio/mpeg' when 'ogg' then 'audio/ogg' when 'wav' then 'audio/wav' else null end;
  if mime is null or (a->>'type') is distinct from mime then return false;end if;names:=array_append(names,lower(a->>'name'));
 end loop;return true;
end;$$;
create or replace function private.valid_interactive_package(p jsonb) returns boolean language sql immutable set search_path='' as $$select case when p is null then true else private.valid_interactive_package_v1(p-'settings') and coalesce(private.valid_game_settings(p->'settings'),false) end;$$;
create function private.guard_game_options() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.executable_package is not null then
  if new.content_type<>'game' and (coalesce((new.executable_package->'settings'->>'saves')::boolean,false) or coalesce(new.executable_package->'settings'->>'multiplayer','off')<>'off') then raise exception 'Only games use account saves and multiplayer';end if;
  if coalesce(new.executable_package->'settings'->>'multiplayer','off')<>'off' and (new.publishing_identity<>'fas' or not private.can_publish_as_fas(new.author_id)) then raise exception 'Multiplayer games must be published as From A Storyteller';end if;
 end if;return new;end;$$;
create trigger fas_z_game_options before insert or update on public.stories for each row execute function private.guard_game_options();
create table private.game_services_config(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into private.game_services_config values(true,false);
create table private.game_saves(owner_id uuid not null references public.profiles(id) on delete cascade,game_id uuid not null,slot text not null check(slot~'^[a-z0-9][a-z0-9_-]{0,39}$'),schema_version integer not null,payload jsonb not null check(octet_length(payload::text)<=65536),revision bigint not null default 1,updated_at timestamptz not null default now(),primary key(owner_id,game_id,slot));
create table private.game_rooms(id uuid primary key default gen_random_uuid(),game_id uuid not null references public.stories(id) on delete cascade,game_version timestamptz not null,host_id uuid not null references public.profiles(id) on delete cascade,code_hash text not null unique,mode text not null check(mode in ('casual','realtime')),capacity integer not null check(capacity between 2 and 8),created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '2 hours'));
create index game_rooms_expiry on private.game_rooms(expires_at);
create index game_rooms_host on private.game_rooms(host_id);
create table private.game_members(player_id uuid primary key default gen_random_uuid(),room_id uuid not null references private.game_rooms(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,last_seen timestamptz not null default now(),joined_at timestamptz not null default now(),unique(room_id,user_id),unique(player_id,room_id));
create index game_members_user on private.game_members(user_id);
create table private.game_api_limits(owner_id uuid not null references public.profiles(id) on delete cascade,scope text not null,period timestamptz not null,attempts int not null,primary key(owner_id,scope));
create table public.game_player_state(room_id uuid not null,player_id uuid not null,payload jsonb not null default '{}' check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=4096),revision bigint not null default 0,updated_at timestamptz not null default now(),primary key(room_id,player_id),foreign key(player_id,room_id) references private.game_members(player_id,room_id) on delete cascade);
create table public.game_room_state(room_id uuid primary key references private.game_rooms(id) on delete cascade,payload jsonb not null default '{}' check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16384),revision bigint not null default 0,updated_at timestamptz not null default now());
alter table private.game_services_config enable row level security;alter table private.game_saves enable row level security;alter table private.game_rooms enable row level security;alter table private.game_members enable row level security;alter table private.game_api_limits enable row level security;
alter table public.game_player_state enable row level security;alter table public.game_room_state enable row level security;
revoke all on private.game_services_config,private.game_saves,private.game_rooms,private.game_members,private.game_api_limits,public.game_player_state,public.game_room_state from public,anon,authenticated;
grant all on private.game_services_config,private.game_saves,private.game_rooms,private.game_members,private.game_api_limits,public.game_player_state,public.game_room_state to service_role;
create function private.can_read_game_room(room_key uuid) returns boolean language plpgsql stable security definer set search_path='' as $$declare caller uuid;begin
 caller:=private.require_operator_session();
 return private.current_policies_accepted(caller) and exists(select 1 from private.game_services_config where enabled) and exists(select 1 from private.game_rooms r join private.game_members m on m.room_id=r.id join public.stories s on s.id=r.game_id where r.id=room_key and m.user_id=caller and m.last_seen>now()-interval '90 seconds' and r.expires_at>now() and s.status='published' and s.updated_at=r.game_version and private.public_publishing_author(s.author_id,s.publishing_identity) is not null and s.publishing_identity='fas' and coalesce(s.executable_package->'settings'->>'multiplayer','off')=r.mode and exists(select 1 from private.game_members h where h.room_id=r.id and h.user_id=r.host_id and h.last_seen>now()-interval '90 seconds'));
exception when others then return false;end;$$;
create policy game_players_participants on public.game_player_state for select to authenticated using((select private.can_read_game_room(room_id)));
create policy game_state_participants on public.game_room_state for select to authenticated using((select private.can_read_game_room(room_id)));
grant select on public.game_player_state,public.game_room_state to authenticated;
grant execute on function private.can_read_game_room(uuid) to authenticated;
create function private.game_api_rate(caller uuid,scope_key text,window_seconds integer,maximum integer) returns void language plpgsql security definer set search_path='' as $$declare attempts_now int;bucket timestamptz;begin
 bucket:=to_timestamp(floor(extract(epoch from clock_timestamp())/window_seconds)*window_seconds);
 insert into private.game_api_limits(owner_id,scope,period,attempts) values(caller,scope_key,bucket,1) on conflict(owner_id,scope) do update set period=excluded.period,attempts=case when game_api_limits.period=excluded.period then game_api_limits.attempts+1 else 1 end returning attempts into attempts_now;
 if attempts_now>maximum then raise exception 'Too many game requests. Wait briefly and try again';end if;
end;$$;
create function private.leave_game_rooms(caller uuid,except_room uuid default null) returns void language plpgsql security definer set search_path='' as $$begin
 delete from private.game_rooms where host_id=caller and (except_room is null or id<>except_room);
 delete from private.game_members where user_id=caller and (except_room is null or room_id<>except_room);
end;$$;
create function private.game_room_snapshot(room_key uuid,caller uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'mode',r.mode,'capacity',r.capacity,'expiresAt',r.expires_at,'self',(select player_id from private.game_members where room_id=r.id and user_id=caller),'host',(select player_id from private.game_members where room_id=r.id and user_id=r.host_id),'shared',(select jsonb_build_object('data',payload,'revision',revision) from public.game_room_state where room_id=r.id),'players',coalesce((select jsonb_agg(jsonb_build_object('id',m.player_id,'data',p.payload,'revision',p.revision) order by m.joined_at,m.player_id) from private.game_members m join public.game_player_state p using(room_id,player_id) where m.room_id=r.id and m.last_seen>now()-interval '90 seconds'),'[]')) from private.game_rooms r where r.id=room_key;
$$;

create function private.game_api(game_key uuid,expected_game_version timestamptz,action text,params jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;game public.stories;settings jsonb;saved private.game_saves;room private.game_rooms;member private.game_members;slot_key text;expected bigint;code text;room_key uuid;answer jsonb;proposed_payload jsonb;cap integer;
begin
 caller:=private.require_operator_session();
 perform private.game_api_rate(caller,'requests',60,1800);
 if action in ('room.create','room.join') then perform private.game_api_rate(caller,'join',60,10);end if;
 if action='save.put' then perform private.game_api_rate(caller,'save',1,1);end if;
 if action in ('room.player','room.shared') then perform private.game_api_rate(caller,action,1,10);end if;
 if action='room.read' then perform private.game_api_rate(caller,'room.read',1,5);end if;
 begin
  if params is null or jsonb_typeof(params)<>'object' or octet_length(params::text)>70000 then raise exception 'Invalid game request';end if;
  if (params->>'account')::uuid is distinct from caller then raise exception 'Your account changed. Re-enable online game features';end if;
  select * into game from public.stories where id=game_key and content_type='game' and status='published' and executable_package is not null and private.public_publishing_author(author_id,publishing_identity) is not null;
  if not found then raise exception 'This game is not currently published';end if;
  if game.updated_at is distinct from expected_game_version then raise exception 'This game was updated. Reload before using account features';end if;
  settings:=game.executable_package->'settings';
  if action='status' then return jsonb_build_object('signedIn',true,'enabled',exists(select 1 from private.game_services_config where enabled),'policyCurrent',private.current_policies_accepted(caller),'saves',coalesce((settings->>'saves')::boolean,false),'multiplayer',coalesce(settings->>'multiplayer','off'));end if;
  if not exists(select 1 from private.game_services_config where enabled) then raise exception 'Online game features are not active yet';end if;
  if not private.current_policies_accepted(caller) then raise exception 'Review the current account policies before using online game features';end if;
  if action in ('save.get','save.put','save.remove') then
   if not coalesce((settings->>'saves')::boolean,false) then raise exception 'This game does not enable account saves';end if;
   slot_key:=params->>'slot';if slot_key is null or slot_key!~'^[a-z0-9][a-z0-9_-]{0,39}$' then raise exception 'Use a save-slot name up to 40 lowercase characters';end if;
   if action='save.get' then select * into saved from private.game_saves where owner_id=caller and game_id=game_key and slot=slot_key;return case when found then jsonb_build_object('data',saved.payload,'revision',saved.revision,'version',saved.schema_version,'updatedAt',saved.updated_at) else 'null'::jsonb end;end if;
   perform pg_advisory_xact_lock(hashtextextended(caller::text,146389900));
   expected:=(params->>'revision')::bigint;if expected is null or expected<0 then raise exception 'Load the slot first and send its revision';end if;
   select * into saved from private.game_saves where owner_id=caller and game_id=game_key and slot=slot_key for update;
   if coalesce(saved.revision,0)<>expected then raise exception using errcode='P0002',message='Save conflict. Load the newer progress before saving';end if;
   if action='save.remove' then delete from private.game_saves where owner_id=caller and game_id=game_key and slot=slot_key;return jsonb_build_object('deleted',true);end if;
   if (params->>'version')::int is distinct from (settings->>'saveVersion')::int or params->'data' is null or octet_length((params->'data')::text)>65536 or not private.game_data_matches(settings->'saveSchema',params->'data') then raise exception 'Progress does not match this game save schema/version';end if;
   if saved.owner_id is null and (select count(*) from private.game_saves where owner_id=caller and game_id=game_key)>=5 then raise exception 'This game already has five save slots';end if;
   if (select coalesce(sum(octet_length(payload::text)),0) from private.game_saves where owner_id=caller)-coalesce(octet_length(saved.payload::text),0)+octet_length((params->'data')::text)>2097152 then raise exception 'Your account game-save quota is full. Export or remove an old slot';end if;
   insert into private.game_saves(owner_id,game_id,slot,schema_version,payload) values(caller,game_key,slot_key,(settings->>'saveVersion')::int,params->'data') on conflict(owner_id,game_id,slot) do update set schema_version=excluded.schema_version,payload=excluded.payload,revision=game_saves.revision+1,updated_at=clock_timestamp() returning * into saved;
   return jsonb_build_object('data',saved.payload,'revision',saved.revision,'version',saved.schema_version,'updatedAt',saved.updated_at);
  end if;
  if action not in ('room.create','room.join','room.read','room.player','room.shared') then raise exception 'Unsupported game action';end if;
  if coalesce(settings->>'multiplayer','off')='off' or game.publishing_identity<>'fas' then raise exception 'This game does not enable multiplayer';end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text,146389901));
  if action in ('room.create','room.join') then
   if exists(select 1 from private.game_members m join private.game_rooms r on r.id=m.room_id where m.user_id=caller and r.expires_at>now() and m.last_seen>now()-interval '90 seconds' and (action='room.create' or r.code_hash<>encode(sha256(convert_to(upper(coalesce(params->>'code','')),'UTF8')),'hex'))) then raise exception 'Leave your current room before joining or creating another';end if;
   if action='room.create' then
    perform private.leave_game_rooms(caller);
    cap:=(params->>'capacity')::integer;if cap is null or cap not between 2 and 8 then raise exception 'Choose between two and eight players';end if;
    code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
    insert into private.game_rooms(game_id,game_version,host_id,code_hash,mode,capacity) values(game_key,expected_game_version,caller,encode(sha256(convert_to(code,'UTF8')),'hex'),settings->>'multiplayer',cap) returning * into room;
    insert into public.game_room_state(room_id) values(room.id);
   else
    code:=upper(params->>'code');if code is null or code!~'^[A-F0-9]{16}$' then raise exception 'Room unavailable or code incorrect';end if;
    select * into room from private.game_rooms where game_id=game_key and game_version=game.updated_at and code_hash=encode(sha256(convert_to(code,'UTF8')),'hex') and expires_at>now() for update;
    if not found or not exists(select 1 from private.game_members where room_id=room.id and user_id=room.host_id and last_seen>now()-interval '90 seconds') then raise exception 'Room unavailable or code incorrect';end if;
    if not exists(select 1 from private.game_members where room_id=room.id and user_id=caller) and (select count(*) from private.game_members where room_id=room.id and last_seen>now()-interval '90 seconds')>=room.capacity then raise exception 'This room is full';end if;
    delete from private.game_members where user_id=caller and room_id<>room.id;
    delete from private.game_members where room_id=room.id and user_id<>room.host_id and last_seen<=now()-interval '90 seconds';
   end if;
   insert into private.game_members(room_id,user_id) values(room.id,caller) on conflict(room_id,user_id) do update set last_seen=clock_timestamp() returning * into member;
   insert into public.game_player_state(room_id,player_id) values(room.id,member.player_id) on conflict do nothing;
   answer:=private.game_room_snapshot(room.id,caller);if action='room.create' then answer:=answer||jsonb_build_object('code',code);end if;return answer;
  end if;
  room_key:=(params->>'room')::uuid;
  if not private.can_read_game_room(room_key) then raise exception 'Room expired, unavailable or membership ended';end if;
  select * into room from private.game_rooms where id=room_key and game_id=game_key and game_version=game.updated_at;if not found then raise exception 'This room belongs to a different game/version';end if;
  select * into member from private.game_members where room_id=room_key and user_id=caller for update;
  update private.game_members set last_seen=clock_timestamp() where player_id=member.player_id;
  if action='room.read' then return private.game_room_snapshot(room_key,caller);end if;
  expected:=(params->>'revision')::bigint;proposed_payload:=params->'data';
  if expected is null or expected<0 or jsonb_typeof(proposed_payload) is distinct from 'object' then raise exception 'Send object-shaped game state and its current revision';end if;
  if action='room.shared' then
   if room.host_id<>caller then raise exception 'Only the host can change shared game state';end if;
   if octet_length(proposed_payload::text)>16384 then raise exception 'Shared game state exceeds 16 KiB';end if;
   update public.game_room_state set payload=proposed_payload,revision=revision+1,updated_at=clock_timestamp() where room_id=room_key and revision=expected returning jsonb_build_object('data',game_room_state.payload,'revision',game_room_state.revision) into answer;
  else
   if octet_length(proposed_payload::text)>4096 then raise exception 'Player state exceeds 4 KiB';end if;
   update public.game_player_state set payload=proposed_payload,revision=revision+1,updated_at=clock_timestamp() where room_id=room_key and player_id=member.player_id and revision=expected returning jsonb_build_object('data',game_player_state.payload,'revision',game_player_state.revision) into answer;
  end if;
  if answer is null then raise exception using errcode='P0002',message='Game state changed. Refresh before sending another update';end if;return answer;
 exception when others then return jsonb_build_object('error',jsonb_build_object('code',SQLSTATE,'message',case when SQLSTATE in ('P0001','P0002') then SQLERRM else 'The game request was rejected. Refresh and try again' end));end;
end;$$;
create function public.fas_game_api(game_key uuid,game_version timestamptz,action text,params jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.game_api(game_key,game_version,action,params);$$;
create function private.leave_game_room(room_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;begin
 caller:=private.require_operator_session();delete from private.game_rooms where id=room_key and host_id=caller;delete from private.game_members where room_id=room_key and user_id=caller;return jsonb_build_object('left',true);
end;$$;
create function public.fas_leave_game_room(room_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.leave_game_room(room_key);$$;
create function private.my_game_data() returns jsonb language plpgsql stable security definer set search_path='' as $$declare caller uuid;begin
 caller:=private.require_operator_session();return jsonb_build_object('format','fas-game-data-v1','saves',coalesce((select jsonb_agg(jsonb_build_object('game',g.game_id,'title',coalesce(s.title,'Unavailable game'),'slot',g.slot,'version',g.schema_version,'revision',g.revision,'data',g.payload,'updatedAt',g.updated_at) order by g.updated_at desc) from private.game_saves g left join public.stories s on s.id=g.game_id where g.owner_id=caller),'[]'),'participation',coalesce((select jsonb_agg(jsonb_build_object('game',r.game_id,'room',r.id,'player',m.player_id,'data',p.payload,'expiresAt',r.expires_at)) from private.game_members m join private.game_rooms r on r.id=m.room_id join public.game_player_state p using(room_id,player_id) where m.user_id=caller),'[]'));
end;$$;
create function public.fas_my_game_data() returns jsonb language sql stable security invoker set search_path='' as $$select private.my_game_data();$$;
create function private.delete_game_save(game_key uuid,slot_key text,expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;n integer;begin
 caller:=private.require_operator_session();delete from private.game_saves where owner_id=caller and game_id=game_key and slot=slot_key and revision=expected_revision;get diagnostics n=row_count;if n<>1 then raise exception using errcode='P0002',message='Save changed or unavailable. Refresh before removing';end if;return jsonb_build_object('deleted',true);
end;$$;
create function public.fas_delete_game_save(game_key uuid,slot_key text,expected_revision bigint) returns jsonb language sql security invoker set search_path='' as $$select private.delete_game_save(game_key,slot_key,expected_revision);$$;
create function private.purge_expired_game_rooms() returns integer language plpgsql security definer set search_path='' as $$declare n integer;begin
 delete from private.game_rooms r where expires_at<=now() or not exists(select 1 from private.game_members m where m.room_id=r.id and m.user_id=r.host_id and m.last_seen>now()-interval '3 minutes') or not exists(select 1 from public.stories s where s.id=r.game_id and s.status='published' and s.updated_at=r.game_version);get diagnostics n=row_count;return n;
end;$$;
-- Published package reads include their exact version for save/room context binding.
create or replace function private.public_interactive_package(story_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('package',s.executable_package,'version',s.updated_at) from public.stories s where s.slug=story_slug and s.content_type in ('game','tool') and s.status='published' and private.account_active(s.author_id) and private.public_publishing_author(s.author_id,s.publishing_identity) is not null;
$$;

create or replace function public.fas_account_snapshot(target_user uuid, target_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  perform private.require_account_session(target_user,target_session);
  if not private.account_active(target_user) then raise exception 'Account is closing'; end if;
  if (select count(*) from (select 1 from public.stories where author_id=target_user limit 301) s)>300
    or (select coalesce(sum(octet_length(body)+coalesce(octet_length(executable_package::text),0)),0) from public.stories where author_id=target_user)>16777216
    or (select count(*) from (select 1 from public.story_assets a join public.stories s on s.id=a.story_id where s.author_id=target_user limit 501) a)>500
    or (select count(*) from (select 1 from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text limit 501) o)>500 then
    raise exception 'Account content requires background export';
  end if;
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where id = target_user),
    'role', coalesce((select role::text from public.user_roles where user_id = target_user order by case role when 'member' then 0 when 'admin' then 1 else 2 end limit 1),'viewer'),
    'stories', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.stories s where author_id = target_user),'[]'::jsonb),
    'game_saves',coalesce((select jsonb_agg(to_jsonb(g)-'owner_id' order by game_id,slot) from private.game_saves g where owner_id=target_user),'[]'::jsonb),
    'game_participation',coalesce((select jsonb_agg(jsonb_build_object('game',r.game_id,'room',m.room_id,'player',m.player_id,'data',p.payload,'expiresAt',r.expires_at)) from private.game_members m join private.game_rooms r on r.id=m.room_id join public.game_player_state p using(room_id,player_id) where m.user_id=target_user),'[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'approved_by' order by a.id) from public.story_assets a join public.stories s on s.id = a.story_id where s.author_id = target_user),'[]'::jsonb),
    'objects', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'path',o.name,'size',o.metadata->>'size','type',o.metadata->>'mimetype','updated_at',o.updated_at) order by o.name) from storage.objects o where bucket_id = 'fas-story-images' and split_part(name,'/',1) = target_user::text),'[]'::jsonb)
  ) into payload;
  if payload->'profile' = 'null'::jsonb then raise exception 'Account unavailable'; end if;
  return jsonb_build_object('data',payload,'fingerprint',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end; $$;
create or replace function public.fas_begin_account_deletion(target_user uuid, target_session uuid, confirmation_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job private.account_deletion_jobs; paths jsonb;
begin
  -- Short transaction only: no network/Storage calls while these locks are held.
  lock table public.profiles, public.user_roles, public.stories, public.story_assets, public.moderation_log, storage.objects in share row exclusive mode;
  perform private.require_account_session(target_user,target_session);
  perform 1 from auth.users where id=target_user for update;
  perform 1 from public.profiles where id=target_user for update;
  if exists(select 1 from public.user_roles where user_id=target_user and role in ('moderator','admin')) then raise exception 'Staff accounts require a separate reviewed process'; end if;
  if exists(select 1 from public.story_assets a join public.stories s on s.id=a.story_id where a.approved_by=target_user and s.author_id<>target_user) then raise exception 'Prior staff approvals require review'; end if;
  if not exists(select 1 from private.account_deletion_intents where user_id=target_user and session_id=target_session and token_hash=confirmation_hash and expires_at>now()) then raise exception 'Fresh deletion confirmation required'; end if;
  select * into job from private.account_deletion_jobs where user_id=target_user;
  select coalesce(jsonb_agg(name order by name),'[]'::jsonb) into paths from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text;
  if job.user_id is not null then
    update private.account_deletion_jobs set receipt_hash=confirmation_hash,
      object_paths=(select coalesce(jsonb_agg(path order by path),'[]'::jsonb) from (select distinct jsonb_array_elements_text(job.object_paths || paths) as path) p),
      state='pending',completed_at=null where user_id=target_user returning * into job;
  else
    insert into private.account_deletion_jobs(user_id,receipt_hash,object_paths) values(target_user,confirmation_hash,paths) returning * into job;
  end if;
  delete from private.game_saves where owner_id=target_user;
  perform private.leave_game_rooms(target_user);
  delete from public.moderation_log where story_id in (select id from public.stories where author_id=target_user);
  delete from public.stories where author_id=target_user;
  delete from public.invites where accepted_by=target_user or email=(select lower(email) from auth.users where id=target_user);
  return to_jsonb(job);
end; $$;

revoke all on function private.valid_game_schema(jsonb,integer) from public,anon,authenticated;
revoke all on function private.game_data_matches(jsonb,jsonb,integer) from public,anon,authenticated;
revoke all on function private.valid_game_settings(jsonb) from public,anon,authenticated;
revoke all on function private.valid_interactive_package(jsonb) from public,anon,authenticated;
revoke all on function private.guard_game_options() from public,anon,authenticated;
revoke all on function private.can_read_game_room(uuid) from public,anon,authenticated;
revoke all on function private.game_api_rate(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function private.leave_game_rooms(uuid,uuid) from public,anon,authenticated;
revoke all on function private.game_room_snapshot(uuid,uuid) from public,anon,authenticated;
revoke all on function private.game_api(uuid,timestamptz,text,jsonb) from public,anon,authenticated;
revoke all on function public.fas_game_api(uuid,timestamptz,text,jsonb) from public,anon,authenticated;
revoke all on function private.leave_game_room(uuid) from public,anon,authenticated;
revoke all on function public.fas_leave_game_room(uuid) from public,anon,authenticated;
revoke all on function private.my_game_data() from public,anon,authenticated;
revoke all on function public.fas_my_game_data() from public,anon,authenticated;
revoke all on function private.delete_game_save(uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.fas_delete_game_save(uuid,text,bigint) from public,anon,authenticated;
revoke all on function private.purge_expired_game_rooms() from public,anon,authenticated;
revoke all on function private.public_interactive_package(text) from public,anon,authenticated;
revoke all on function public.fas_account_snapshot(uuid,uuid) from public,anon,authenticated;
revoke all on function public.fas_begin_account_deletion(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.valid_interactive_package(jsonb),private.valid_interactive_package_v1(jsonb),private.valid_game_settings(jsonb),private.valid_game_schema(jsonb,integer) to authenticated,service_role;
grant execute on function private.can_read_game_room(uuid),private.game_api(uuid,timestamptz,text,jsonb),private.my_game_data(),private.leave_game_room(uuid),private.delete_game_save(uuid,text,bigint),public.fas_game_api(uuid,timestamptz,text,jsonb),public.fas_my_game_data(),public.fas_leave_game_room(uuid),public.fas_delete_game_save(uuid,text,bigint) to authenticated;
grant execute on function private.purge_expired_game_rooms(),public.fas_account_snapshot(uuid,uuid),public.fas_begin_account_deletion(uuid,uuid,text) to service_role;
grant execute on function private.public_interactive_package(text) to anon,authenticated;
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.game_player_state,public.game_room_state;
 end if;
end;$$;
notify pgrst,'reload schema';
commit;
