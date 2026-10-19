-- Install only this feature's cleanup; preserve unrelated jobs.
-- Operational counters expire after one day; no gameplay history is retained.
do $job$begin
 if not exists(select 1 from cron.job where jobname='fas-game-room-cleanup') then
  perform cron.schedule('fas-game-room-cleanup','*/5 * * * *',$command$select private.purge_expired_game_rooms();delete from private.game_api_limits where period<now()-interval '1 day';$command$);
 end if;
end;$job$;
