---
name: Loop 1 Content Engine
description: Architecture decisions and operational facts for the Loop 1 Reddit→Claude→AEO pipeline
---

## Core Architecture

Loop 1 runs as a cron job (3 AM daily) inside api-server. Pipeline:
1. Reddit OAuth2 (client credentials, no user auth) → subreddit search → pain points
2. Claude normalises raw text → canonical question + pain_point_tags
3. Claude generates answer (claude-sonnet-4-6) → answerFirstBlock + answerMd (JSON)
4. Claude evaluates quality (same model) → score/10, must be ≥ threshold (default 7.0)
5. Passing answers → content_assets row (channel=web_aeo, status=published)

## Key env vars
- `ADMIN_TOKEN` — set as shared env var; protects /api/admin/* routes
- `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USERNAME` — NOT set yet; without them Reddit ingestion is skipped (logs warning, returns [])
- `LOOP1_CRON` / `LOOP1_MAX_QUESTIONS` / `LOOP1_COST_BUDGET_USD` / `LOOP1_QUALITY_THRESHOLD` / `LOOP1_SUBREDDITS` — all optional with defaults

## Critical build quirk
After editing `lib/db/src/schema/*.ts`, you MUST run:
```
cd lib/db && npx tsc --project tsconfig.json
```
This regenerates `lib/db/dist/` declarations so api-server typecheck sees the new exports.
The `@workspace/db` package has no `build` script — use npx tsc directly.

**Why:** @workspace/db is a composite TS project (emitDeclarationOnly). api-server typecheck resolves its types from the .d.ts output, not source. Stale .d.ts = "Module has no exported member" errors.

## Scheduler
node-cron schedules Loop 1 inside `src/scheduler/index.ts`, started from `src/app.ts` (skipped in NODE_ENV=test).
Manual trigger: POST /api/admin/loops/loop1/run (Bearer ADMIN_TOKEN)
Status: GET /api/admin/loops/status

## Admin corpus UI
React page at /admin/corpus (AdminCorpus.tsx). Stores ADMIN_TOKEN in localStorage.
Features: stats overview, Loop 1 trigger, manual seed (paste text → Claude normalises), questions list with approve/reject, answers list, loop runs history.

## Reddit integration
Without REDDIT_CLIENT_ID/SECRET the ingestion logs a warning and returns []. Manual seeding via /api/admin/corpus/questions (POST) works without Reddit creds. This is the primary seeding path until Reddit creds are added.
