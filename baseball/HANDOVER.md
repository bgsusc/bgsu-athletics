# Baseball handover

## Origin
Created 2026-11-13 by copying the Hockey app (`hockey/` at main `9b70491`) and converting it.
Hockey's private-original parity tests, extraction tools and reference manifest were not
copied: Baseball has no "original" HTML. Its tests are all synthetic and run in CI.

## What changed from Hockey
- **Positions** P / C / IF / OF (`normPos` maps RHP, SS, CF, etc.). Default for unknown: IF.
- **Metrics** renamed to their real meaning (Hockey reused old names): `broadJump`, `cmjHeight`,
  `sixtyYard`, `split10`, `fly10`, `homeToFirst`, `trapBarMax`, `frontSquatMax`, `benchMax`,
  `medBallVelo`; VALD keys unchanged. Timed tests are lower-is-better everywhere
  (composite, imports, best-recent values, Teambuildr maxes).
- **No wearables:** Firstbeat workload page, ACWR, TRIMP fields and the session_drills loader
  removed. The Firstbeat parser still exists inside `services/import/import.js` but has no
  entry point (tabs removed, files are never routed to it); safe to delete later.
- **Trackman** (`services/trackman/trackman.js`, `features/trackman/`): standard TrackMan CSV
  import (Date, Pitcher, Batter, TaggedPitchType, RelSpeed, SpinRate, InducedVertBreak,
  HorzBreak, Extension, RelHeight, ExitSpeed, Angle, Distance, HitSpinRate, PitchUID).
  "Last, First" names are matched to the roster; only pitches involving a roster athlete
  are saved and opponent names are blanked. Duplicates (PitchUID, else row contents) are
  skipped. Per-athlete metrics are derived at load time, never stored on the athlete row.
  Fastball metrics use Fastball/Four-Seam/Two-Seam/Sinker tags (all pitches if untagged).
  Hard-hit/sweet-spot % need 5+ batted balls.
- **Composite:** same 0–100 method and tiers as Hockey, but graded against each athlete's
  **position** norms; pitchers are scored on pitching Trackman metrics, everyone else on
  hitting. Launch angle, movement, release height, batted-ball spin, asymmetry and RSI are
  shown but not scored. Hockey's "September-only 10-yd sprint" rule is not used.
- **Active roster:** an athlete is active with any data in the last 183 days (force plate,
  Trackman or logged test); Hockey only counted wearable/force-plate sessions.

## Placeholder norms (decision for the coaches)
All ranges in `NORMS` (composite.js) are estimates for a college roster. Tighten them once
real testing/Trackman data exists (e.g. 10th–90th percentile by position).

## Database (not created yet)
`supabase/schema.sql` creates the Baseball project's tables (athletes, test_sessions,
kpi_history, trackman_pitches, audit_log), approved-coach RLS identical to Hockey's, a private
`athlete-photos` bucket and realtime on athletes. `tests/schema.test.js` fails if the app
writes a column the schema lacks. To go live: activate the "BGSU Baseball Dashboard"
Supabase project, run the schema, add coaches to `private.approved_coaches`, set Auth URL
configuration to `https://bgsusc.github.io/bgsu-athletics/baseball/`, and add repo variables
`BASEBALL_SUPABASE_URL` / `BASEBALL_SUPABASE_ANON_KEY`.

## Verified (2026-11-13, Linux, Chromium)
`npm test` 57/57; build OK (large-chunk warning only); `tests/demo-check.js` PASS: 12/12
features render with no errors/NaN, 12 feature scenarios, Trackman hitting/pitching tables,
sparse athletes, CSV import preview/save/duplicate skip, no backend traffic. Root
`tests/pages-check.js` PASS for all three sports under `/bgsu-athletics/`.
Not verified: real Supabase sign-in/RLS (no project yet), real Trackman exports beyond the
standard columns, non-Chrome browsers.
