---
name: GCP GAESA cookie forces Cache-Control private
description: Replit's GCP load balancer injects a GAESA session-affinity Set-Cookie on every API response, which forces Cache-Control: private and breaks Facebook's og:image crawler.
---

## The Rule
Never serve og:images through `job-genie.ai` URLs for Facebook/social crawlers. GCP's load balancer injects `Set-Cookie: GAESA=...` on **all** responses — API routes AND static files — forcing `Cache-Control: private` on everything. Facebook's OG crawler refuses `private` images.

**Why:**
- `makePublic()` blocked by bucket-level public access prevention
- `getSignedUrl()` fails (sidecar credential has no `client_email`)
- Static files in `dist/public/` ALSO get GAESA → `Cache-Control: private` (not just Express routes)
- No GCS or local workaround is possible; a different CDN domain is required

**Fix: wsrv.nl image proxy (Cloudflare-backed)**
Use `https://wsrv.nl/?url=<url-without-protocol>` as the og:image URL. wsrv.nl fetches from our API once, caches it, and re-serves with `Cache-Control: public` + no cookie + `access-control-allow-origin: *` — perfect for Facebook's OG crawler.

**How to apply:**
- `generateBlogHeroImage` in `blogImages.ts` returns a wsrv.nl URL for new images (so it's stored in DB from creation)
- Blog route in `blog.ts` applies `toWsrvOgImageUrl()` to rewrite legacy `/api/blog-images/` URLs on the fly for any post served dynamically
- `prerender.mjs` applies `toWsrvOgImageUrl()` for prerendered posts (covers the static HTML og:image tags)
- The `/api/blog-images/*` streaming route still works for in-app image display (browser fetches, not OG crawlers)
