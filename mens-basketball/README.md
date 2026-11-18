# BGSU Men's Basketball — S&C Performance Analytics

Independent Vite / vanilla-JS app. It started as a copy of the Baseball app but shares no
code with any other sport at runtime.

## What it tracks
- **Weekly VALD ForceDecks** CMJ jumps: Force Plate page and the Readiness Hub.
- **Jumps:** Approach Jump (approach vertical, inches), Standing Vertical (inches).
- **Speed & conditioning:** 3/4 Court Sprint, Lane Agility (seconds), 1 Mile Run (m:ss).
- **Strength:** Front Squat, Bench Press (1RM, lbs).
- **Positions:** G, F, C (PG, SF, Center, "G/F" etc. are normalised on import).

## Run
```bash
npm ci
npm run dev          # add #demo for synthetic Demo Mode
npm run build
npm test             # unit tests (all synthetic)
BGSU_BROWSER=/path/to/chrome npm run test:demo
```
From the repo root, `npm run dev` serves it at `/mens-basketball/`.

## Configuration
Shares the Hockey Supabase project (`mbb_*` tables). `mens-basketball/.env.local`
(git-ignored) holds that project's URL and anon key for local dev. See HANDOVER.md.
