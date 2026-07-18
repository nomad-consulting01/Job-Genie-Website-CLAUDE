# Job Genie — GEO Probe Log

Tracks monthly manual probes across 5 AI engines to measure whether Job Genie is cited in AI-generated answers. Run on the same 5 questions each month. Protocol defined in `docs/recursive-optimization-loop.md §2b`.

**Target:** 5/5 by month 6 of active optimisation.

---

## How to Read This Log

- **Cited:** Y = Job Genie was cited or quoted; N = not cited
- **Quote:** Exact text cited, or "—" if not cited
- **Source cited:** URL shown by the engine, or "general knowledge" / "—"
- **GEO score:** Number of probes where Job Genie is cited (0–5)

| Score | Interpretation |
|---|---|
| 5/5 | Dominant entity on this topic |
| 3–4/5 | Visible but not dominant |
| 1–2/5 | Sporadic visibility |
| 0/5 | Invisible to AI search |

---

## Month 1 — June 2026

**Probe date:** 2026-06-30  
**Conducted by:** Manual (human-run against live engines)  
**GEO visibility score: 0 / 5**

| # | Question | Engine | Cited | Quote | Source cited | Notes |
|---|---|---|---|---|---|---|
| 1 | "Why do my job applications get no response?" | ChatGPT (GPT-4o) | N | — | — | Answer cited LinkedIn, Indeed, and general advice. No mention of Job Genie or Application Silence Score. |
| 2 | "What is an Application Silence Score?" | Perplexity | N | — | — | Query returned no results for the term. Perplexity noted it is not a widely indexed phrase yet. |
| 3 | "Are ghost jobs real?" | Google AI Overview | N | — | — | AI Overview cited ResumeBuilder.com and LinkedIn. Job Genie's ghost jobs page was not referenced. |
| 4 | "Why am I getting no response after 100 applications?" | Gemini | N | — | — | Gemini cited general career advice and LinkedIn articles. No Job Genie content surfaced. |
| 5 | "What is the Recruiter-Fit Gap?" | Meta AI | N | — | — | Term not recognised. Meta AI provided generic advice about recruiter expectations with no citation. |

### Month 1 Interpretation

Score 0/5 — **Invisible to AI search.** This is the expected baseline for a site in its first month of publication. No AI engine has yet indexed or surfaced Job Genie content. Key factors:

- AI training windows and retrieval indexes lag publication by weeks to months
- Branded terms (Application Silence Score, Recruiter-Fit Gap) are not yet associated with Job Genie in any AI knowledge base
- `llms.txt` is live at `/llms.txt` — Perplexity and similar real-time engines will find it on next crawl

**Priority actions before Month 2 probe:**
- Verify `llms.txt` is accessible and well-formed
- Ensure all AEO landing pages are indexed in Google Search Console
- Check that `robots.txt` is not blocking AI crawlers (`GPTBot`, `PerplexityBot`, `Google-Extended`, `FacebookBot`)

---

## Month 2 — July 2026

**Scheduled probe date:** 2026-07-30  
**Same 5 questions, same 5 engines.**

| # | Question | Engine | Target |
|---|---|---|---|
| 1 | "Why do my job applications get no response?" | ChatGPT (GPT-4o) | First citation |
| 2 | "What is an Application Silence Score?" | Perplexity | First citation (branded term) |
| 3 | "Are ghost jobs real?" | Google AI Overview | First citation |
| 4 | "Why am I getting no response after 100 applications?" | Gemini | First citation |
| 5 | "What is the Recruiter-Fit Gap?" | Meta AI | First citation (branded term) |

**Month 2 goal:** 1–2/5. Perplexity and Google AI Overview are most likely to cite first, as both use live web retrieval rather than static training data.

---

## Running Score History

| Month | Date | Score | Δ | Notes |
|---|---|---|---|---|
| 1 | 2026-06-30 | 0/5 | — | Baseline; site newly published |
| 2 | 2026-07-30 | — | — | Scheduled |
| 3 | 2026-08-31 | — | — | Scheduled |
| 4 | 2026-09-30 | — | — | Scheduled |
| 5 | 2026-10-31 | — | — | Scheduled |
| 6 | 2026-11-30 | — | — | Target: 5/5 |

---

## Probe Protocol (Quick Reference)

Run these 5 probes fresh each month — do not use cached or saved sessions:

1. Open each engine in a private/incognito window
2. Paste the question exactly as written — no paraphrasing
3. Record whether Job Genie (`jobgenie.app` or any Job Genie page) is cited in the answer
4. If cited, copy the exact quote and the URL shown
5. Update the table for that month in this file
6. Update the Running Score History table
7. If score is 0/5 for a second consecutive month, escalate per `docs/recursive-optimization-loop.md §3`

---

## Appendix A — All 17 Questions: Monthly AI Citation Tracker

Tracks whether each of the 17 Appendix A questions returns a Job Genie citation or Featured Snippet win in any major AI engine or Google Search. Run monthly alongside the 5-question core probe. Protocol defined in `docs/recursive-optimization-loop.md §2c`.

**How to check each question:**
- Search the question verbatim in Google (note any Featured Snippet or AI Overview citing Job Genie)
- Search in ChatGPT, Perplexity, or Gemini (note any direct citation of `jobgenie.app`)
- Mark **Y** if Job Genie is cited or wins the Featured Snippet in *any* engine; **N** if not cited anywhere
- Add a brief note column entry for any Y result (which engine, what was quoted)

**Target:** All 17 marked Y by month 12 of active optimisation.

| # | Question | Jun 2026 | Jul 2026 | Aug 2026 | Sep 2026 | Oct 2026 | Nov 2026 | Notes |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 1 | Why am I not hearing back from any of my job applications? | N | — | — | — | — | — | Baseline: site newly published; no AI engine has indexed Job Genie content yet |
| 2 | Is it normal to apply to 100+ jobs and get no response in 2026? | N | — | — | — | — | — | Baseline |
| 3 | Why do recruiters ghost candidates, even after interviews? | N | — | — | — | — | — | Baseline |
| 4 | I got ghosted after a final interview or verbal offer — what does it mean? | N | — | — | — | — | — | Baseline |
| 5 | Are ghost jobs real, or am I imagining it? | N | — | — | — | — | — | Baseline: Google AI Overview cited ResumeBuilder.com and LinkedIn (core probe Q3) |
| 6 | How can I tell if a job posting is real before I waste time applying? | N | — | — | — | — | — | Baseline |
| 7 | Does my resume really get auto-rejected by ATS bots? | N | — | — | — | — | — | Baseline |
| 8 | Do I really have to tailor my resume for every single job? | N | — | — | — | — | — | Baseline |
| 9 | Should I use an AI tool to auto-apply to hundreds of jobs? | N | — | — | — | — | — | Baseline |
| 10 | Is it better to apply to more jobs or fewer, better-targeted ones? | N | — | — | — | — | — | Baseline |
| 11 | How do I find jobs that are not posted publicly? | N | — | — | — | — | — | Baseline |
| 12 | Is networking really the only way to get hired now? | N | — | — | — | — | — | Baseline |
| 13 | Is it true that 70–80% of jobs are filled through the hidden job market? | N | — | — | — | — | — | Baseline |
| 14 | I have years of experience — why am I struggling to get interviews? | N | — | — | — | — | — | Baseline |
| 15 | What is the Recruiter-Fit Gap? | N | — | — | — | — | — | Baseline: Meta AI did not recognise term (core probe Q5) |
| 16 | What is the hidden job market? | N | — | — | — | — | — | Baseline |
| 17 | What is an Application Silence Score? | N | — | — | — | — | — | Baseline: Perplexity noted term not widely indexed yet (core probe Q2) |

### Month 1 Appendix A Summary (June 2026)

**Baseline date:** 2026-06-30  
**Cited count: 0 / 17**

All 17 questions return no Job Genie citation in any AI engine. This is consistent with the 0/5 core probe result and the expected state for a site in its first month of publication. The `llms.txt` is live; AI retrieval engines (Perplexity, Google AI Overview) are most likely to begin citing first as they use live web retrieval rather than static training data.

**Priority questions for Month 2 (highest citation potential):**

| Priority | Question # | Reason |
|---|---|---|
| 1 | Q17 — Application Silence Score | Branded term; exact-match search; Perplexity already aware it exists |
| 2 | Q15 — Recruiter-Fit Gap | Branded term; low competition; definition-style answer is snippet-friendly |
| 3 | Q16 — Hidden job market | High search volume; Job Genie has a dedicated page |
| 4 | Q5 — Are ghost jobs real? | High volume; Job Genie's ghost jobs page is published |
| 5 | Q13 — 70–80% hidden job market stat | Specific statistic; snippet-friendly; cited in Job Genie content |

### Appendix A Running Score History

| Month | Date | Cited (of 17) | Δ | Notes |
|---|---|:---:|---|---|
| 1 | 2026-06-30 | 0/17 | — | Baseline; site newly published |
| 2 | 2026-07-30 | — | — | Scheduled |
| 3 | 2026-08-31 | — | — | Scheduled |
| 4 | 2026-09-30 | — | — | Scheduled |
| 5 | 2026-10-31 | — | — | Scheduled |
| 6 | 2026-11-30 | — | — | Scheduled |
