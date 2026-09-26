# How to Create a New AEO Landing Page

This guide walks through creating a fully AEO/GEO-compliant landing page for Job Genie.

---

## Overview

New landing pages use the shared `AEOPage` template component. All page data lives in `artifacts/job-genie/src/data/landing-pages.ts`. Adding a page is a two-file change:

1. Add an entry to `landing-pages.ts`
2. Add the route to `App.tsx` and `entry-server.tsx`

---

## Step 1: Add the page entry to `landing-pages.ts`

Open `artifacts/job-genie/src/data/landing-pages.ts` and append a new object to the `landingPages` array. Here is the full schema:

```typescript
{
  slug: "your-page-slug",              // URL path segment (no leading slash)
  metaTitle: "...",                    // <title> tag — ≤60 chars, includes "| Job Genie"
  metaDescription: "...",             // <meta description> — 120–160 chars
  canonicalUrl: "https://job-genie.ai/your-page-slug",
  robots: "index, follow",
  primaryQuestion: "...",             // The main question this page answers
  h1: "...",                          // Visible page H1 — can match primaryQuestion
  directAnswer: "...",                // 40–80 words (see §3 below)
  keyTakeaways: [                     // 3–6 bullet points, fact-first
    "...",
    "...",
  ],
  sections: [                         // 2–5 body sections
    {
      heading: "...",
      body: "...",
      list?: ["...", "..."],           // Optional bullet list
      howToSteps?: [                   // Optional HowTo schema steps
        { name: "...", text: "..." },
      ],
      comparisonTable?: {              // Optional comparison table
        headers: ["...", "..."],
        rows: [["...", "..."]],
      },
    },
  ],
  glossaryTerms?: [                   // Optional — triggers DefinedTerm schema
    { term: "...", definition: "..." },
  ],
  faqs: [                             // ≥3 FAQs — triggers FAQPage schema
    { q: "...", a: "..." },
  ],
  sources: [                          // All stats cited in this page
    { text: "...", source: "..." },
  ],
  llmSummary: "...",                  // 2–4 sentences (see §4 below)
  cta: {
    headline: "...",
    buttonText: "...",
    buttonUrl: "/free-autopsy",
  },
  schemas: ["Article", "HowTo", "FAQPage"],  // Schemas to emit
}
```

---

## Step 2: Add the route to `App.tsx`

Open `artifacts/job-genie/src/App.tsx`. Add the route **before** the `/:slug` wildcard:

```tsx
import AEOPage from "./pages/AEOPage";

// Inside the Router() Switch block, before <Route path="/:slug" ...>:
<Route path="/your-page-slug">
  {() => <AEOPage slug="your-page-slug" />}
</Route>
```

---

## Step 3: Add the route to `entry-server.tsx` (SSR/prerender)

Open `artifacts/job-genie/src/entry-server.tsx`.

**3a.** Add to the `AEO_ROUTES` lookup table:
```typescript
'/your-page-slug': {
  title: 'Your Page Title | Job Genie',
  description: 'Your meta description (120–160 chars).',
  canonical: `${SITE_URL}/your-page-slug`,
  robots: 'index, follow',
  aeoQuestion: 'The primary question this page answers',
},
```

**3b.** Add to the `render()` function Switch block:
```tsx
<Route path="/your-page-slug">
  {() => <AEOPage slug="your-page-slug" />}
</Route>
```

---

## Step 4: Add to `sitemap.xml`

Open `artifacts/job-genie/public/sitemap.xml` and add:
```xml
<url>
  <loc>https://job-genie.ai/your-page-slug</loc>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

---

## Step 5: Run the audit

```bash
pnpm run seo:audit
```

Fix any FAIL results before committing.

---

## Writing a Compliant `directAnswer` Block

The `directAnswer` field is the most important piece of content on the page. It is the text that gets selected as a Featured Snippet and cited by AI answer engines.

### Requirements
- **40–80 words** — not a sentence, not a paragraph
- **Answer-first** — the first sentence must directly answer the page's `primaryQuestion`
- **Named subject** — start with "Job Genie", a named phenomenon, or the named answer
- **Quotable in isolation** — should make complete sense when read without context
- **No invented stats** — only cite from the approved stats list (see `docs/aeo-geo-strategy.md`)

### Template
```
[Named subject] [directly answers the question]. [Supporting evidence or mechanism]. [How Job Genie addresses it — 1 sentence].
```

### Good example
> "Ghost jobs are real and more common than most candidates realise. Research finds 81% of recruiters say their employer has posted a ghost job (MyPerfectResume), 62% of hiring managers admit doing it (Resume Builder), and one 2025 analysis estimated about 27% of U.S. LinkedIn listings were likely ghost jobs (ResumeUp.AI). A real share of what you apply to was never a fillable opening."

**Word count:** 68 ✓  
**Answer-first:** Yes — opens with direct answer to "Are ghost jobs real?" ✓  
**Named subject:** "Ghost jobs" ✓  
**Sources cited:** MyPerfectResume, Resume Builder, ResumeUp.AI ✓

### Bad example (what to avoid)
> "Many people wonder whether ghost jobs are real. The job market can be confusing sometimes, with many listings that may or may not be genuine opportunities. Job Genie helps by screening listings."

**Problems:** Not answer-first, vague, no stats, filler sentences.

---

## Writing a Compliant `llmSummary` Block

The `llmSummary` is rendered in a `<section class="llm-summary">` block that AI crawlers read directly. It is also injected into `llms.txt` for AI-specific crawler access.

### Requirements
- **2–4 sentences**
- **Entity-consistent** — use exact canonical names (see `docs/aeo-geo-strategy.md` §3)
- **Fact-dense** — include 1–2 citable stats if relevant
- **No banned claims** — do not use the 70–80% figure
- **Third-person** — "Job Genie analyzes..." not "We analyze..."

### Template
```
[Page topic and what it covers in 1 sentence]. [Key proprietary terms defined/used]. [Citable stat if applicable]. [Job Genie's solution/approach].
```

### Good example
> "Ghost jobs are job postings advertised with no genuine intent to hire. Research finds 62% of hiring managers admit posting one (Resume Builder) and ~27% of U.S. LinkedIn listings were likely ghost jobs in 2025 (ResumeUp.AI). Job Genie screens 300,000+ specialist recruiter-held listings in real time to remove ghost jobs before candidates apply."

---

## Adding and Citing a New Stat

1. **Verify** the primary source is a named institution (not another blog post)
2. **Check** it is not a restatement of the banned 70–80% claim
3. **Cite inline** with parentheses: `"62% of hiring managers... (Resume Builder)"`
4. **Add** to the `sources:` array in the page data
5. **Add** to the approved stats list in `.local/skills/meta-ai-aeo/SKILL.md`
6. **Set a review date** — 18 months from the study's publication date

**Format for the `sources:` field:**
```typescript
sources: [
  { text: "62% of hiring managers admit posting ghost jobs", source: "Resume Builder survey" },
  { text: "~27% of U.S. LinkedIn listings likely ghost jobs", source: "ResumeUp.AI analysis, September 2025" },
]
```

---

## Example Walkthrough: "How Long Does the Average Job Search Take?"

### 1. File: `landing-pages.ts` entry
```typescript
{
  slug: "how-long-does-job-search-take",
  metaTitle: "How Long Does the Average Job Search Take in 2026? | Job Genie",
  metaDescription: "Most job searches take 3–6 months, but Application Silence extends this significantly. Job Genie diagnoses what's slowing yours down — free, 2 minutes.",
  canonicalUrl: "https://job-genie.ai/how-long-does-job-search-take",
  robots: "index, follow",
  primaryQuestion: "How long does the average job search take?",
  h1: "How Long Does the Average Job Search Take in 2026?",
  directAnswer: "The average job search takes 3–6 months for mid-career professionals, but Application Silence — receiving no response across dozens or hundreds of applications — extends this significantly. The fix is rarely more applications; it is applying through the right channel and presenting as a candidate a specialist recruiter can shortlist. Job Genie diagnoses your specific blockers in under 2 minutes.",
  // ... rest of fields
}
```

### 2. `App.tsx` addition
```tsx
<Route path="/how-long-does-job-search-take">
  {() => <AEOPage slug="how-long-does-job-search-take" />}
</Route>
```

### 3. `entry-server.tsx` addition
```typescript
'/how-long-does-job-search-take': {
  title: 'How Long Does the Average Job Search Take in 2026? | Job Genie',
  description: 'Most job searches take 3–6 months, but Application Silence extends this significantly. Job Genie diagnoses what\'s slowing yours down — free, 2 minutes.',
  canonical: `${SITE_URL}/how-long-does-job-search-take`,
  robots: 'index, follow',
  aeoQuestion: 'How long does the average job search take?',
},
```

### 4. Audit
```bash
pnpm run seo:audit
# Expected: all PASS for new route
```
