---
name: Blog SEO prerender pattern
description: How blog posts get correct canonical, title, og:image, and article body in raw HTML for crawlers (incl. Facebook link cards)
---

## Cached preview captures

Workflow restarts do not guarantee that a capture of a server-rendered Blog URL shows fresh HTML.

**Why:** Repeated captures retained old listing markup and missing-script errors after the server had restarted with corrected code. A fresh query URL showed the current markup and working interactive page.

**How to apply:** If a capture contradicts current source and HTTP checks, compare the returned HTML and use a unique query parameter to verify freshness before making further code changes. This is distinct from sandbox section-targeting query quirks.

## The problem
Vite SPA serves the same `index.html` for all routes. Blog posts at `/blog/:slug` got:
- Homepage canonical (`https://job-genie.ai/`)
- Homepage title/meta + homepage `og:image` (generic brand image → wrong Facebook link-card image)
- No article body (fetched in useEffect, invisible to non-JS crawlers)

## What serves /blog/:slug in PROD
The api-server artifact.toml `paths = ["/api", "/blog"]` — `/blog` routes to the api-server in both dev and prod. `blog-html.ts` (`app.use("/blog", blogHtmlRouter)`) serves:
- `/blog` (bare) → `router.get("/")` → SPA index.html (blog listing page, client-rendered)
- `/blog/:slug` → `router.get("/:slug")` → checks dist prerendered file first (fast path), else dynamic SSR from DB with correct per-post og:image
This is always correct in prod regardless of whether prerender ran. Note: in dev, hard-refreshing /blog URLs loads the stale dist/public (hashed asset refs may 404); client-side SPA nav is unaffected.

## The fix — prerender must run at deploy-build time (prerender.mjs)
After building static landing pages, the blog section of `main()`:
1. Lists internal posts via `/api/blog?limit=500`, fetches `/api/blog/:slug` per post
2. Renders with `renderBlogPost(data)` + `getBlogPostHeadHtml(data)` from the compiled SSR bundle
3. Writes `dist/public/blog/:slug/index.html` with per-post meta (incl. `og:image = featuredImageUrl`) + React-rendered body

**Multi-base API fallback (the key deploy fix):** if `BLOG_PRERENDER_API` is unset, it tries `http://localhost:8080` first (fast for local builds), then falls back to `https://job-genie.ai` (deploy builds where localhost isn't running). Picks the first base whose `/api/blog` returns posts. Before this, the deploy build hit localhost, got nothing, and prerendered ZERO posts → every FB link card showed the generic homepage og:image/title.
**Why:** deploy build has no local api-server; during a deploy the previous prod version is still live and serves the API.

**Strip homepage image tags in the blog loop:** the prerender template is `index.html`, which has a generic `og:image`/`og:image:width|height|alt`/`twitter:image`. The blog loop must strip those (regex `og:image[^"]*` + `twitter:image`) before injecting the per-post head, or the page ends with TWO `og:image` tags and Facebook treats them as a gallery / picks wrong. Do this ONLY in the blog loop — the static-routes loop relies on the template's og:image because `buildHeadHtml` (unlike `getBlogPostHeadHtml`) does NOT emit one.

## Residual limitation (accepted trade-off)
Posts created by the cron AFTER a deploy are NOT prerendered until the next republish, so their FB link card / SEO shows generic OG until then (the api-server dynamic SSR fallback can't rescue them in prod). New content needs a redeploy for SEO anyway. Existing shared FB posts also need a Facebook re-scrape (Sharing Debugger / Graph `scrape=true`) after republish to refresh the cached card.

## Key files
- `artifacts/job-genie/prerender.mjs` — blog section at the bottom of `main()` (multi-base fallback + image-tag strip)
- `artifacts/job-genie/src/entry-server.tsx` — `renderBlogPost`, `getBlogPostHeadHtml` (emits per-post og:image), `buildHeadHtml` (static routes, no og:image)
- `artifacts/api-server/src/routes/blog-html.ts` — SSR route, mounted `/blog` but unreachable in prod (paths=["/api"])
