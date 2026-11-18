-- Allow 'mens_basketball' in the per-sport access list (shared Supabase project).
-- Apply before mens-basketball/supabase/schema.sql. Changes nothing else.
alter table private.sport_access drop constraint if exists sport_access_sport_check;
alter table private.sport_access add constraint sport_access_sport_check
  check (sport in ('hockey','volleyball','baseball','mens_basketball'));
