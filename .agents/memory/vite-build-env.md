---
name: Vite build env vars
description: Required env vars for job-genie production build
---

## Required env vars

`vite.config.ts` throws if these are missing:
- `PORT` — the local port number (e.g. `19806`)
- `BASE_PATH` — the URL base path (e.g. `/`)

## Build command
```
PORT=19806 BASE_PATH=/ pnpm --filter @workspace/job-genie run build
```

## Why
The config uses `process.env.PORT` and `process.env.BASE_PATH` to configure the Vite dev server and asset base. They are mandatory — the config throws explicitly rather than silently defaulting.

**Note:** `vite.ssr.config.ts` (used by prerender.mjs internally) does NOT require these vars — it hardcodes `base: "/"` and has no PORT check.
