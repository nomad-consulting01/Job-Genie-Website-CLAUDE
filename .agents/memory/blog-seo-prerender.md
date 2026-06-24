---
name: Blog SEO prerender pattern
description: How blog posts get correct canonical, title, and article body in raw HTML for crawlers
---

## The problem
Vite SPA serves the same `index.html` for all routes. Blog posts at `/blog/:slug` got:
- Homepage canonical (`https://job-genie.ai/`)
- Homepage title/meta
- No article body (fetched in useEffect, invisible to non-JS crawlers)

## The fix (two-layer)

### Layer 1 — Static prerender at build time (prerender.mjs)
After building static landing pages, the script:
1. Calls `http://localhost:8080/api/blog?limit=500` to list internal posts
2. Calls `/api/blog/:slug` for each post to get full data
3. Uses `renderBlogPost(data)` + `getBlogPostHeadHtml(data)` from the compiled SSR bundle
4. Writes `dist/public/blog/:slug/index.html` with per-post metadata + React-rendered article body

Gracefully skips if the API server is unreachable (cold build).

### Layer 2 — api-server dynamic SSR fallback (`/blog/:slug` route)
For posts added after the last build:
- `artifacts/api-server/src/routes/blog-html.ts` registered at `app.use("/blog", blogHtmlRouter)`
- Checks if prerendered static file exists first (fast path)
- Falls back to: DB fetch → inline markdown→HTML converter → full HTML response
- Embeds `window.__BLOG_POST_DATA__` for React hydration

## Key files
- `artifacts/job-genie/src/entry-server.tsx` — exports `renderBlogPost`, `getBlogPostHeadHtml`, `BlogPostSSRData`
- `artifacts/job-genie/prerender.mjs` — blog section at the bottom of `main()`
- `artifacts/api-server/src/routes/blog-html.ts` — api-server SSR fallback
- `artifacts/api-server/src/app.ts` — `app.use("/blog", blogHtmlRouter)`

**Why:** ReactMarkdown v10 works fine with `renderToString` for SSR.
**How to apply:** When new blog posts are added by the cron, they are served by the api-server SSR fallback until the next `pnpm build`.
