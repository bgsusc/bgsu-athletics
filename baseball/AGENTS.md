# Baseball application instructions

- Read HANDOVER.md before editing; update it after meaningful checkpoints.
- Baseball is independent: never import from ../hockey or ../volleyball, never create shared code.
- Never commit .env files, Supabase keys, athlete names, photos or data. Tests use synthetic data only and block external traffic; never automate against a production Supabase project.
- Norms in src/services/scoring/composite.js are placeholder estimates; change them only when the owner asks.
- Feature metadata lives in src/features/<id>/registration.js (literal object only); implementation in feature.js, lazily loaded. Adding a folder adds a sidebar page; no layout edit needed.
- If you add or rename an athlete field, update supabase/schema.sql too; tests/schema.test.js enforces it.
- Required checks from baseball/: npm test; npm run build; BGSU_BROWSER=<chrome> npm run test:demo.
