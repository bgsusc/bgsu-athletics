# CLAUDE.md

BGSU Athletics dashboards: a portal (repo root) plus four independent Vite /
vanilla-JS apps, `hockey/`, `volleyball/`, `baseball/` and `mens-basketball/`, deployed together to GitHub Pages.

- Live: https://bgsusc.github.io/bgsu-athletics/ (`/hockey/`, `/volleyball/`, `/baseball/`, `/mens-basketball/`; add `#demo` for synthetic Demo Mode)
- Repo: https://github.com/bgsusc/bgsu-athletics (branch `main`)
- Read first: `README.md`, `HANDOVER.md`, `hockey/HANDOVER.md`, `volleyball/HANDOVER.md`, `baseball/HANDOVER.md`, `mens-basketball/HANDOVER.md`

## Rules (never break these)

- Hockey, Volleyball, Baseball and Men's Basketball stay independent. Never share or import code between them.
- Never commit `.env*` files, Supabase keys, athlete names, photos or data
  (`originals/`, `dist/`, `test-results/`, `node_modules/` are git-ignored; keep it that way).
- Never use or ask for a Supabase service-role key. Anon keys are public by design,
  but never print them in chat or logs.
- Do not change scoring math, authentication or Supabase settings/schema unless the
  owner explicitly asks.
- Never force-push or rewrite git history. Roll back with `git revert`.
- Run `npm run test:all` before every push (see "Tests" for what may legitimately fail).

## Commands

```bash
npm run install:all   # npm ci for root and every sport folder
npm run dev           # portal + every sport on one port: http://127.0.0.1:5170/
npm run build         # dist/ (portal) + dist/<sport>/ for each sport
npm run preview       # serve dist/ at http://127.0.0.1:5171/
npm run test:all      # portal tests, build, portal browser checks, every sport's unit tests
node tests/pages-check.js            # built site under /bgsu-athletics/, every demo, all features
npm run test:demo --prefix hockey    # per-sport Demo Mode browser check (same for every sport)
```

Browser tests need Chrome/Chromium: set `BGSU_BROWSER`, `HOCKEY_BROWSER` and
`VOLLEYBALL_BROWSER` to the binary path (defaults are a Windows Chrome path).

## Tests

- Some parity/integrity tests read the private `originals/<sport>.html`, which is not in
  the repo. Without it, each sport has 8 tests failing with `ENOENT ... originals/`. That is
  expected, not a regression. Any other failure is real.
- Because `test:all` chains with `&&`, a Hockey failure stops it before Volleyball runs.
  Without `originals/`, also run `npm test --prefix volleyball`, `npm test --prefix baseball`,
  the CI subset (see the "Unit tests" step in `.github/workflows/deploy-pages.yml`) and
  `node tests/pages-check.js`.
- Baseball and Men's Basketball have no private reference file: all their tests must pass
  everywhere, and CI runs them all.

## Deploys

- Every push to `main` runs `.github/workflows/deploy-pages.yml`: install from lockfiles,
  CI-subset unit tests, write each sport's `.env.production` from repo variables, build,
  secret-string scan, `tests/pages-check.js`, then deploy to GitHub Pages.
- Repo variables (Settings > Secrets and variables > Actions > Variables):
  `HOCKEY_SUPABASE_URL`, `HOCKEY_SUPABASE_ANON_KEY`, `VOLLEYBALL_SUPABASE_URL`,
  `VOLLEYBALL_SUPABASE_ANON_KEY`, plus optional `BASEBALL_SUPABASE_URL` and
  `BASEBALL_SUPABASE_ANON_KEY`, `MBB_SUPABASE_URL`, `MBB_SUPABASE_ANON_KEY`. Without them a sport builds demo-only.
- After pushing, watch the run (`gh run watch`) and confirm the live site and every demo loads.

## Supabase

- Supabase (free plan, 2 active projects): Volleyball has its own project; Hockey's project
  also hosts Baseball (`bb_*` tables, `baseball-photos` bucket) and Men's Basketball (`mbb_*`,
  `mens-basketball-photos`). Who sees which sport is
  `private.sport_access` in that project (see `supabase/shared/001_sport_access.sql`);
  manage it only from the SQL Editor with `private.grant_sport` / `private.revoke_sport`. Local dev reads each sport's
  git-ignored `<sport>/.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Auth > URL Configuration per project must allow the sport's live URL
  (`.../bgsu-athletics/hockey/` or `.../bgsu-athletics/volleyball/`) for sign-in and password reset.
- Known open issue: Hockey's post-save audit write uses columns (`athlete_id`,
  `athlete_name`, `changed_fields`) that the Hockey `audit_log` table does not have; it
  fails silently (non-fatal). Not fixed yet; needs an owner decision.
