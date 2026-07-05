---
name: Gemini-generated blog hero images
description: Pattern for generating unique per-post hero images server-side via Gemini image model + object storage, replacing static template rotation.
---

Job Genie's Loop-generated blog posts previously alternated between only 2 static brand template PNGs (by post id parity), which read as generic/repetitive to users. Fixed by generating a unique AI image per post server-side at publish time.

**Why:** Backend code cannot call the agent-side `generateImage` sandbox tool — that only exists in the agent's own execution context. For server/runtime image generation (e.g. in a content pipeline route or script), call the Gemini AI integration SDK directly (`@google/genai`, `gemini-2.5-flash-image` model) using `AI_INTEGRATIONS_GEMINI_BASE_URL`/`AI_INTEGRATIONS_GEMINI_API_KEY`, then upload the result to Object Storage and serve it through your own API route.

**How to apply:**
- The `@google/genai` `generateContent` config supports `imageConfig: { aspectRatio: "16:9" }` (etc.) — set this explicitly for hero/banner images, since the default output is a 1:1 square which looks wrong in wide layouts.
- Store generated images in Object Storage under a dedicated prefix (e.g. `blog-hero-images/`) and serve via a app route like `/api/blog-images/:filename` rather than exposing storage URLs directly — keeps the public URL stable even if the storage backend changes.
- When backfilling existing content, make the regeneration script idempotent/re-runnable and filter out already-migrated rows (checking the URL pattern) so re-running after a partial/timeout failure doesn't waste time or API calls re-generating already-done items.
- Static per-post PNG files can exist in `public/` for legacy/manual posts alongside the new dynamic pipeline — check for both patterns when auditing "which posts still use generic images."
- If the brand has established static template styles (e.g. named "dark_teal"/"warm_editorial" photorealistic templates), make the AI prompt explicitly match one of those styles by name/description rather than leaving style open-ended — an unconstrained "modern editorial illustration" prompt drifted into a generic flat-vector infographic look with baked-in text labels/gear icons, which didn't match brand and looked repetitive across posts. Alternate style per post via a deterministic key (e.g. `assetId % 2`) for consistency with any existing fallback-template logic.
- "No readable text" is not reliably honored by the image model on the first instruction alone — repeat the no-text constraint at both the start and end of the prompt to suppress leaked labels/captions.
- Dev and prod can run on entirely separate databases/deployed builds for the same app — a backend fix must be deployed (user must republish) before triggering any admin/backfill endpoint against the live prod URL, or it'll silently run against stale code.
- When re-running a backfill after changing the generation logic itself (not just fixing failures), add a `force` bypass to the "skip already migrated" check — otherwise the idempotency guard prevents ever regenerating already-migrated rows with the corrected prompt.
