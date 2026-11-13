# BGSU Baseball — S&C Performance Analytics

Independent Vite / vanilla-JS app for BGSU Baseball. It started as a copy of the Hockey
app (`../hockey`), but shares no code with it at runtime: Hockey, Volleyball and Baseball
stay independent.

## What it tracks
- **Testing:** Broad Jump, Vertical Jump; 60-yd Dash, 10-yd Split, 10-yd Fly, Home to 1st;
  Trap Bar DL, Front Squat, Bench Press (1RM), Med Ball Velo (mph).
- **VALD ForceDecks** CMJ force plate and the Readiness Hub (unchanged from Hockey).
- **Trackman** (replaces Hockey's Firstbeat wearable workload): exit velocity, launch
  angle, distance, hard-hit % (95+ mph), sweet-spot % (8–32°), batted-ball spin; fastball
  velocity, spin, induced vertical / horizontal break, extension, release height.
- **Positions:** P, C, IF, OF (RHP/LHP, SS, 2B, CF, etc. are normalised on import).

## Run
```bash
npm ci
npm run dev          # http://127.0.0.1:5173/  (add #demo for synthetic Demo Mode)
npm run build
npm test             # unit tests (all synthetic; no private reference file needed)
BGSU_BROWSER=/path/to/chrome npm run test:demo   # Demo Mode in a real browser
```
From the repo root, `npm run dev` serves it at `/baseball/` next to the other sports.

## Configuration
`baseball/.env.local` (git-ignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for the
**Baseball** Supabase project only. Without them the app runs demo-only. The database is
created from `supabase/schema.sql` (see HANDOVER.md).
