# Job Genie — AEO/GEO Audit Snapshot

**As of:** June 2026  
**Audited by:** Content engine optimization run (Tasks #5–#6)

---

## 1. Framework & Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 7 + TypeScript, Tailwind CSS v4 |
| Routing | wouter (client-side) + entry-server.tsx (SSR/prerender) |
| Backend | Express 5 (api-server, port 8080) |
| Database | PostgreSQL via Drizzle ORM |
| Schema markup | Schema.org JSON-LD (inline in index.html + SEO.tsx + AEOPage.tsx) |
| SEO metadata | react-helmet-async |
| Monorepo | pnpm workspaces |
| Hosting | Replit (development) → deploy target: .replit.app or custom domain |

---

## 2. Pages Mapped to Appendix D Plan

| Appendix D Page | Route | Status | Template |
|---|---|---|---|
| Cornerstone pillar (100 apps) | `/why-no-responses-after-100-applications` | ✅ Created | AEOPage.tsx |
| Ghost Job Detector | `/ghost-jobs` | ✅ Created | AEOPage.tsx |
| Glossary | `/glossary` | ✅ Created | AEOPage.tsx |
| Mid-career professionals | `/for/mid-career-professionals` | ✅ Created | AEOPage.tsx |
| Senior engineers | `/for/senior-engineers` | ✅ Created | AEOPage.tsx |
| Career changers | `/for/career-changers` | ✅ Created | AEOPage.tsx |
| vs Auto-apply | `/job-genie-vs-auto-apply` | ✅ Created | AEOPage.tsx |
| Home | `/` | ✅ Enhanced | Home.tsx |
| Dynamic Q&A corpus | `/qa/:slug` | ✅ Live (empty corpus) | QAPage.tsx + api-server |

---

## 3. What Existed Pre-Optimization

### Schemas present in index.html (pre-task)
- `Organization` — Job Genie entity node
- `SoftwareApplication` — app metadata
- `FAQPage` — 17 FAQ Q&A pairs (Appendix A)
- `HowTo` — 3-step autopsy process
- `Question` — single AEO question schema

### Content features
- Landing page variant system (`variants.json` + `LandingPage.tsx`)
- FAQ accordion in Home.tsx (17 questions)
- Hero "Application Silence Score" card
- AnimatedCounter stat block
- Comparison table (Job Genie vs LinkedIn/Indeed/ZipRecruiter/Resume Writers)

### SEO.tsx
- Per-route Helmet meta (title, description, canonical, OG, Twitter)
- FAQ schema exported per-page

### What was NOT present
- `<section class="direct-answer">` blocks
- `<section class="llm-summary">` blocks
- AEO landing pages (all 7 Appendix D pages)
- `sitemap.xml`
- `llms.txt`
- `robots.txt` AI-crawler directives
- SSR route registration for AEO pages in `entry-server.tsx`

---

## 4. What Was Fixed (Banned Claims)

The claim **"70–80% of the best roles are filled before they hit job boards"** was an unsupported inflation of 1970s sociological research (Granovetter 1974 — narrow Boston sample). It appeared as a fact-claim across 19 locations and was removed from every crawler-visible surface.

### Files fixed:
| File | Occurrences fixed |
|---|---|
| `artifacts/job-genie/src/pages/Home.tsx` | 11 |
| `artifacts/job-genie/src/data/variants.json` | 3 |
| `artifacts/job-genie/src/components/SEO.tsx` | 4 + 1 default description |
| `artifacts/job-genie/src/entry-server.tsx` | 1 (SSR home description) |
| `artifacts/job-genie/index.html` | 1 (Question schema answer) |
| AnimatedCounter stat | 1 (75% → 30%+ SHRM referral stat) |

### Approved replacement framing:
> "Many mid-to-senior and specialist roles are filled through specialist recruitment agencies before reaching job boards."

### Remaining 70–80% occurrences (intentional — debunking context):
- `Home.tsx:192/205` — FAQ #13 explicitly debunks the myth
- `index.html` FAQ JSON-LD — debunking FAQ answer
- `llms.txt:49` — explicit guardrail note for AI crawlers

---

## 5. What Was Created

### Static files
| File | Purpose |
|---|---|
| `artifacts/job-genie/public/sitemap.xml` | 8 static AEO URLs with priorities |
| `artifacts/job-genie/public/llms.txt` | AI-crawler index: entities, stats, guardrails |
| `artifacts/job-genie/public/robots.txt` | All-crawlers allow + Sitemap directive |

### Source files
| File | Purpose |
|---|---|
| `artifacts/job-genie/src/pages/AEOPage.tsx` | Reusable AEO page template (all 7 pages) |
| `artifacts/job-genie/src/components/AEOPage.tsx` | Re-export for spec path alignment |
| `artifacts/job-genie/src/data/landing-pages.ts` | TypeScript page data (7 pages, typed) |
| `artifacts/job-genie/src/components/SEO.tsx` | Rewritten: banned claims removed |
| `.local/skills/meta-ai-aeo/SKILL.md` | Agent skill: guardrails + brand vocab |

### AEO structural additions to Home.tsx
| Block | Location | Purpose |
|---|---|---|
| `<section className="direct-answer">` | After hero | Featured-snippet target for home AEO question |
| `<section className="llm-summary">` | Before footer | Plain-text summary for AI crawlers |

### Content Engine (T001–T006)
All components already present from prior session — verified:
- DB tables: `questions`, `answers`, `content_assets`, `loop_runs`
- Loop 1 pipeline: Reddit ingest → Claude normalise → answer → quality gate → publish
- Admin UI: `/admin/corpus`
- Public Q&A: `/qa/:slug`

### entry-server.tsx SSR
- All 7 AEO routes added to `AEO_ROUTES` lookup table
- All 7 AEO routes added to `render()` Switch block
- `getRouteHead()` resolves correct per-page metadata for prerendering

---

## 6. Entity Consistency Status

| Term | Status |
|---|---|
| Job Genie | ✅ Consistent across all pages and schemas |
| Application Silence | ✅ Defined in Glossary + FAQ + llms.txt |
| Application Silence Score | ✅ Defined in Glossary + FAQ + schemas |
| Recruiter-Fit Gap | ✅ Defined in Glossary + FAQ + schemas |
| Truth Layer | ✅ Defined in Glossary + FAQ |
| Recruiter-Ready Brief | ✅ Defined in Glossary |
| Ghost jobs | ✅ Dedicated AEO page + FAQ |
| Hidden job market | ✅ FAQ debunking + Glossary page |

---

## 7. Remaining Data Slots (First-Party Metrics Needed)

The following `[INSERT JOB GENIE DATA]` placeholders require first-party measurement data before they can be completed:

| Placeholder | Location | Data needed |
|---|---|---|
| Average Application Silence Score across users | Home.tsx stats section | Pull from database aggregate |
| Median applications-before-first-interview | Home.tsx or FAQ | Internal cohort analysis |
| % of users who improved score after Truth Layer | Case studies / social proof | CRM/conversion data |
| Conversion rate: free Autopsy → paid Truth Layer | Pricing section | Analytics |
| Number of successful placements via specialist recruiters | Social proof section | CRM |
| Current recruiter listing count | AnimatedCounter (300K+) | API: validate vs actual corpus |

---

## 8. Audit Tooling

Run `pnpm run seo:audit` for an automated check covering:
- Structural requirements (H1, title, meta, canonical)
- AEO section requirements (direct-answer, llm-summary, FAQ)
- JSON-LD validity
- Banned claim detection
- Stat citation compliance
- Image alt-text
- Internal link integrity
- TypeScript compilation

See `scripts/seo_audit.mjs` for implementation.
