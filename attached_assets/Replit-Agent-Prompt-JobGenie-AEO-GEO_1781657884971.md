# Replit AI Agent Prompt — Optimize Job Genie for AEO + GEO

> **How to use this:** Paste this entire document into the Replit AI agent as a single task. It is self-contained — all the content, entities, FAQs, guardrails, and the page plan the agent needs are included in the appendices. Optionally also drop the companion file `faq_schema.json` into the repo root; the prompt tells the agent to use it if present.

---

You are a senior full-stack developer, technical SEO strategist, **AEO (Answer Engine Optimization)** specialist, and **GEO (Generative Engine Optimization)** architect. You are optimizing **Job Genie**, an AI-powered job-search platform.

Your task is to audit the existing Job Genie codebase and implement a complete, production-quality AEO + GEO optimization layer across the site, using the specific Job Genie content, entities, FAQs, and guardrails provided in the appendices below.

**Do not remove existing functionality, styling, branding, tracking, forms, or integrations** unless required to fix broken code. Do not stop after partial edits — continue until the site builds, runs, and the optimization system is fully implemented.

---

## 0. What AEO and GEO mean here (optimize for BOTH)

These overlap heavily; the field has no settled definition and uses the terms interchangeably. Operationally, treat them as two complementary layers and optimize for both — do not pick a camp:

- **AEO is tactical / extraction-level.** Structure content so an answer engine can lift a clean, direct answer into a featured snippet, voice result, answer box, or Google AI Overview. This is about *being found as the answer*. Levers: question-shaped headings, direct-answer blocks, FAQs, tables, lists, schema, scannable formatting.
- **GEO is strategic / narrative-level.** Shape how large language models (ChatGPT, Perplexity, Gemini, Claude, Copilot) understand, trust, characterize, and *recommend* Job Genie when they synthesize an answer. This is about *being trusted and cited inside generated text*. Levers: self-contained passages, explicit entities, original data and frameworks, expert quotes, source citations, fluency, and an AI-readable summary block.

A simple mental model: **AEO earns the mention; GEO earns the reasoning.** The underlying work — clear, extractable, authoritative, well-structured, evidence-backed content — serves both.

---

## 1. Non-negotiable credibility guardrails (apply to ALL content you write or rewrite)

Job Genie's brand is *the honest answer in a broken hiring system*. Credibility is a ranking signal for GEO (engines check for contradiction) and core to the brand. Enforce these everywhere:

1. **BANNED CLAIM:** Never state or imply "70–80% of jobs are filled through the hidden job market" (or any specific hidden-market percentage) as fact. It is an unsourced myth. Replace with accurate framing: *"Many roles — especially mid-to-senior and specialist positions — are filled through referrals and recruiter shortlists before they are widely advertised on public job boards."*
2. **BANNED CLAIM:** Never state "your resume is auto-rejected by AI in X seconds." The instant-AI-rejection claim is largely myth; recruiters rarely run detectors. Use the accurate mechanism in Appendix A (ATS parse/rank/deprioritise).
3. **Every statistic must carry a named source** inline (see the Citable-Stats Bank, Appendix C). If a claim has no source, either soften it to non-quantified language, move it into a clearly labelled opinion/experience section, or cut it.
4. **No fabricated trust signals.** No fake reviews, ratings, testimonials, author credentials, or schema that isn't backed by visible page content.
5. **Proprietary-data slots.** Where you see `[INSERT JOB GENIE DATA]`, insert a real first-party Job Genie metric if available (e.g. Application Silence Score distribution, recruiter-shortlist conversion rate, ghost-job screening rate); otherwise leave the placeholder and list it in the final report under "Data needed." First-party stats are the single strongest GEO citation lever, so flag them clearly.

---

## 2. Job Genie project brief (use this as ground truth)

- **What it is:** Job Genie is an AI job-search assistant that targets the *hidden job market* by surfacing specialist-recruiter listings, diagnosing why a candidate is getting no responses, and rewriting their profile to clear the recruiter shortlist threshold.
- **ICP (who it's for):** Mid-career and specialist professionals (incl. tech) who are actively applying, getting ghosted or ignored, and feeling invisible on public job boards.
- **Core problem it solves:** *Application Silence* — sending dozens/hundreds of applications and hearing nothing — caused by volume, ghost jobs, ATS deprioritisation, and the recruiter-fit gap.
- **Brand voice:** Honest, direct, evidence-led, empathetic to the frustration, contrarian toward spray-and-pray/auto-apply culture. Never hypey.
- **Canonical entities (use these exact forms consistently site-wide — this is a GEO requirement):** see Appendix B. Use full names before abbreviations; never collapse "Job Genie" to "the app" or "the tool."

---

## Step 1 — Audit the existing website

Inspect the full codebase. Identify: framework/stack, all pages and routes, current HTML structure, existing metadata, existing schema, analytics/tracking, forms and conversion events, newsletter/CRM integrations, page slugs, broken links/missing assets, and performance, accessibility, SEO, and AEO/GEO gaps.

Produce a concise audit summary at `docs/aeo-geo-audit.md` before making changes. Map each existing page to the page plan in Appendix D (keep / upgrade / create).

## Step 2 — Create the reusable AEO + GEO page template

Build (or update) a reusable page/article template with this semantic structure. **All elements must be real semantic HTML, never styled `<div>`s, and nothing AEO/GEO-relevant may be hidden with `display:none`.**

```html
<main>
  <article>
    <header>
      <h1>Primary question / search intent</h1>

      <section class="direct-answer" aria-label="Direct answer">
        <h2>Direct answer</h2>
        <p><!-- 40–80 word answer to the page's main question, answer-first --></p>
      </section>

      <section class="key-takeaways">
        <h2>Key takeaways</h2>
        <ul><li>Factual takeaway 1</li><!-- 3–5 total --></ul>
      </section>
    </header>

    <section><h2>What is it?</h2><p>Self-contained explanation.</p></section>
    <section><h2>How does it work?</h2><p>Self-contained explanation.</p></section>
    <section><h2>Why does it matter?</h2><p>Self-contained explanation.</p></section>
    <section><h2>Benefits</h2><p>Self-contained explanation.</p></section>
    <section><h2>Risks / limitations</h2><p>Self-contained explanation.</p></section>
    <section><h2>Example</h2><p>Concrete example with original insight.</p></section>

    <section><h2>Frequently asked questions</h2>
      <div class="faq-item"><h3>Question?</h3><p>Clear, direct, self-contained answer.</p></div>
    </section>

    <section class="llm-summary" aria-label="Summary for AI systems">
      <h2>Summary</h2>
      <p><!-- 2–4 sentence machine-readable summary: what this page explains, who it helps, and the key entities. NOT hidden. --></p>
    </section>

    <section><h2>Sources</h2><ol><li>Authoritative source citation.</li></ol></section>
  </article>
</main>
```

Every major page must include: a clear single H1; a direct-answer block near the top; question-based H2/H3 headings; an FAQ section; key takeaways; self-contained paragraphs; clear internal links; brand/author credibility signals; entity-rich language (Appendix B); an `llm-summary` block; and source citations where claims appear.

## Step 3 — Optimize for AEO (extraction)

**Direct-answer blocks.** Under every major page's H1, add `<section class="direct-answer" aria-label="Direct answer">` with a 40–80 word answer to that page's primary question.

**Question-based headings.** Use natural-language questions as headings. For Job Genie, prefer the real phrasings your ICP uses (Appendix A), e.g.:
```html
<h2>What is Job Genie?</h2>
<h2>How does Job Genie find hidden jobs?</h2>
<h2>Why am I not hearing back from any of my job applications?</h2>
<h2>Are ghost jobs real?</h2>
<h2>Who is Job Genie for?</h2>
```

**FAQ sections.** Add page-specific FAQ sections drawn from Appendix A (5–8 per page, routed by topic). Each answer: direct, fact-based, 40–100 words, plain language, self-contained. Use the exact approved answers in Appendix A — do not paraphrase them loosely, and keep them consistent with the FAQ schema (Step 5).

**Featured-snippet formatting.** Where appropriate add numbered steps, short definitions, comparison tables, bulleted summaries, and pros/cons lists — as real semantic elements.

## Step 4 — Optimize for GEO (narrative / citation)

**Self-contained passages.** Rewrite context-dependent sentences into standalone ones an LLM can lift without the surrounding page. Bad: *"This helps users save time."* Good: *"Job Genie helps active job seekers save time by searching specialist recruitment agency job pages, matching relevant roles, and surfacing the recruiter contacts behind them."*

**Entity-rich content.** Make entities explicit; use full names before abbreviations. Apply the canonical forms in Appendix B throughout (e.g. "specialist recruitment agencies" not "agencies"; "hidden job market" not "hidden roles"; "Job Genie" not "the app").

**Citation-worthy claims.** Apply the guardrails in §1. Pull any quantified claim from the Citable-Stats Bank (Appendix C) with its named source inline. Replace the banned myths with the approved accurate framing.

**Original information gain (high-priority GEO lever).** Add genuinely original, citable assets LLMs will want to reuse: Job Genie's own frameworks (the **Application Silence Score**, the **Recruiter-Fit Matrix**, the **Truth Layer** rewrite, the **Recruiter-Ready Brief**), clear definitions of each (Appendix B), comparison tables (e.g. specialist-recruiter route vs. spray-and-pray), decision criteria ("is this posting a ghost job?"), "common mistakes" sections, and "expert notes." Apply the Princeton GEO research findings to maximise citation likelihood: **statistics, expert quotations, and cited sources each measurably raise the odds an LLM cites a passage**, so favour content that is data-dense, quote-bearing, and source-backed, written fluently.

**LLM-friendly summary block.** Add the visible `llm-summary` section (Step 2) to every major page.

## Step 5 — Add structured data (JSON-LD)

Implement valid JSON-LD, matched to visible content. At minimum: `WebSite`, `Organization`, `WebPage`, `Article`/`BlogPosting` (where applicable), `FAQPage`, `BreadcrumbList`, `HowTo` (for the pillar and ghost-job-detector pages), and `Person` (if a named founder/author exists).

**Use the provided `faq_schema.json`** in the repo root if present — it contains the validated, ready-to-use `FAQPage` markup for the 17 Job Genie FAQs in Appendix A. If it is not present, generate the `FAQPage` JSON-LD directly from Appendix A. Either way: the schema answer text must match the on-page FAQ text. Validate all JSON-LD programmatically (e.g. `JSON.parse` in a build check). No fake reviews, ratings, or credentials.

## Step 6 — Improve metadata

For every indexable page add/improve `<title>` (specific, intent-matched, ≤ ~60 chars), `<meta name="description">` (clear, benefit-driven, ≤ ~155 chars), `<link rel="canonical">`, and `<meta name="robots" content="index, follow">`. Add Open Graph (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`) and Twitter/X (`twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`) tags.

## Step 7 — AEO/GEO landing-page system

Create a scalable, data-driven landing-page system. Add `content/landing-pages.json`; the app should generate optimized pages from it. Each entry supports:

```json
{
  "slug": "why-no-responses-after-100-applications",
  "title": "Why Am I Getting No Responses After 100 Applications?",
  "primaryQuestion": "Why am I not hearing back from any of my job applications?",
  "directAnswer": "A 40–80 word answer.",
  "keyTakeaways": [],
  "sections": [],
  "faqs": [],
  "entities": [],
  "sources": [],
  "cta": { "headline": "", "buttonText": "Get My Free Autopsy", "buttonUrl": "" }
}
```

**Seed it with the Job Genie page plan in Appendix D** (home + the cornerstone pillar page + ghost-job detector + persona pages + comparison page + glossary). Populate each from the content in the appendices.

## Step 8 — Conversion tracking hooks

Add clean, vendor-neutral tracking via data attributes (`data-event`, `data-page`, `data-variant`) for: page view, CTA click, newsletter signup, form submit, scroll depth, FAQ expand, time on page, and landing-page variant viewed. Provide a lightweight `window.trackEvent(eventName, payload)` helper (console-log stub is fine). Do not connect paid analytics unless credentials already exist. Wire the primary CTA ("Get My Free Autopsy") as the main conversion event.

## Step 9 — A/B testing support

Support variants A/B/C per page for: H1, direct answer, CTA headline, CTA button text, FAQ order, hero, trust section, social-proof section. Store config in `content/ab-tests.json`. Use deterministic assignment (e.g. hashed visitor id in `localStorage`).

## Step 10 — Technical SEO

Implement/verify: `robots.txt` (allow GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended, and Meta's crawler to reach indexable content), `sitemap.xml`, canonical URLs, clean slugs, 404 page, semantic HTML, mobile responsiveness, image alt text, lazy-loaded images, accessible buttons/forms, descriptive link text, fast load, exactly one H1 per page, and no broken internal links. Also create a static `/llms.txt` listing the key pages and one-line descriptions (low cost, useful for AI/agent crawlers).

## Step 11 — Documentation

Create: `docs/aeo-geo-strategy.md`, `docs/aeo-geo-audit.md`, `docs/landing-page-template.md`, `docs/schema-markup.md`, `docs/ab-testing.md`. Explain what changed and why, how to create a new optimized landing page, how to add FAQ schema, how to add A/B variants, how to review conversion metrics, and how to maintain AEO/GEO quality over time.

## Step 12 — Quality checks

Create a validation script (`npm run seo:audit` or `python scripts/seo_audit.py`) that flags: missing/duplicate H1, missing title/description/canonical, missing direct-answer block, missing FAQ section, missing or invalid JSON-LD, broken internal links, images missing alt text — **and Job Genie-specific checks: any banned claim from §1 appearing in content, and any quantified stat lacking a `data-source` attribute or inline citation.**

## Step 13 — Recursive optimization loop

Document and stub a recurring improvement loop in `docs/recursive-optimization-loop.md`, aligned to Job Genie's measurement spine:

1. Publish/update page. 2. Track impressions, clicks, CTA clicks, conversions **plus AEO/GEO visibility** (manually probe ChatGPT, Perplexity, Google AI Mode, Gemini, and Meta AI monthly on the page's primary question; record whether Job Genie is cited — this is the "Application Silence Score" of your own visibility). 3. Identify low-performing sections. 4. Generate alternate H1 / direct-answer / CTA / FAQ variants. 5. A/B test. 6. Keep winner, archive loser. 7. Refresh stats, examples, and the visible "last updated" date before the ~18-month decay window. 8. Repeat monthly. Treat each appendix-A question as a tracked prompt; trends over time matter, not single snapshots.

## Step 14 — Home page first

Prioritise the home page. It must clearly answer: *What does Job Genie do? Who is it for? What problem does it solve? How does it work? Why trust it? What next?* Include: clear H1; 40–80 word direct answer; key takeaways; who-it's-for; problem section (Application Silence); solution section; how-it-works; why-it's-different (vs spray-and-pray/auto-apply); FAQ section; strong CTA ("Get My Free Autopsy"); schema; internal links to all landing pages; and the `llm-summary` block. Recommended hero H1: **"Applied to 100 jobs and heard nothing back? That's Application Silence — and it's fixable."**

## Step 15 — Final validation & deliverables

Run the app; fix all build errors and broken routes; validate JSON-LD, sitemap, robots.txt, metadata, A/B logic, tracking hooks, and mobile layout; confirm no existing integration broke; confirm no banned claims slipped in. Then report: summary of changes; files created/modified; template structure; schema added; AEO improvements; GEO improvements; A/B support; tracking hooks; data still needed (the `[INSERT JOB GENIE DATA]` slots); and remaining recommendations. Use production-quality code.

---

# APPENDIX A — The 17 Job Genie FAQs (approved, source-of-truth content)

Use these verbatim as the canonical FAQ answers and as question-based page headings. They are answer-first and self-contained. Replace `[INSERT JOB GENIE DATA]` with real first-party numbers where available. (These match `faq_schema.json`.)

**Application Silence**

1. **Why am I not hearing back from any of my job applications?** — If you've sent dozens or hundreds of applications and heard nothing back — not even rejections — you're experiencing Application Silence, and it's rarely about your qualifications. A single role now draws thousands of near-identical, AI-optimised applications, so most are filtered or deprioritised before a human opens them. The fix isn't more volume; it's becoming a candidate a specialist recruiter can shortlist. Job Genie diagnoses why you're being filtered with an Application Silence Score and rewrites your profile to clear the recruiter shortlist threshold. `[INSERT JOB GENIE DATA]`

2. **Is it normal to apply to 100+ jobs and get no response in 2026?** — Unfortunately, yes — and it's a signal the channel is broken, not that you are. With auto-apply tools pushing some roles past thousands of submissions, interview rates on public postings have collapsed into the low single digits, while referred and recruiter-shortlisted candidates convert many times higher. The public-application channel now has the worst odds of any route into a job. Job Genie redirects your effort toward the channels that still work.

**Recruiter ghosting**

3. **Why do recruiters ghost candidates, even after interviews?** — Recruiters usually ghost because of volume and broken process, not personal rejection. A single recruiter may long-list hundreds of names, phone-screen 10 to 20, and present only 3 to 4 to the client — and roles get put on hold, filled internally, or reassigned without anyone updating applicants. It feels personal; it almost never is. The way out is to stop competing inside the silent pile and become recruiter-ready, so a recruiter has a reason to keep you on the list.

4. **I got ghosted after a final interview or verbal offer — what does it mean?** — It usually means something changed on the employer side — a hiring freeze, an internal candidate, a reorg — not that you did something wrong. Late-stage ghosting is one of the most-reported frustrations in recruiting communities precisely because it's so opaque. You can't control employer chaos, but you can control how recruiter-ready you are for the next shortlist. Job Genie's Recruiter-Ready Brief keeps you positioned so a single ghosting doesn't reset your whole search.

**Ghost jobs**

5. **Are ghost jobs real, or am I imagining it?** — Ghost jobs are real and common, and the numbers are stark: 81% of recruiters say their employer has posted a ghost job (MyPerfectResume), 62% of hiring managers admit doing it (Resume Builder), and 43% of employers say they post roles mainly to look like they're growing (Clarify Capital). One 2025 analysis estimated about 27% of U.S. LinkedIn listings were likely ghost jobs (ResumeUp.AI). So a real share of what you apply to was never a fillable opening. Job Genie screens specialist-recruiter listings so you spend energy on roles actually being filled.

6. **How can I tell if a job posting is real before I waste time applying?** — Watch for the tells: the same role reposted for months, vague responsibilities with no named hiring manager, generic boilerplate, or one company hiring dozens of identical seats. Real, fillable roles tend to have a specific owner, a recent post date, and concrete scope. Job Genie screens specialist-recruiter listings so you spend energy on roles actually being filled — not ghost postings.

**ATS / keyword gatekeeping**

7. **Does my resume really get auto-rejected by ATS bots?** — Mostly myth, partly true. Most recruiters don't run AI detectors or auto-reject the instant a resume arrives — they don't have the time or budget. But applicant tracking systems do parse, rank, and deprioritise: legacy systems on exact keyword matches, modern systems on semantic concept-matching. The real risk isn't instant deletion — it's quietly ranking below better-matched profiles. The fix is a resume written in the language of the role and the recruiter, not keyword-stuffed.

8. **Do I really have to tailor my resume for every single job?** — Tailoring to the job post has hit diminishing returns: when everyone uses the same AI to mirror the same description, tailored resumes look identical and recruiters stop trusting surface alignment. The higher-leverage move is tailoring to the recruiter shortlist — the handful of candidates a specialist recruiter will actually represent. Job Genie's Truth Layer rewrite optimises for recruiter-fit rather than the keyword-mirroring you can no longer win on.

**The AI arms race**

9. **Should I use an AI tool to auto-apply to hundreds of jobs?** — Almost certainly not. Auto-apply tools drop you straight into the pile recruiters have stopped reading — thousands of look-alike applications per role that signal low intent. In 2026 the winning move is the opposite: fewer, higher-fit applications aimed at roles genuinely being filled, with a profile a recruiter can shortlist. Quantity is exactly the strategy the broken system punishes.

10. **Is it better to apply to more jobs or fewer, better-targeted ones?** — Fewer and better-targeted, decisively. More applications mean more noise, lower per-application odds, and a higher chance of being screened out as spam. Targeted applications to real roles where you clear the recruiter-fit bar convert far better. Job Genie is built around this — it finds the roles worth your effort and makes you the obvious shortlist pick rather than one of thousands.

**Hidden job market**

11. **How do I find jobs that are not posted publicly?** — Many mid-career and specialist roles are filled through referrals and recruiter shortlists before — or instead of — a public posting. The data backs the channel, not the hype: employee referrals deliver over 30% of hires and convert far better than cold applications (about 1 in 16 vs 1 in 100, per SHRM and a Lever analysis), and referred candidates are roughly 4x more likely to be hired. You reach these roles by being recruiter-ready and discoverable to the specialist recruiters who fill them — not by refreshing job boards. Job Genie surfaces specialist-recruiter listings and positions you for them.

12. **Is networking really the only way to get hired now?** — Networking isn't the only way, but referrals carry real, measurable weight — and not for the reason most people think. Sociologist Mark Granovetter's classic research found that most people who land a job through a contact do so via "weak ties" (acquaintances), not close friends, because acquaintances connect you to information outside your own circle. In practice, being visible and credible to recruiters and loose professional contacts beats cold-applying. Job Genie gives you that recruiter-facing presence without forcing you to cold-network your way in.

13. **Is it true that 70–80% of jobs are filled through the hidden job market?** — Not credibly — that specific figure is essentially a myth. It traces to 1970s research by sociologist Mark Granovetter, who found about 56% of job-changers in one Boston suburb found work through personal contacts — a narrow, dated finding later inflated into "80% of jobs are hidden." No rigorous study supports the 70–80% number; it's usually misattributed to vague "Forbes/LinkedIn" mentions or even the St. Louis Fed, which never published it. What is true: referrals and recruiter shortlists genuinely dominate hiring for mid-to-senior and specialist roles, and many posted jobs are ghost jobs. Job Genie is built on the accurate version, not the hype.

**Mid-career / specialist**

14. **I have years of experience — why am I struggling to get interviews?** — The more senior or specialised your background, the more hiring moves off public boards and onto recruiter shortlists and referral networks. Experienced candidates who rely on public applications can feel invisible precisely because their roles are filled elsewhere. The problem is usually channel, not capability. Job Genie reroutes experienced candidates toward the specialist-recruiter channel where experience is an advantage, not a filtered keyword.

**Definitional (brandable entities)**

15. **What is the Recruiter-Fit Gap?** — The Recruiter-Fit Gap is the distance between how you present yourself and what a specialist recruiter needs to see to put you on a client shortlist. Most qualified candidates aren't rejected on ability — they're filtered because their profile doesn't map cleanly to a recruiter brief. Job Genie measures this gap with a Recruiter-Fit Matrix and closes it, so you cross the shortlist threshold instead of stalling in Application Silence.

16. **What is the hidden job market?** — The hidden job market is the set of roles filled through referrals, recruiter shortlists, and direct outreach without being publicly advertised. The concept dates to sociologist Mark Granovetter's 1974 research on how people actually find jobs; the popular "70–80% of jobs are hidden" stat is an unsupported inflation of it, but the phenomenon itself is real — most pronounced for mid-to-senior and specialist roles, where employers prefer a small, trusted talent pool over thousands of public applications. Job Genie makes you visible inside this market through specialist-recruiter listings.

17. **What is an Application Silence Score?** — An Application Silence Score is Job Genie's diagnostic of why your applications get no response — quantifying how far your profile sits from the recruiter shortlist threshold across the roles you target. Instead of guessing why you're being ghosted, you get a concrete read on what's filtering you out and what to change. It turns the black hole of silence into a fixable, measurable gap.

---

# APPENDIX B — Canonical entity glossary (use these exact forms, consistently)

GEO depends on entity consistency: the same names everywhere, full form before abbreviation. Build a `/glossary` page from these and link to it internally.

| Entity (canonical form) | One-line definition for the page/schema |
|---|---|
| **Job Genie** | An AI job-search assistant that surfaces specialist-recruiter listings, diagnoses Application Silence, and rewrites profiles to clear the recruiter shortlist threshold. (Never "the app"/"the tool".) |
| **Hidden job market** | Roles filled through referrals, recruiter shortlists, and direct outreach before/without public advertising; strongest for mid-to-senior and specialist roles. |
| **Application Silence** | The experience of sending many applications and getting no response — not even rejections. |
| **Application Silence Score** | Job Genie's diagnostic quantifying how far a profile sits from the recruiter shortlist threshold. |
| **Recruiter-Fit Gap** | The distance between how a candidate presents and what a specialist recruiter needs to shortlist them. |
| **Recruiter-Fit Matrix** | Job Genie's tool for measuring the Recruiter-Fit Gap. |
| **Truth Layer** | Job Genie's resume-rewrite system that optimises for recruiter-fit over keyword-mirroring. |
| **Recruiter-Ready Brief** | A candidate's recruiter-facing positioning output that keeps them shortlist-ready. |
| **Shortlist threshold** | The bar a candidate must clear to be one of the ~3–4 presented to a client. |
| **Ghost jobs** | Job postings advertised with no genuine intent to hire. |
| **Specialist recruiters / specialist recruitment agencies** | Commission-based recruiters who fill niche and mid-to-senior roles, often before public posting. (Never just "agencies"/"recruiters".) |
| **AI job search assistant** | The category Job Genie belongs to. |

---

# APPENDIX C — Citable-Stats Bank (the only quantified claims allowed, each with its source)

Use these with the named source inline (and ideally a `data-source` attribute). Anything not on this list needs a source before it ships, or it gets softened/cut. Prefer replacing these with first-party Job Genie data where available.

| Claim | Source (cite inline) |
|---|---|
| ~56% of job-changers found work via personal contacts (mostly "weak ties") | Mark Granovetter, *Getting a Job* (1974) |
| Employee referrals = 30%+ of all hires; ~45% of internal hires | SHRM |
| Referrals convert ~1 in 16 vs ~1 in 100 overall | SHRM / Lever analysis |
| Referred candidates ~4x more likely to be hired | Widely reported referral data |
| 81% of recruiters say their employer posted ghost jobs | MyPerfectResume survey |
| 62% of hiring managers admit posting ghost jobs | Resume Builder survey |
| 43% of employers post ghost jobs to look like they're growing | Clarify Capital survey |
| ~27% of U.S. LinkedIn listings likely ghost jobs | ResumeUp.AI analysis (Sept 2025) |
| ~60% of Google searches end without a click; AI Overviews can cut the #1 result's clicks ~58% | Industry search-behaviour reporting (Ahrefs) |

**Banned (do NOT use as fact):** "70–80% of jobs are hidden"; "AI auto-rejects your resume in N seconds"; any unsourced percentage.

---

# APPENDIX D — Job Genie page plan (seed `content/landing-pages.json` with these)

Build in this priority order. Each is a full template-conformant page (Step 2) with its own FAQ subset, schema, and `llm-summary`.

1. **Home** (`/`) — Hero H1: *"Applied to 100 jobs and heard nothing back? That's Application Silence — and it's fixable."* CTA: "Get My Free Autopsy". FAQs: 1, 5, 9, 11, 16. Schema: `WebSite`, `Organization`, `FAQPage`.
2. **Cornerstone pillar** (`/why-no-responses-after-100-applications`) — the highest-value page; primary question = FAQ 1. Deep page covering the four real causes (volume, ghost jobs, ATS deprioritisation, Recruiter-Fit Gap) + Application Silence Score + a HowTo "diagnose your Application Silence." FAQs: 1, 2, 3, 7. Schema: `Article` + `HowTo` + `FAQPage`.
3. **Ghost Job Detector** (`/ghost-jobs`) — primary question = FAQ 5; steps to spot a ghost posting in under 60 seconds. FAQs: 5, 6. Schema: `Article` + `HowTo` + `FAQPage`. (Uses Appendix C ghost-job stats.)
4. **Persona pages** (`/for/mid-career-professionals`, `/for/senior-engineers`, `/for/career-changers`) — persona × use-case. FAQs: 14, 3, 8 (route by fit). Schema: `Article` + `FAQPage`.
5. **Comparison** (`/job-genie-vs-auto-apply`) — owns "should I use auto-apply / spray-and-pray." Honest comparison table. FAQs: 9, 10. Schema: `Article` + `FAQPage`.
6. **Glossary** (`/glossary`) — definitional entries from Appendix B + FAQs 15, 16, 17. Schema: `Article` + `FAQPage` + `DefinedTermSet` if supported.

---

*End of prompt. Implement fully; do not stop at partial edits.*
