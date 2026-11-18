# Men's Basketball application instructions

- Read HANDOVER.md before editing; update it after meaningful checkpoints.
- Men's Basketball is independent: never import from another sport's folder, never create shared code.
- Never commit .env files, Supabase keys, athlete names, photos or data. Tests use synthetic data only and block external traffic.
- Norms in src/services/scoring/composite.js are placeholder estimates; change them only when the owner asks.
- If you add or rename an athlete field, update supabase/schema.sql too; tests/schema.test.js enforces it.
- Required checks from mens-basketball/: npm test; npm run build; BGSU_BROWSER=<chrome> npm run test:demo.
