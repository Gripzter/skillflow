# SkillFlow Handoff

## 4. Match Economy

Match economy is now atomic via `start_match` and `finish_match` Postgres functions called through `match-start` and `match-finish` Edge Functions. Client NEVER writes to `matches` or `profiles` for match-related changes. See `src/lib/matchActions.ts`.

## Support Contact

User-facing support email is `admin@skillflow.gg`.
