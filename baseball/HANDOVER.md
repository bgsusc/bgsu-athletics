# Baseball handover

## Origin
Created 2026-11-13 by copying the Hockey app (`hockey/` at main `9b70491`) and converting it.
Hockey's private-original parity tests, extraction tools and reference manifest were not
copied: Baseball has no "original" HTML. Its tests are all synthetic and run in CI.

## What changed from Hockey
- **Positions** P / C / IF / OF (`normPos` maps RHP, SS, CF, etc.). Default for unknown: IF.
- **Metrics** renamed to their real meaning (Hockey reused old names): `broadJump`, `cmjHeight`,
  `sixtyYard`, `split10`, `fly10`, `homeToFirst`, `trapBarMax`, `backSquatMax`, `frontSquatMax`, `benchMax`,
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

## Database: shared Supabase project (free plan)
The org's Free plan allows two active projects, so Baseball lives in the **"BGSU Hockey
Dashboard"** project instead of its own. Isolation:
- Baseball tables are `bb_*` (`bb_athletes`, `bb_test_sessions`, `bb_kpi_history`,
  `bb_trackman_pitches`, `bb_audit_log`) and photos use the private `baseball-photos` bucket.
  `src/services/data/shared-project.js` maps the app's plain table names onto these on the
  real client only, and throws on any other table, so Baseball cannot touch Hockey data.
- Per-sport access: `private.sport_access` (repo `supabase/shared/001_sport_access.sql`).
  Every Baseball policy checks `private.has_sport_access('baseball')`. At sign-in the app
  calls `public.my_sports()` and signs out logins without Baseball access, with a message.
- Apply order: `supabase/shared/001_sport_access.sql`, then `baseball/supabase/schema.sql`.
- Manage access in the SQL Editor: `select private.grant_sport('coach@…','baseball');`,
  `private.revoke_sport(...)`, `select * from private.sport_access_by_email;`.
- Deploy: repo variables `BASEBALL_SUPABASE_URL` / `BASEBALL_SUPABASE_ANON_KEY` hold the
  SAME values as Hockey's. Auth > URL Configuration of that project must also allow
  `https://bgsusc.github.io/bgsu-athletics/baseball/` (keep Hockey's entries).
`tests/schema.test.js` fails if the app writes a column the schema lacks or a policy
stops checking Baseball access; `tests/shared-project.test.js` covers the name mapping and
the no-access sign-out.

## Verified (2026-11-13, Linux, Chromium)
`npm test` 63/63; build OK (large-chunk warning only); `tests/demo-check.js` PASS: 12/12
features render with no errors/NaN, 12 feature scenarios, Trackman hitting/pitching tables,
sparse athletes, CSV import preview/save/duplicate skip, no backend traffic. Root
`tests/pages-check.js` PASS for all three sports under `/bgsu-athletics/`.
Not verified: real Supabase sign-in/RLS (no project yet), real Trackman exports beyond the
standard columns, non-Chrome browsers.
