begin;
-- Requests contain contributor-authored free text, not financial records.
-- Erase it with the account; retain only the separate administrator audit event.
alter table private.content_warning_requests drop constraint content_warning_requests_requester_id_fkey;
alter table private.content_warning_requests add constraint content_warning_requests_requester_id_fkey foreign key(requester_id) references public.profiles(id) on delete cascade;
commit;
