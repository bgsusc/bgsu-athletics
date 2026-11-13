-- BGSU Baseball dashboard tables, hosted in the SHARED Supabase project
-- ("BGSU Hockey Dashboard"). Apply AFTER ../../supabase/shared/001_sport_access.sql.
-- Everything is new and prefixed bb_; no existing (Hockey) object is changed.
-- Access: only logins granted 'baseball' in private.sport_access. Contains no athlete data.

-- ── Athletes: one row per player (columns = baseball/src/services/data/persistence.js DB_FIELDS)
create table if not exists public.bb_athletes (
  id bigint generated always as identity primary key,
  canonical_name text not null,
  display_name text, initials text,
  pos text check (pos in ('P','C','IF','OF')), yr text, age integer, av text,
  name_locked boolean default false, pos_locked boolean default false,
  photo_url text, archived boolean default false,
  broad_jump numeric, broad_jump_date date,
  cmj_height numeric, cmj_height_date date,
  sixty_yard numeric, sixty_yard_date date,
  split_10 numeric, split_10_date date,
  fly_10 numeric, fly_10_date date,
  home_to_first numeric, home_to_first_date date,
  trap_bar_max numeric, trap_bar_max_date date,
  back_squat_max numeric, back_squat_max_date date,
  front_squat_max numeric, front_squat_max_date date,
  bench_max numeric, bench_max_date date,
  med_ball_velo numeric, med_ball_velo_date date,
  peak_power numeric, rsi numeric, asymmetry numeric, ecc_rfd numeric,
  conc_impulse numeric, ecc_impulse numeric, contraction_time numeric,
  composite numeric, tier text, trend jsonb, sources jsonb,
  updated_by text, updated_at timestamptz default now(), created_at timestamptz default now()
);

-- ── VALD force plate (and broad-jump testing) sessions
create table if not exists public.bb_test_sessions (
  id bigint generated always as identity primary key,
  athlete_id bigint references public.bb_athletes(id) on delete set null,
  athlete_name text not null,
  test_date date not null,
  jump_height numeric, takeoff_velocity numeric, peak_power numeric, rsi_mod numeric,
  asymmetry numeric, ecc_rfd numeric, conc_impulse numeric, ecc_impulse numeric,
  contraction_time numeric, conc_impulse_asym numeric, ecc_braking_asym numeric,
  approach_height_inches numeric, approach_height_feet text, approach_vert numeric, standing_reach numeric,
  session_type text, drill_name text, source_file text, created_by text,
  created_at timestamptz default now()
);
create index if not exists bb_test_sessions_athlete_date on public.bb_test_sessions (athlete_id, test_date);

-- ── Dated test results (progress tracking, best-recent values)
create table if not exists public.bb_kpi_history (
  id bigint generated always as identity primary key,
  athlete_id bigint references public.bb_athletes(id) on delete set null,
  athlete_name text not null,
  metric_key text not null,
  test_date date not null,
  value numeric not null,
  source text,
  created_at timestamptz default now()
);

-- ── Trackman pitch-by-pitch rows (only pitches involving a roster athlete are stored;
--    opponent names are blanked by the importer)
create table if not exists public.bb_trackman_pitches (
  id bigint generated always as identity primary key,
  pitch_uid text unique,
  pitch_date date not null,
  pitcher_name text, batter_name text, pitch_type text,
  rel_speed numeric, spin_rate numeric, ivb numeric, hb numeric, extension numeric, rel_height numeric,
  exit_speed numeric, launch_angle numeric, distance numeric, hit_spin numeric,
  source_file text, created_by text, created_at timestamptz default now()
);
create index if not exists bb_trackman_pitches_date on public.bb_trackman_pitches (pitch_date);

-- ── Change history (columns match what the app writes; see Hockey's open audit-log issue)
create table if not exists public.bb_audit_log (
  id bigint generated always as identity primary key,
  changed_at timestamptz default now(),
  changed_by text,
  athlete_id bigint,
  athlete_name text,
  action text,
  changed_fields jsonb
);

-- ── Row-Level Security: logins granted 'baseball' only
do $$
declare t text;
begin
  foreach t in array array['bb_athletes','bb_test_sessions','bb_kpi_history','bb_trackman_pitches','bb_audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy baseball_select on public.%I for select to authenticated using ((select private.has_sport_access(''baseball'')))', t);
    execute format('create policy baseball_insert on public.%I for insert to authenticated with check ((select private.has_sport_access(''baseball'')))', t);
  end loop;
  foreach t in array array['bb_athletes','bb_test_sessions','bb_kpi_history','bb_trackman_pitches'] loop
    execute format('create policy baseball_update on public.%I for update to authenticated using ((select private.has_sport_access(''baseball''))) with check ((select private.has_sport_access(''baseball'')))', t);
  end loop;
  foreach t in array array['bb_athletes','bb_test_sessions','bb_trackman_pitches'] loop
    execute format('create policy baseball_delete on public.%I for delete to authenticated using ((select private.has_sport_access(''baseball'')))', t);
  end loop;
end $$;

-- ── Private photo bucket (separate from Hockey's athlete-photos)
insert into storage.buckets (id, name, public) values ('baseball-photos','baseball-photos', false)
  on conflict (id) do update set public = false;
create policy "Baseball coaches view photos" on storage.objects for select to authenticated
  using (bucket_id = 'baseball-photos' and (select private.has_sport_access('baseball')));
create policy "Baseball coaches upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'baseball-photos' and (select private.has_sport_access('baseball')));
create policy "Baseball coaches delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'baseball-photos' and (select private.has_sport_access('baseball')));

-- Realtime (the app subscribes to athlete changes)
alter publication supabase_realtime add table public.bb_athletes;
