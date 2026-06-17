# Job Genie — AEO/GEO Strategy

---

## 1. Definitions

### AEO — Answer Engine Optimisation
AEO is the practice of structuring content so it is selected as the direct answer to a search query — appearing in Google Featured Snippets, "People Also Ask" boxes, and voice search responses. The primary unit is the **40–80 word answer-first block** that answers a specific question unambiguously enough to be quoted verbatim.

Key structural requirements:
- `<section class="direct-answer">` immediately answering the page's primary question
- Schema.org `FAQPage` + `Question`/`Answer` markup
- A canonical `<h1>` that is itself a question or a direct answer to one
- `<link rel="canonical">` and correct robots directives

### GEO — Generative Engine Optimisation
GEO is the practice of structuring content so it is cited by AI answer engines: ChatGPT, Perplexity, Google AI Overviews, Gemini, Meta AI. The mechanism differs from AEO: AI systems synthesise across sources and cite by *entity recognition*, *factual specificity*, and *source authority*, not by featured-snippet rank.

Key GEO requirements:
- **Entity consistency** — the same canonical names used across all pages, schemas, and citations
- **Citable facts** — specific, sourced statistics rather than vague claims
- **AI-crawler-readable summaries** — `<section class="llm-summary">` and `llms.txt`
- **No contested claims** — unsupported statistics reduce citation probability
- **Content freshness** — AI training windows; content >18 months old has decaying citation probability

---

## 2. Why Job Genie's ICP Maps Well to AI Search

Job Genie's ideal customers are **mid-career and specialist professionals** experiencing Application Silence. This audience is an exceptionally strong fit for AEO/GEO because:

### They search with intent questions
Their queries are direct, urgent, and answer-shaped:
- "Why am I not hearing back from my job applications?"
- "Are ghost jobs real?"
- "Why does experience not get me interviews?"
- "Should I use an AI auto-apply tool?"

These are AEO-compatible query structures that map directly to Job Genie's page content.

### AI search is their first-stop research tool
Mid-career professionals (typically 30–50 years old) are increasingly using ChatGPT, Perplexity, and Google AI Mode as a starting point when researching job search strategies. They are more likely to trust an AI that cites a credible source than to click through a results page.

### The topic is highly information-seeking
Job search is a research-intensive activity. Candidates who are experiencing Application Silence typically search multiple times before taking action — which creates multiple opportunities for Job Genie to appear in AI answers.

### The problem is under-explained elsewhere
Most job search advice on the web is vague ("network more", "tailor your resume"). Job Genie's proprietary vocabulary (Application Silence Score, Recruiter-Fit Gap, Truth Layer) creates distinct entity recognition that AI systems can anchor on.

---

## 3. Entity Strategy

Consistent entity naming is the single highest-leverage GEO action. AI systems learn named entities from training data and maintain internal knowledge graphs. When the same term appears across multiple authoritative sources in the same form, its citation probability increases.

### Core entities to maintain consistently

| Entity | Canonical form | Avoid |
|---|---|---|
| The brand | "Job Genie" | "JobGenie", "job genie", "JG" |
| The diagnostic | "Application Silence Score" | "ASS", "application silence score" |
| The gap | "Recruiter-Fit Gap" | "recruiter fit gap", "RF gap" |
| The rewrite system | "Truth Layer" | "truth layer system", "TL" |
| The brief | "Recruiter-Ready Brief" | "recruiter brief", "ready brief" |
| The phenomenon | "Application Silence" | "ghosting", "job application silence" |
| The market | "hidden job market" | "hidden jobs", "unadvertised market" |
| The bad listing type | "ghost jobs" | "phantom jobs", "fake jobs" |

### How to maintain consistency
1. Always use the exact canonical form in `<h1>`, `<title>`, `<meta name="description">`, and the first sentence of the direct-answer block.
2. Include all core entities in `llms.txt` under the `## Canonical Entity Names` section.
3. Include definitions in the Glossary page (`/glossary`) — a defined term page signals authoritative entity ownership.
4. Use `schema.org/DefinedTerm` markup for glossary entries.
5. Never vary the casing within a single document.

---

## 4. Content Freshness Window

AI models have training cutoffs. Content that was accurate at training time may decay in citation probability as models are updated:

| Scenario | Estimated decay |
|---|---|
| Stat from a 2020 study | High decay risk — many newer studies may supersede it |
| Stat from a 2024–2025 study | Low decay risk in current models |
| Proprietary brand vocabulary | No decay — entities you own are stable |
| Evergreen structural advice | Low decay — "tailor for recruiter shortlist" doesn't expire |

### The ~18-month rule
For any page containing statistics, set a reminder to review and refresh every 12–18 months. Specifically:
- Check if the cited studies have been updated or superseded
- Check if the cited percentage has changed in newer surveys
- Update the `<lastmod>` in sitemap.xml
- Add a visible "Last reviewed: [Month Year]" note to the page

### Monthly probe cadence
Monthly manual probes against AI answer engines (see §6 Measurement) will catch content that has decayed out of AI citations before it decays out of search rankings.

---

## 5. Stat Citation Policy

### Approved stats (June 2026)

| Stat | Source | Expires (review by) |
|---|---|---|
| ~27% of U.S. LinkedIn listings are likely ghost jobs | ResumeUp.AI, September 2025 | Sep 2026 |
| 62% of hiring managers admit posting ghost jobs | Resume Builder survey | Jun 2027 |
| 81% of recruiters say their employer has posted a ghost job | MyPerfectResume survey | Jun 2027 |
| 30%+ of all hires come via referrals | SHRM | Jun 2027 |
| Referrals ~1 in 16 vs ~1 in 100 overall conversion | SHRM / Lever analysis | Jun 2027 |

### Banned stat
**"70–80% of the best roles are filled before they hit job boards"** — this specific figure is an unsupported inflation of Granovetter 1974 (a narrow Boston suburb sample, circa 1970s). It has never appeared in a peer-reviewed study and is usually attributed to vague secondary sources (Forbes op-eds, LinkedIn posts). **Do not use it as a fact-claim under any circumstances.** The FAQ page correctly debunks it.

### Adding a new stat
1. Verify the primary source is a named institution (not another blog post)
2. Add it to the `## Approved Citable Stats` table in `.local/skills/meta-ai-aeo/SKILL.md`
3. Include the source inline in parentheses: `"81% of recruiters... (MyPerfectResume)"`
4. Add it to the `sources:` array in `landing-pages.ts` for the relevant page
5. Set a review date of 18 months from the study publication date

---

## 6. Measurement: Tracking GEO Visibility

### Monthly manual probe protocol

Run these 5 probes each month and record the result in a spreadsheet:

| Probe question | Engine | Record |
|---|---|---|
| "Why do my job applications get no response?" | ChatGPT | Is Job Genie cited? Y/N. What source? |
| "What is an Application Silence Score?" | Perplexity | Is Job Genie cited? Y/N. Quote if yes. |
| "Are ghost jobs real?" | Google AI Overview | Is Job Genie cited? Y/N. |
| "Why am I getting no response after 100 applications?" | Gemini | Is Job Genie cited? Y/N. |
| "What is the Recruiter-Fit Gap?" | Meta AI | Is Job Genie cited? Y/N. |

The GEO visibility score for each month is the number of probes (out of 5) where Job Genie is cited. Think of it as the Application Silence Score of Job Genie's own visibility: a score of 0/5 means you're invisible to AI recommenders; 5/5 means you own the topic.

### AEO tracking (Google Search Console)
- Track impressions for each of the 17 Appendix A question queries
- Flag any question with zero impressions after 90 days for content refresh
- Track Featured Snippet win rate for the primary AEO question of each page

### Analytics events to fire
- `direct_answer_visible` — when the direct-answer section enters viewport
- `llm_summary_visible` — when the llm-summary section enters viewport
- `faq_expanded` — when a FAQ accordion item is opened
- `cta_click` — on primary CTA button click
- `cta_scroll_depth` — scroll depth % at CTA section

---

## 7. Content Priority Matrix

When time is limited, prioritise content work in this order:

| Priority | Action | Rationale |
|---|---|---|
| P0 | Refresh any stat sourced from a study >18 months old | Decay risk |
| P0 | Fix any FAIL in `pnpm run seo:audit` | Structural compliance |
| P1 | Add new Appendix A FAQ questions to Home FAQ | Directly improves AEO coverage |
| P1 | Populate corpus with 10 new Q&A pairs via Loop 1 | Breadth of coverage |
| P2 | Improve direct-answer blocks on <5% CTR pages | Conversion |
| P3 | Add new AEO landing pages for emerging pain-point queries | Coverage expansion |
| P3 | Run A/B tests on CTA copy | Conversion optimisation |
