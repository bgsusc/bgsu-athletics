-- Per-sport access for the shared Supabase project ("BGSU Hockey Dashboard"), which
-- hosts more than one sport. One row = one login may see one sport. Only the project
-- owner manages it, from the SQL Editor; the apps can only ask "which sports am I in?".
--
-- Manage access (SQL Editor):
--   select private.grant_sport('coach@example.edu', 'baseball');
--   select private.revoke_sport('coach@example.edu', 'baseball');
--   select * from private.sport_access_by_email;
-- The login must exist first: Authentication > Users > Add user (or Invite).

create table if not exists private.sport_access (
  user_id  uuid not null references auth.users(id) on delete cascade,
  sport    text not null check (sport in ('hockey','volleyball','baseball')),
  added_at timestamptz not null default now(),
  primary key (user_id, sport)
);
alter table private.sport_access enable row level security;  -- no policies: not readable via the API

create or replace function private.has_sport_access(p_sport text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.sport_access where user_id = auth.uid() and sport = p_sport) $$;
revoke all on function private.has_sport_access(text) from public, anon;
grant execute on function private.has_sport_access(text) to authenticated;

-- The only thing an app can learn: the signed-in user's own sports.
create or replace function public.my_sports()
returns text[] language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(sport order by sport), '{}') from private.sport_access where user_id = auth.uid() $$;
revoke all on function public.my_sports() from public, anon;
grant execute on function public.my_sports() to authenticated;

-- Owner-only helpers (not callable through the API).
create or replace function private.grant_sport(p_email text, p_sport text)
returns text language plpgsql security definer set search_path = ''
as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No login for %; create it under Authentication > Users first', p_email; end if;
  insert into private.sport_access (user_id, sport) values (uid, p_sport) on conflict do nothing;
  return p_email || ' can now see ' || p_sport;
end $$;
create or replace function private.revoke_sport(p_email text, p_sport text)
returns text language plpgsql security definer set search_path = ''
as $$
begin
  delete from private.sport_access sa using auth.users u
   where sa.user_id = u.id and lower(u.email) = lower(trim(p_email)) and sa.sport = p_sport;
  return p_email || ' can no longer see ' || p_sport;
end $$;
revoke all on function private.grant_sport(text,text) from public, anon, authenticated;
revoke all on function private.revoke_sport(text,text) from public, anon, authenticated;

create or replace view private.sport_access_by_email as
  select u.email, sa.sport, sa.added_at from private.sport_access sa join auth.users u on u.id = sa.user_id
  order by u.email, sa.sport;
revoke all on private.sport_access_by_email from public, anon, authenticated;

-- Hockey moves onto the same list with exactly its current coaches. Its tables and
-- policies are untouched: is_approved_coach() now means "has hockey access".
-- private.approved_coaches is kept unchanged as a backup (roll back by restoring the
-- previous function body).
insert into private.sport_access (user_id, sport)
  select user_id, 'hockey' from private.approved_coaches on conflict do nothing;
create or replace function private.is_approved_coach()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_sport_access('hockey') $$;
