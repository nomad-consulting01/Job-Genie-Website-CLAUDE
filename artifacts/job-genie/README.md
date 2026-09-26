# Job Genie — Marketing Website

AEO-optimised marketing site for [Job Genie](https://job-genie.ai/), the recruiter-visibility platform that helps job seekers reach the hidden job market.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS v4 + wouter |
| Backend | Express 5 + Node.js 24 built-in `node:sqlite` |
| Routing | Shared path-based proxy via Replit workspace |
| Analytics | Custom SQLite-backed conversion event pipeline |
| Newsletters | Beehiiv API proxy (server-side, key never exposed to client) |

## Quick Start

```bash
# Install all workspace deps
pnpm install

# Start both servers
pnpm --filter @workspace/job-genie run dev      # Frontend → port $PORT
pnpm --filter @workspace/api-server run dev      # API      → port 8080
```

## Required Secrets (Replit Environment Variables)

| Secret | Purpose | Required |
|---|---|---|
| `ADMIN_TOKEN` | Protects all `/api/admin/*` endpoints | Yes |
| `BEEHIIV_API_KEY` | Beehiiv newsletter API key | Optional (graceful degradation) |
| `BEEHIIV_PUBLICATION_ID` | Beehiiv publication ID | Optional (with above) |

Set these via the Replit Secrets panel. The app degrades gracefully when Beehiiv keys are absent (newsletter signups are logged but not forwarded).

## URL Structure

| Path | Component | Notes |
|---|---|---|
| `/` | `Home.tsx` | AEO home page, canonical, indexed |
| `/admin` | `Admin.tsx` | Password-protected admin panel |
| `/:slug` | `LandingPage.tsx` | Landing page slug variants (noindex by default) |

**Landing page slugs** defined in `src/data/variants.json`:

| Slug | Primary Keyword | Traffic Source |
|---|---|---|
| `why-job-applications-go-silent` | why job applications go silent | organic |
| `application-silence-score` | application silence score | email |
| `resume-not-getting-interviews` | resume not getting interviews | paid |
| `recruiter-fit-gap` | recruiter fit gap | linkedin |
| `ghost-jobs` | ghost jobs job boards | social |

## A/B Testing

Experiments are defined in `src/data/experiments.json`. Assignment is:
- **Synchronous** — happens before first render (reads localStorage), zero flicker
- **Persistent** — stored in `localStorage` with key `exp_<experimentId>`
- **Slug-aware** — `getSlugExperiment(slug)` handles per-slug experiments

To add a new experiment:
1. Add an entry to `src/data/experiments.json`
2. Call `getExperiment("your_experiment_id")` in the relevant page component

## Analytics Events

The following events are automatically tracked:

| Event | When |
|---|---|
| `page_view` | On page mount (includes experiment/variant IDs) |
| `scroll_25/50/75/90` | When user scrolls to % of page |
| `time_on_page_30s` / `time_on_page_60s` | After 30 / 60 seconds on page |
| `exit_intent` | Mouse leaves viewport top |
| `faq_open` | FAQ accordion opened |
| `free_autopsy_click` | Any CTA linking to the Autopsy tool |
| `hero_cta_click` | Hero section primary CTA |
| `newsletter_signup_complete` | Successful Beehiiv subscription |

All events include: `visitor_id`, `session_id`, `page_slug`, `experiment_id`, `variant_id`, `device_type`, `browser`, `traffic_source`, UTM params, `referrer`.

## API Endpoints

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `POST` | `/api/events` | Track conversion event |
| `GET` | `/api/metrics` | Site-wide aggregate metrics |
| `GET` | `/api/metrics/:slug` | Per-slug metrics with variant breakdown |
| `POST` | `/api/newsletter` | Beehiiv newsletter proxy |

### Admin (Bearer token required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/metrics` | Protected site metrics |
| `GET` | `/api/admin/optimization-report` | 5-diagnostic optimization report (auto-saves recommendations) |
| `GET` | `/api/admin/variants` | List all DB variants |
| `POST` | `/api/admin/variants` | Create variant |
| `POST` | `/api/admin/variants/:id/activate` | Activate a variant |
| `POST` | `/api/admin/variants/:id/pause` | Pause a variant |
| `GET` | `/api/admin/export/events.csv` | Export all events as CSV |
| `GET` | `/api/admin/export/metrics.csv` | Export slug metrics as CSV |

### Admin Panel

Navigate to `/admin` in the browser. Enter your `ADMIN_TOKEN` when prompted. Token is stored in `localStorage` for the session.

## SEO / AEO

- Full JSON-LD suite injected per page: `Organization`, `SoftwareApplication`, `WebSite`/`WebPage`, `FAQPage`, `HowTo`, `Service`, `Offer`, `BreadcrumbList`
- AEO direct-answer question per page via `aeo_question` field in `variants.json`
- Canonical URLs per slug (all point to `https://job-genie.ai/` by default — change `canonical_url` in `variants.json` to override)
- Landing page slugs are `noindex, nofollow` by default (controlled by `indexing` field)
- Free Autopsy CTAs link to `/free-autopsy` (the branded email signup page).

## Deployment

Deploy via Replit's publish button. The API server and frontend are served as separate artifacts under path-based routing.
