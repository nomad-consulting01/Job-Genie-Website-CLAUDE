# Job Genie — Recursive Optimisation Loop

The 8-step monthly loop that keeps content compounding in AEO/GEO performance.

---

## Overview

AEO/GEO is not a one-time task. Content decays: AI training windows close, statistics age out, competitors publish competing answers, and Google's Featured Snippet selection rotates. The recursive loop is Job Genie's answer to this: a structured monthly practice that treats content as an asset to be maintained, not a deliverable to be shipped.

Think of each iteration as improving Job Genie's own **Application Silence Score** — measuring visibility gaps and closing them systematically.

---

## The 8 Steps

### Step 1: Publish or Update a Page

At the start of each cycle, decide which pages to focus on:

- **New pages:** Identify questions from Loop 1 corpus (the `/admin/corpus` Q&A engine) that have reached enough volume to merit a full AEO landing page, rather than just a `/qa/:slug` corpus entry.
- **Updates:** Pages that failed the previous month's manual probes, or pages with low impressions in Google Search Console.

**Action:** Create or update the page entry in `landing-pages.ts`, commit, deploy.  
**Tool:** `pnpm run seo:audit` — must exit 0 before publishing.

---

### Step 2: Track Performance

After publishing, set up tracking across two channels:

#### 2a. Analytics (AEO — search-visible)
In Google Search Console, track impressions and clicks for the page's primary question and secondary questions. Also track:
- `direct_answer_visible` event (does the user scroll to it?)
- `cta_click` conversion rate
- `faq_expanded` rate per FAQ item

#### 2b. Monthly Manual Probes (GEO — AI-visible)

Run these 5 probes each month and record in `docs/geo-probe-log.md` (create if absent):

| # | Question | Engine |
|---|---|---|
| 1 | "Why do my job applications get no response?" | ChatGPT (GPT-4o) |
| 2 | "What is an Application Silence Score?" | Perplexity |
| 3 | "Are ghost jobs real?" | Google AI Overview |
| 4 | "Why am I getting no response after 100 applications?" | Gemini |
| 5 | "What is the Recruiter-Fit Gap?" | Meta AI |

**For each probe, record:**
- Is Job Genie cited? (Y/N)
- What text was quoted? (copy exact quote)
- What source was cited? (direct URL or "general knowledge")
- Date of probe

**GEO visibility score** = number of probes where Job Genie is cited (0–5).

#### 2c. Track all 17 Appendix A questions

The 17 questions are Job Genie's tracked prompt set. Each month, check if any have slipped out of Featured Snippets or AI answers. Prioritise the ones with the highest search volume first.

The 17 Appendix A questions:
1. Why am I not hearing back from any of my job applications?
2. Is it normal to apply to 100+ jobs and get no response in 2026?
3. Why do recruiters ghost candidates, even after interviews?
4. I got ghosted after a final interview or verbal offer — what does it mean?
5. Are ghost jobs real, or am I imagining it?
6. How can I tell if a job posting is real before I waste time applying?
7. Does my resume really get auto-rejected by ATS bots?
8. Do I really have to tailor my resume for every single job?
9. Should I use an AI tool to auto-apply to hundreds of jobs?
10. Is it better to apply to more jobs or fewer, better-targeted ones?
11. How do I find jobs that are not posted publicly?
12. Is networking really the only way to get hired now?
13. Is it true that 70–80% of jobs are filled through the hidden job market?
14. I have years of experience — why am I struggling to get interviews?
15. What is the Recruiter-Fit Gap?
16. What is the hidden job market?
17. What is an Application Silence Score?

---

### Step 3: Identify Low-Performing Sections

After collecting a month of data, flag content that is underperforming:

| Signal | Threshold | Action |
|---|---|---|
| Page impressions | 0 after 30 days | Check indexing; resubmit to GSC |
| Featured Snippet win | Not won after 60 days | Revise direct-answer block |
| GEO probe pass | 0/5 for 2 months | Review entity consistency + llm-summary |
| FAQ expansion rate | <5% per item | Reorder FAQ; rewrite lower-performing questions |
| CTA click rate | <2% | A/B test CTA copy |
| `direct_answer_visible` rate | <40% of page visits | Move section higher |

---

### Step 4: Generate Alternate Variants

For any section identified as underperforming, generate 2–3 alternate versions to test:

#### For direct-answer blocks
Variants should test different framings of the same answer:
- **Research-led** ("Research finds X%...") vs **Outcome-led** ("If you have sent 100 applications and heard nothing...")
- **Named-phenomenon first** ("Application Silence is the experience of...") vs **Question-answer direct** ("Job applications go silent because...")
- **Statistic-first** vs **Mechanism-first**

#### For H1 variants
Test different question/statement framings:
- Question H1 ("Why Are My Job Applications Going Unanswered?") vs Statement H1 ("100 Applications. Zero Interviews.")
- Pain-state H1 vs Solution-state H1
- Numeric H1 vs Conceptual H1

#### For CTA copy
Test:
- Output-naming ("Get My Application Silence Score") vs Action-naming ("Run My Free Autopsy")
- Speed emphasis ("2-minute diagnosis") vs outcome emphasis ("Find what's blocking you")
- First-person ("Get My Free...") vs Second-person ("Diagnose My...")

**Use Claude via the content engine** to generate additional variants:
```bash
curl -X POST https://<host>/api/admin/corpus/questions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"raw_text": "Generate 3 alternate direct-answer blocks for: ...", "source": "manual"}'
```

---

### Step 5: A/B Test via `content/ab-tests.json`

For each variant identified in Step 4:

1. Add the experiment to `content/ab-tests.json` (see `docs/ab-testing.md`)
2. Wire the `useExperiment()` hook in the relevant component
3. Fire the appropriate analytics events
4. Set `min_sample_per_variant` and a review date
5. Deploy

Do not run more than 3 active experiments on the same page simultaneously — interactions between experiments inflate noise.

---

### Step 6: Keep the Winner, Archive the Loser

When `min_sample_per_variant` is reached and statistical significance is confirmed:

1. Declare the winner — update the experiment `status` to `"completed"`
2. Apply the winning variant as the new default in the component code
3. Remove the `useExperiment()` hook
4. Move the experiment to `archived` in `content/ab-tests.json`
5. Document the result in `docs/ab-test-results.md`

**No winner after min sample?**
- If p > 0.05 after 2× min sample, the test is inconclusive
- Keep the control as default (do not apply a non-significant variant)
- Archive the experiment as `"no_significant_difference"`
- Try a larger change in the next cycle

---

### Step 7: Refresh Stats, Examples, and "Last Updated" Date

Every page that contains statistics should be reviewed at its 12-month anniversary (or sooner if the source publishes new data):

1. Check if the cited study has been updated (e.g., annual surveys)
2. Replace outdated stats with newer data if available
3. Update the `sources:` array in `landing-pages.ts`
4. Update the `<lastmod>` in `sitemap.xml`
5. Add/update a visible "Last reviewed: [Month Year]" note in the page's llm-summary or footer

**Stats with known annual cadence:**
- Resume Builder ghost job survey — typically annual
- MyPerfectResume ghost job survey — typically annual
- SHRM referral hire data — annual report
- ResumeUp.AI ghost job analysis — first published Sep 2025; check for updates

Run `pnpm run seo:audit` after any stat update to verify citation compliance.

---

### Step 8: Repeat Monthly

On the same day each month:

1. Pull GEO probe log from previous month
2. Pull GSC impression/click data for all 17 Appendix A questions
3. Pull analytics for direct_answer_visible, cta_click, faq_expanded
4. Score each page against the thresholds in Step 3
5. Prioritise 1–3 pages for this cycle's improvement work
6. Loop back to Step 1

---

## Monthly Checklist

```
[ ] Run pnpm run seo:audit — fix any FAIL
[ ] Run 5 GEO manual probes — record in geo-probe-log.md
[ ] Check GSC for 17 Appendix A queries — any at 0 impressions?
[ ] Check any expired stats (>12 months since study publication)
[ ] Review active A/B tests — any ready to read?
[ ] Trigger Loop 1 via /admin/corpus — process new pain-point questions
[ ] Publish any new Q&A pages that reached quality threshold
[ ] Update sitemap.xml lastmod for changed pages
[ ] Commit and deploy
```

---

## Appendix: The "Application Silence Score of Your Own Visibility"

The GEO probe measures whether Job Genie is audible in AI answers — its own version of the Application Silence problem. If Job Genie's content is not cited when a candidate asks ChatGPT about Application Silence, Job Genie has gone silent to that searcher.

| GEO score (out of 5) | Interpretation | Action |
|---|---|---|
| 5/5 | Dominant entity on this topic | Maintain freshness; expand to adjacent questions |
| 3–4/5 | Visible but not dominant | Strengthen direct-answer blocks on missing probes |
| 1–2/5 | Sporadic visibility | Audit entity consistency + llm-summary copy |
| 0/5 | Invisible to AI search | Re-examine content freshness; check robots.txt; verify llms.txt |

The target is 5/5 by month 6 of active optimisation.
