---
name: API server path resolution
description: esbuild bundles everything into dist/index.mjs; __dirname in all bundled route files = dist/, not src/routes/
---

## Rule
When resolving project-root-relative paths inside api-server route files, use **3x `../`** from `__dirname`, not 4x.

**Why:** The api-server build (`build.mjs`) uses esbuild with `bundle: true`. All source files (including routes) get bundled into a single `dist/index.mjs`. At runtime, `import.meta.url` and therefore `fileURLToPath(import.meta.url)` point to `dist/index.mjs`, so `__dirname` = `/home/runner/workspace/artifacts/api-server/dist/`.

Going up from `dist/`:
- `../` → `api-server/`
- `../../` → `artifacts/`
- `../../../` → workspace root (`/home/runner/workspace/`) ✓

**How to apply:**
```typescript
// In any api-server/src/routes/*.ts file:
const CONTENT_DIR = path.resolve(__dirname, "../../../content");
// → /home/runner/workspace/content/  ✓

// WRONG (one too many):
const CONTENT_DIR = path.resolve(__dirname, "../../../../content");
// → /home/runner/content/  ✗
```

The existing `blog-html.ts` uses `../../../../job-genie/dist/public` — this resolves to `/home/runner/job-genie/dist/public`, which must be symlinked or mirrored from the actual build at `artifacts/job-genie/dist/public`.
