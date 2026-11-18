# Men's Basketball handover

## Origin
Created 2026-11-18 by copying the Baseball app (`baseball/` at main `b6dabfd`) and converting it.

## What it tracks
- Positions G / F / C (`normPos` maps PG, SG, SF, PF, Center, "G/F" -> first position). Default for unknown: F.
- Metrics: `approachJump` (approach VERTICAL, in), `cmjHeight` (standing vertical, in), `courtSprint`
  (3/4 court, s), `laneAgility` (s), `mileRun` (stored in seconds, shown m:ss via `fmtMile`),
  `frontSquatMax`, `benchMax` (lbs), plus the VALD force plate keys. Timed tests are lower-is-better.
- Weekly VALD force plate jumps feed the Force Plate page and Readiness Hub (unchanged from Baseball).
- Removed from Baseball: Trackman (page, service, table), lifts other than front squat/bench,
  baseball speed tests.

## Import notes
- Custom CSV headers match by "contains": `cmjHeight` (standing vertical) ignores any column that
  mentions "approach", "max vert" or "running", so it never takes the approach column.
- Mile run accepts `6:15`, `5:59.5` or plain seconds (`parseMileTime`), in Custom CSV,
  single-test, long-term and manual entry (a text field).
- Approach Jump Testing (standing reach / touch height sheet) stores the approach VERTICAL
  (`approach_vert`, else touch height − standing reach), not touch height as Hockey/Baseball do.
- VALD imports add unknown names to the roster (position unset); Roster Setup has
  "Add Athletes From Imported Data" for earlier imports.

## Placeholder norms (decision for the coaches)
All ranges in `NORMS` (composite.js) are estimates for a college men's roster.

## Database: shared Supabase project
Lives in the "BGSU Hockey Dashboard" project with Hockey and Baseball. Tables `mbb_athletes`,
`mbb_test_sessions`, `mbb_kpi_history`, `mbb_audit_log`, private bucket `mens-basketball-photos`;
every policy requires `private.has_sport_access('mens_basketball')`. Apply
`../supabase/shared/002_add_mens_basketball.sql` (adds the sport to the access list) then
`supabase/schema.sql`. Grant access: `select private.grant_sport('coach@…','mens_basketball');`.
Deploy variables `MBB_SUPABASE_URL` / `MBB_SUPABASE_ANON_KEY` = the Hockey project's values;
add `https://bgsusc.github.io/bgsu-athletics/mens-basketball/` to that project's Redirect URLs.

## Verified (2026-11-18, Linux, Chromium)
`npm test` 58/58; `tests/demo-check.js` PASS (11/11 features, 11 feature scenarios, sparse
athletes, no backend traffic). Not verified: real sign-in (database not applied yet), real
VALD/testing exports from the basketball staff.
