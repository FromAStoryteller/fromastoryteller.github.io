-- Postgres Changes DELETE cannot enforce RLS/filtering. Publish only an
-- unlinkable random primary key for deletion, never room/player identifiers.
-- INSERT/UPDATE data remains protected by the existing session/membership RLS.
begin;
alter table public.game_player_state add column event_id uuid not null default gen_random_uuid();
alter table public.game_player_state drop constraint game_player_state_pkey;
alter table public.game_player_state add primary key(event_id);
alter table public.game_player_state add unique(room_id,player_id);
alter table public.game_player_state replica identity default;
alter table public.game_room_state add column event_id uuid not null default gen_random_uuid();
alter table public.game_room_state drop constraint game_room_state_pkey;
alter table public.game_room_state add primary key(event_id);
alter table public.game_room_state add unique(room_id);
alter table public.game_room_state replica identity default;
notify pgrst,'reload schema';
commit;
