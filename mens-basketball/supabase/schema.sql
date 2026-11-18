-- BGSU Men's Basketball dashboard tables, hosted in the SHARED Supabase project
-- ("BGSU Hockey Dashboard"). Apply AFTER ../../supabase/shared/002_add_mens_basketball.sql.
-- Everything is new and prefixed mbb_; no existing Hockey or Baseball object is changed.
-- Access: only logins granted 'mens_basketball' in private.sport_access. Contains no athlete data.

-- ── Athletes: one row per player (columns = mens-basketball/src/services/data/persistence.js DB_FIELDS)
create table if not exists public.mbb_athletes (
  id bigint generated always as identity primary key,
  canonical_name text not null,
  display_name text, initials text,
  pos text check (pos in ('G','F','C')), yr text, age integer, av text,
  name_locked boolean default false, pos_locked boolean default false,
  photo_url text, archived boolean default false,
  approach_jump numeric, approach_jump_date date,
  cmj_height numeric, cmj_height_date date,
  court_sprint numeric, court_sprint_date date,
  lane_agility numeric, lane_agility_date date,
  mile_run numeric, mile_run_date date,
  front_squat_max numeric, front_squat_max_date date,
  bench_max numeric, bench_max_date date,
  peak_power numeric, rsi numeric, asymmetry numeric, ecc_rfd numeric,
  conc_impulse numeric, ecc_impulse numeric, contraction_time numeric,
  composite numeric, tier text, trend jsonb, sources jsonb,
  updated_by text, updated_at timestamptz default now(), created_at timestamptz default now()
);

-- ── VALD force plate (and approach-jump testing) sessions
create table if not exists public.mbb_test_sessions (
  id bigint generated always as identity primary key,
  athlete_id bigint references public.mbb_athletes(id) on delete set null,
  athlete_name text not null,
  test_date date not null,
  jump_height numeric, takeoff_velocity numeric, peak_power numeric, rsi_mod numeric,
  asymmetry numeric, ecc_rfd numeric, conc_impulse numeric, ecc_impulse numeric,
  contraction_time numeric, conc_impulse_asym numeric, ecc_braking_asym numeric,
  approach_height_inches numeric, approach_height_feet text, approach_vert numeric, standing_reach numeric,
  session_type text, drill_name text, source_file text, created_by text,
  created_at timestamptz default now()
);
create index if not exists mbb_test_sessions_athlete_date on public.mbb_test_sessions (athlete_id, test_date);

-- ── Dated test results (progress tracking, best-recent values)
create table if not exists public.mbb_kpi_history (
  id bigint generated always as identity primary key,
  athlete_id bigint references public.mbb_athletes(id) on delete set null,
  athlete_name text not null,
  metric_key text not null,
  test_date date not null,
  value numeric not null,
  source text,
  created_at timestamptz default now()
);

-- ── Change history (columns match what the app writes; see Hockey's open audit-log issue)
create table if not exists public.mbb_audit_log (
  id bigint generated always as identity primary key,
  changed_at timestamptz default now(),
  changed_by text,
  athlete_id bigint,
  athlete_name text,
  action text,
  changed_fields jsonb
);

-- ── Row-Level Security: logins granted 'mens_basketball' only
do $$
declare t text;
begin
  foreach t in array array['mbb_athletes','mbb_test_sessions','mbb_kpi_history','mbb_audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy mbb_select on public.%I for select to authenticated using ((select private.has_sport_access(''mens_basketball'')))', t);
    execute format('create policy mbb_insert on public.%I for insert to authenticated with check ((select private.has_sport_access(''mens_basketball'')))', t);
  end loop;
  foreach t in array array['mbb_athletes','mbb_test_sessions','mbb_kpi_history'] loop
    execute format('create policy mbb_update on public.%I for update to authenticated using ((select private.has_sport_access(''mens_basketball''))) with check ((select private.has_sport_access(''mens_basketball'')))', t);
  end loop;
  foreach t in array array['mbb_athletes','mbb_test_sessions'] loop
    execute format('create policy mbb_delete on public.%I for delete to authenticated using ((select private.has_sport_access(''mens_basketball'')))', t);
  end loop;
end $$;

-- ── Private photo bucket (separate from Hockey's and Baseball's)
insert into storage.buckets (id, name, public) values ('mens-basketball-photos','mens-basketball-photos', false)
  on conflict (id) do update set public = false;
create policy "Men’s Basketball coaches view photos" on storage.objects for select to authenticated
  using (bucket_id = 'mens-basketball-photos' and (select private.has_sport_access('mens_basketball')));
create policy "Men’s Basketball coaches upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'mens-basketball-photos' and (select private.has_sport_access('mens_basketball')));
create policy "Men’s Basketball coaches delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'mens-basketball-photos' and (select private.has_sport_access('mens_basketball')));

-- Realtime (the app subscribes to athlete changes)
alter publication supabase_realtime add table public.mbb_athletes;
