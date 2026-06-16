---
name: AEO Page Architecture
description: How Q&A pages are served for Answer Engine Optimisation
---

## Dual-mode serving

**JSON API:** GET /api/qa/:slug → returns JSON (slug, title, answer_first_block, answer_md, pain_point_tags, quality_score)
**HTML (AEO):** GET /api/qa/:slug with Accept: text/html → returns self-contained HTML with full AEO markup (served from api-server)
**React SPA:** /qa/:slug → QAPage.tsx fetches JSON from /api/qa/:slug, renders with Helmet for OG/JSON-LD

## AEO requirements baked into every Q&A page
- answer_first_block as <h1>-adjacent blockquote (40–60 words, standalone, named subject)
- FAQPage JSON-LD schema (mainEntity → Question/Answer with exact text)
- BreadcrumbList JSON-LD (Home → Job Search FAQ → [title])
- <meta name="description"> from answer_first_block[:160]
- <link rel="canonical"> to canonical URL
- OG + Twitter card tags

## Slug convention
`toSlug(normalisedQuestion)` → lowercase, strip non-alphanum, spaces→hyphens, max 80 chars
Slugs live in contentAssets.payloadJson->>'slug'

## robots.txt
Updated to allow Googlebot, Bingbot, meta-externalagent, facebookexternalhit + Sitemap link.

## HelmetProvider
Added to artifacts/job-genie/src/main.tsx wrapping <App/>. Required for react-helmet-async to inject head tags from QAPage.

## AEO skill
Full rubric + requirements documented at skills/meta-ai-aeo/SKILL.md
