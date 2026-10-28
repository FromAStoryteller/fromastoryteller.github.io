begin;
-- Readable metadata only; browser roles cannot mark arbitrary derivatives ready.
alter table public.story_assets add column derivative_widths integer[] not null default '{}'
 check(cardinality(derivative_widths)<=5 and derivative_widths <@ array[480,800,1200,1600,2400]);
grant select(derivative_widths) on public.story_assets to anon,authenticated;
grant update(derivative_widths) on public.story_assets to service_role;
notify pgrst,'reload schema';
commit;
