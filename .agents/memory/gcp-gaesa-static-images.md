---
name: GCP GAESA cookie forces Cache-Control private
description: Replit's GCP load balancer injects a GAESA session-affinity Set-Cookie on every API response, which forces Cache-Control: private and breaks Facebook's og:image crawler.
---

## The Rule
Never rely on `/api/blog-images/*` responses being publicly cacheable in production. Any image that needs to be scraped by Facebook/Twitter must be served as a static file from `dist/public/`, not through Express.

**Why:** Replit's autoscale deployment runs behind GCP's load balancer, which injects `Set-Cookie: GAESA=...` (session affinity cookie) on all responses. When a response has Set-Cookie, CDNs and Facebook's crawler treat it as user-specific and downgrade any `Cache-Control: public` to `Cache-Control: private`. Facebook's OG image crawler refuses `private` images.

`makePublic()` is also blocked on the GCS bucket (public access prevention enforced) and `getSignedUrl()` fails (sidecar credential has no `client_email` for signing). Neither GCS workaround is available.

**How to apply:**
- In `prerender.mjs`, the `downloadHeroImageAsStatic()` function fetches each post's hero image from `http://localhost:8080/api/blog-images/<filename>` during the build, saves it to `dist/public/blog-images/<filename>`, and rewrites `postData.post.featuredImageUrl` to `https://www.job-genie.ai/blog-images/<filename>` before calling `getBlogPostHeadHtml()`.
- Static files in `dist/public/` bypass Express entirely — no GCP proxy, no cookie, no `private` override.
- This runs at every build, so new posts get their image saved on the next deploy.
- The `/api/blog-images/*` route still exists for in-app image loading (non-crawler use) — keep it as a streaming route, not a redirect.
