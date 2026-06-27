# Content Engine — Loop 1 to Loop 4: Workflow & Functionality

This document describes the four automated content loops that run nightly on the
Job Genie API server, plus the listing scraper that seeds them. Each loop builds on
the output of the previous one. Together they form a continuous pipeline: Reddit pain
points → AI answers → multi-channel content assets → distribution.

---

## Architecture Overview

```
2 AM  Listing Scraper ─────────────────────────────────────┐
                                                            ▼
3 AM  Loop 1 ── Ingest + Normalise + Answer ──────────── questions table
                                                          answers table
                                                          content_assets (web_aeo)
4 AM  Loop 2 ── Multi-Channel Generation ─────────────── content_assets (× 8 per answer)
5 AM  Loop 3 ── Blog SEO Enrichment ──────────────────── content_assets (blog_post, enriched)
6 AM  Loop 4 ── Distribution ─────────────────────────── GEO pages live
                                                          Beehiiv drafts
                                                          Reddit comments
                                                          LinkedIn posts / queue
```

All loops write run records to the `loop_runs` table. All are observable via the admin
corpus dashboard at `/admin/corpus` → **Loop Runs** tab.

---

## Listing Scraper — 2 AM daily

**Purpose:** Scrape Reddit RSS feeds to fill the raw-question queue before Loop 1 runs.
This step has no Claude cost — it only makes HTTP requests.

**Sources scraped (configurable via `LISTING_SCRAPER_URLS`):**
- r/jobs — top posts (year + month)
- r/careerguidance — top posts (year + month)
- r/cscareerquestions — top posts (year)
- r/recruitinghell — top posts (year)
- r/resumes — top posts (year)
- r/jobsearchhacks — top posts (year)

**Deduplication:** Cosine-like token overlap at 0.75 threshold. Exact-duplicate URLs
are also filtered.

**Output:** Raw items queued for Loop 1 to normalise.

**Config env vars:**
| Variable | Default | Effect |
|---|---|---|
| `LISTING_SCRAPER_CRON` | `0 2 * * *` (2 AM) | Schedule |
| `LISTING_SCRAPER_URLS` | See above | Comma-separated list of Reddit RSS URLs |

---

## Loop 1 — Question Ingest, Normalisation & Answering (3 AM)

**Purpose:** Turn raw Reddit posts into clean, deduplicated questions and generate
high-quality AEO answers. The output is the primary corpus that feeds all downstream loops.

### Step 1 — Ingest from Reddit

Loop 1 calls the Reddit integration, searching 5 subreddits
(`jobs`, `jobsearchhacks`, `careerguidance`, `resumes`, `recruitinghell`) using 7
search queries focused on job-search pain points:

- "no response job application ghosted"
- "resume getting ignored ATS"
- "ghost job posting fake listing"
- "hidden job market recruiter"
- "application silence no reply"
- "recruiter ghosted after interview"
- "networking job search not working"

Fetches up to 3× the per-run question limit as raw candidates.

### Step 2 — Normalise via Claude

Each raw Reddit post title/body is passed to Claude (`claude-sonnet-4-6`) via
`normaliseQuestion()`. Claude extracts:
- A clean, canonical question in plain English
- Pain-point tags (e.g. `application_silence`, `ghost_jobs`, `ats`, `recruiter_outreach`)

**Deduplication:** Cosine-like token overlap at 0.85 threshold against all existing
corpus questions. Near-duplicates are silently dropped.

### Step 3 — Answer via Claude

Each new unique question is passed to Claude via `generateAnswer()`. This returns:
- `answerFirstBlock` — the direct, one-paragraph answer (used for GEO snippets and Reddit replies)
- `answerMd` — the full markdown answer (used for blog posts and newsletter content)

### Step 4 — Quality gate

Claude evaluates its own answer via `evaluateAnswer()` against a 7.0/10 quality
score threshold. The evaluation checks for:
- Accuracy and specificity
- Absence of banned claims (the "70–80%" myth, etc.)
- Appropriate length and structure
- Source-backed claims

**Pass (≥7.0):** Answer saved to `answers` table; question marked `answered`; a
`web_aeo` content asset created and published immediately.

**Fail (<7.0):** Question marked `pending_review`. No answer saved. Human can
approve or reject in the admin corpus dashboard.

### Step 5 — Write to DB

On pass:
- `questions` row: status → `answered`
- `answers` row: created with `answerMd`, `answerFirstBlock`, `qualityScore`, `modelUsed`
- `content_assets` row: channel = `web_aeo`, status = `published`, slug derived from question text

### Outputs

| Table | What's written |
|---|---|
| `questions` | Status updated to `answered` or `pending_review` |
| `answers` | Full answer with quality score |
| `content_assets` | `web_aeo` asset with slug, published immediately |
| `loop_runs` | Run record with items processed, cost estimate, status |

### Cost & limits

| Config | Default | Env var |
|---|---|---|
| Schedule | 3 AM daily | `LOOP1_CRON` |
| Max questions per run | 10 | `LOOP1_MAX_QUESTIONS` |
| Cost budget | $2.00/run | `LOOP1_COST_BUDGET_USD` |
| Quality threshold | 7.0 / 10 | `LOOP1_QUALITY_THRESHOLD` |
| Dedup threshold | 0.85 | — |
| Cost model | $3/M input + $15/M output (Claude Sonnet 4) | — |

The cost budget is checked before each question. If the estimated spend reaches the
budget mid-run, the loop stops and logs a warning.

---

## Loop 2 — Multi-Channel Content Generation (4 AM)

**Purpose:** For each new answer from Loop 1, generate publication-ready content
for 4 channels in 2 variants — 8 assets per answer.

**Input:** Answers with no existing Loop 2 assets (`listAnswersNotYetInLoop2`).

### What it generates

**4 channels:**
- `newsletter` — HTML newsletter issue (subject line + body + CTA)
- `blog_post` — long-form blog article in Markdown
- `linkedin` — LinkedIn post (hook + insight + soft CTA, ~250 words)
- `email_nurture` — 3-email drip sequence in JSON format

**2 variants per channel:**
- `standard` — answer-led narrative, builds context then conclusion
- `direct_response` — conclusion first, AEO-optimised, designed to be cited by AI engines

Each of the 2 variants is generated in a single Claude call, producing all 4 channel
formats simultaneously. The two calls run in parallel (2 Claude calls per answer,
concurrent).

### Asset storage

8 `content_assets` rows are written per answer:
- `channel`: one of `newsletter`, `blog_post`, `linkedin`, `email_nurture`
- `variant`: `standard` or `direct_response`
- `payloadJson`: includes the generated content, brand image URLs (dark-teal and warm-editorial styles), question text, pain-point tags, and source URL
- `status`: `published`

Each payload also carries two brand image URLs (one per visual style) so the
publishing step can choose which to use.

### Cost & limits

| Config | Default | Env var |
|---|---|---|
| Schedule | 4 AM daily | `LOOP2_CRON` |
| Max answers per run | 5 | `LOOP2_MAX_ANSWERS` |
| Assets created per run (max) | 40 (5 answers × 8) | — |
| Cost budget | $3.00/run | `LOOP2_COST_BUDGET_USD` |

---

## Loop 3 — Blog SEO Enrichment (5 AM)

**Purpose:** Take `blog_post` assets from Loop 2 that have not yet been published
as SEO-enriched blog posts, and generate their full metadata layer.

**Input:** `blog_post` channel assets with status `published` but no `externalId`
(i.e. not yet processed by Loop 3).

### What it generates per post

Claude (`generateBlogMeta`) produces:
- `slug` — URL-safe slug derived from the question (e.g. `why-am-i-not-hearing-back-from-jobs`)
- `seoTitle` — search-optimised `<title>` tag (60–70 characters)
- `metaDescription` — meta description (120–160 characters)
- `readTimeMinutes` — estimated reading time
- `faqJsonLd` — FAQ schema markup (JSON-LD) for Google rich results, derived from the
  question and answer

These are written back to the `content_assets` row:
- `engagementMetricsJson`: `{ seoTitle, metaDescription, readTimeMinutes, faqJsonLd, featuredImageUrl }`
- `externalId`: the slug (marks the post as enriched and ready to serve)

### How the enriched post becomes live

Once Loop 3 sets the `externalId` (slug), the blog post is:
- Served by `GET /blog/:slug` via the api-server's blog-html route
- Included in the sitemap and `llms.txt`
- Eligible for prerendering via `prerender.mjs` (run manually to bake static HTML with correct OG tags)

### Cost & limits

| Config | Default | Env var |
|---|---|---|
| Schedule | 5 AM daily | `LOOP3_CRON` |
| Max posts per run | 5 | `LOOP3_MAX_POSTS` |
| Cost budget | $1.00/run | `LOOP3_COST_BUDGET_USD` |

---

## Loop 4 — Distribution (6 AM)

**Purpose:** Push content assets to their target distribution channels. Loop 4 has
four independent sub-engines that run sequentially. It uses no Claude calls — cost
is zero.

### Sub-engine 1 — GEO (Generative Engine Optimisation) pages

**Always runs. No credentials required.**

Finds `web_aeo` assets with status `published` and no distribution record, then marks
them as distributed. This makes them immediately live at `/answers/:slug` in the
frontend.

The GEO pages are the primary AEO surface — structured Q&A pages optimised for
citation by ChatGPT, Perplexity, Gemini, and other AI engines.

**Output:** `/answers/:slug` pages live on job-genie.ai.

### Sub-engine 2 — Reddit replies

**Requires credentials. Skips gracefully if not configured.**

Required env vars: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`,
`REDDIT_PASSWORD`

For questions sourced from Reddit (where `sourceUrl` contains `reddit.com`):
1. Extracts the original thread ID from the source URL
2. Authenticates via Reddit OAuth2 (password grant)
3. Posts the `answerFirstBlock` as a comment on the original thread
4. Appends a brief disclosure footer: *"I'm a bot sharing AI-generated job-search intelligence. Job Genie helps candidates escape Application Silence."*
5. Records the Reddit comment ID in `engagementMetricsJson`

**Duplicate guard:** If a `redditCommentId` is already recorded for an answer, it is skipped.

> **Note on Reddit AEO Loop alignment:** The automated Reddit sub-engine posts under
> a bot account. This is separate from — and philosophically different to — the
> Reddit AEO Loop (Station ③), which requires real named humans posting substantive
> original content in their own words. The bot replies seed presence; the human
> participation builds citation credibility. Both can run in parallel.

**Output:** Comments posted to original Reddit threads with source attribution.

### Sub-engine 3 — Email / Newsletter

**Requires credentials. Skips gracefully if not configured.**

Processes `newsletter` channel assets. Two modes:

**Mode A — Beehiiv (preferred):**
Required env var: `BEEHIIV_API_KEY` + `BEEHIIV_PUBLICATION_ID`

Calls `createBeehiivDraft()` to push each newsletter asset as a draft post in Beehiiv.
The draft is ready for human review and one-click send in the Beehiiv dashboard.

> **Current constraint:** Beehiiv's POST/PATCH publication API requires an Enterprise
> plan. The `createBeehiivDraft` call returns 403 on standard plans. Workaround:
> use the admin preview endpoint at `/api/admin/publish/blog/preview/:assetId` to
> render the full HTML, then paste into a Beehiiv HTML block manually.

**Mode B — Resend (fallback):**
Required env vars: `RESEND_API_KEY` + `EMAIL_SUBSCRIBER_LIST` (comma-separated emails)

Builds a branded HTML email and sends directly via Resend API.

**Output:** Beehiiv drafts queued for review, or emails sent directly.

### Sub-engine 4 — LinkedIn

**Auto-posts if credentials are set; queues for manual posting otherwise.**

Processes `linkedin` channel assets.

**With credentials** (`LINKEDIN_ACCESS_TOKEN` + `LINKEDIN_MEMBER_URN`):
Posts via the LinkedIn UGC Posts API (`POST /v2/ugcPosts`) as a public text post.
Records the post ID in `externalId`.

**Without credentials (default):**
Marks the asset with `externalId = "linkedin:queued:{id}"` so it appears in the admin
corpus dashboard → Content tab. Human copies the content and posts manually.

**Output:** LinkedIn posts live or queued in the admin dashboard for manual publishing.

### Loop 4 summary

| Sub-engine | Credential required | Fallback behaviour |
|---|---|---|
| GEO | None | N/A — always runs |
| Reddit | `REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD` | Skips with logged warning |
| Email | `BEEHIIV_API_KEY` or `RESEND_API_KEY` | Skips with logged warning |
| LinkedIn | `LINKEDIN_ACCESS_TOKEN` + `LINKEDIN_MEMBER_URN` | Queues for manual posting |

| Config | Default | Env var |
|---|---|---|
| Schedule | 6 AM daily | `LOOP4_CRON` |
| Max items per channel | 20 | `LOOP4_MAX_ITEMS` |

---

## Data Flow — End to End

```
Reddit (RSS + search)
        │
        ▼
Listing Scraper (2 AM)
  raw post candidates → deduped → raw queue
        │
        ▼
Loop 1 (3 AM)
  Claude: normalise → deduplicate → generate answer → quality gate
  ├── PASS → questions[answered] + answers[] + content_assets[web_aeo, published]
  └── FAIL → questions[pending_review] — awaits human approval in admin dashboard
        │
        ▼
Loop 2 (4 AM)
  Claude: 2 parallel calls (standard + direct_response variants)
  → 8 content_assets per answer (4 channels × 2 variants)
    newsletter × 2, blog_post × 2, linkedin × 2, email_nurture × 2
        │
        ▼
Loop 3 (5 AM)
  Claude: SEO meta for blog_post assets
  → slug, seoTitle, metaDescription, readTimeMinutes, faqJsonLd
  → asset marked enriched (externalId = slug)
  → /blog/:slug becomes live
        │
        ▼
Loop 4 (6 AM)
  GEO      → /answers/:slug live (no credentials needed)
  Reddit   → comment on source thread (if creds)
  Email    → Beehiiv draft OR Resend send (if creds)
  LinkedIn → auto-post OR queued for manual (optional creds)
```

---

## Human Touchpoints

The loops are designed to run fully autonomously, but human review is built in at key
quality gates:

| Touchpoint | Where | When |
|---|---|---|
| Approve questions that failed quality gate | Admin → Questions tab → filter `pending_review` | Whenever the loop flags issues |
| Review and send Beehiiv newsletter drafts | Beehiiv dashboard | After each Loop 4 Email run |
| Manually post queued LinkedIn content | Admin → Content tab → filter `linkedin:queued` | After each Loop 4 run |
| Prerender blog posts for static OG tags | Run `node artifacts/job-genie/prerender.mjs` | After a batch of new blog posts from Loop 3 |
| Monitor loop run health | Admin → Loop Runs tab | Daily sanity check |
| Fix orphaned loop runs (status stuck at `running`) | `UPDATE loop_runs SET status='completed', finished_at=NOW() WHERE id=N` | If a run crashes mid-execution |

---

## Monitoring & Troubleshooting

### Check loop run history

Admin dashboard → `/admin/corpus` → **Loop Runs** tab.

Shows: loop name, started/finished timestamps, items processed, cost estimate, status
(`completed`, `completed_with_errors`, `failed`, `running`).

### Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Loop run stuck as `running` | Server crashed mid-loop | Run SQL: `UPDATE loop_runs SET status='completed', finished_at=NOW() WHERE id=N` |
| Loop 1: all questions fail quality gate | Claude prompt drift or topic too niche | Lower `LOOP1_QUALITY_THRESHOLD` or manually seed better questions |
| Loop 2: zero assets created | No new answers from Loop 1 | Normal if Loop 1 found no new unique questions |
| Loop 3: blog posts not appearing on site | Enrichment ran but prerender not run | Run `node artifacts/job-genie/prerender.mjs` |
| Loop 4 Reddit: skipping | `REDDIT_*` env vars not set | Add credentials or accept the skip |
| Loop 4 Email: 403 from Beehiiv | Standard plan — enterprise required | Use manual preview at `/api/admin/publish/blog/preview/:id` |
| Loop 4 LinkedIn: all queued | No `LINKEDIN_ACCESS_TOKEN` | Post manually from admin Content tab or add token |

### Manual trigger

Any loop can be triggered on demand from the admin dashboard:

Admin → `/admin/corpus` → **Loop Runs** tab → **Trigger Loop** buttons.

Or via API:
```
POST /api/admin/loops/trigger/loop1   (or loop2, loop3, loop4)
Authorization: Bearer <ADMIN_TOKEN>
```

---

## Configuration Reference

All config is in `artifacts/api-server/src/config/engine.ts` and overridable via
environment variables:

| Variable | Default | Description |
|---|---|---|
| `LOOP1_CRON` | `0 3 * * *` | Loop 1 schedule |
| `LOOP1_MAX_QUESTIONS` | `10` | Questions ingested per run |
| `LOOP1_COST_BUDGET_USD` | `2.00` | Hard cost cap for Loop 1 |
| `LOOP1_QUALITY_THRESHOLD` | `7.0` | Min quality score (0–10) to pass |
| `LOOP1_SUBREDDITS` | `jobs,jobsearchhacks,...` | Comma-sep subreddits to mine |
| `LOOP2_CRON` | `0 4 * * *` | Loop 2 schedule |
| `LOOP2_MAX_ANSWERS` | `5` | Answers processed per run (= up to 40 assets) |
| `LOOP2_COST_BUDGET_USD` | `3.00` | Hard cost cap for Loop 2 |
| `LOOP3_CRON` | `0 5 * * *` | Loop 3 schedule |
| `LOOP3_MAX_POSTS` | `5` | Blog posts enriched per run |
| `LOOP3_COST_BUDGET_USD` | `1.00` | Hard cost cap for Loop 3 |
| `LOOP4_CRON` | `0 6 * * *` | Loop 4 schedule |
| `LOOP4_MAX_ITEMS` | `20` | Items distributed per channel per run |
| `LISTING_SCRAPER_CRON` | `0 2 * * *` | Scraper schedule |
| `REDDIT_CLIENT_ID` | — | Loop 4 Reddit: OAuth client ID |
| `REDDIT_CLIENT_SECRET` | — | Loop 4 Reddit: OAuth client secret |
| `REDDIT_USERNAME` | — | Loop 4 Reddit: account username |
| `REDDIT_PASSWORD` | — | Loop 4 Reddit: account password |
| `BEEHIIV_API_KEY` | — | Loop 4 Email: Beehiiv API key |
| `BEEHIIV_PUBLICATION_ID` | — | Loop 4 Email: Beehiiv publication ID |
| `RESEND_API_KEY` | — | Loop 4 Email: Resend fallback key |
| `EMAIL_SUBSCRIBER_LIST` | — | Loop 4 Email: comma-sep emails for Resend |
| `LINKEDIN_ACCESS_TOKEN` | — | Loop 4 LinkedIn: user access token |
| `LINKEDIN_MEMBER_URN` | — | Loop 4 LinkedIn: member URN for ugcPosts |
