# Reddit AEO Loop — System Documentation

**Source adapted from:** SolCrys, "Reddit AEO Playbook: Earn AI Citations Without Becoming Spam" (solcrys.com/reddit-aeo-playbook, 2026-05-06).

---

## Critical Guardrail

Reddit AEO works because the participation is **authentic**. The system collapses if it is faked.

**The agent builds the system. Humans run the loop. Nothing is automated.**

| Hard rule | Rationale |
|---|---|
| Never auto-post, auto-comment, or auto-DM on Reddit | Automated output is detected, down-weighted, and destroys trust |
| Never generate sock-puppet content | One real named human per active account |
| Never build upvote automation | TOS violation, detectable |
| Never cross-post Job Genie blog content programmatically | Communities downvote brand cross-posts |
| Never fabricate citation-audit data | Audit integrity is the only signal worth having |

---

## The Loop: Three Nested Cadences

```
WEEKLY       → Participate, log, defend
MONTHLY      → One long-form post; cadence review
QUARTERLY    → Deep-dive; re-map subreddits; 90-day citation audit
```

Feedback wiring:
- **Station ⑥ (Measure) → Station ① (Map):** citation frequency re-ranks priority subs
- **Station ⑥ → Site content:** newly observed questions become candidate FAQs/landing pages (human review required)

---

## Human/Agent Split

| Station | Cadence | Agent builds | Humans do |
|---|---|---|---|
| ① MAP | Quarterly | `content/reddit-prompt-set.json`, `content/reddit-targets.json`, admin ranking view | Run prompts in ChatGPT/Perplexity, record which subs cited, confirm top 2–3 |
| ② STAGE | Once, then maintain | `docs/reddit-disclosure-templates.md`, `content/reddit-accounts.json` | Create real-name accounts, paste disclosure bio, age accounts ~30 days before any product mention |
| ③ PARTICIPATE | Weekly | `docs/reddit-answer-kit.md`, cadence tracker + 80/20 ratio view | Write and post comments in own words (3–5 substantive/week/account); 80% help, 20% mention |
| ④ AUTHOR | Quarterly | `docs/reddit-deepdive-template.md` scaffold | Turn scaffold into genuine personally-authored long-form post, publish under real name |
| ⑤ DEFEND | Continuous | `content/reddit-mentions-log.json`, `docs/reddit-criticism-response.md`, mentions triage view | Respond personally and transparently under real name |
| ⑥ MEASURE | Months 0/3/6/9/12 | `content/reddit-citation-audits.json`, citation-lift trend dashboard, feedback export | Run prompt-set audits, review dashboard, never fabricate results |

---

## Cadence Calendar

### Weekly (every week once accounts are active)
- [ ] Check cadence tracker for missed streaks (admin dashboard → Reddit AEO)
- [ ] Review `r/jobs` and priority subs for new threads matching prompt-set topics
- [ ] Each active account: 3–5 substantive comments using Answer Kit material (own words)
- [ ] Log all activity in engagement log (admin → log entry form)
- [ ] Check mentions queue; triage any new criticism
- [ ] Verify 80/20 ratio is on track (dashboard warns if drifting)

### Monthly
- [ ] One long-form post per active account (use deep-dive scaffold if quarterly)
- [ ] Review cadence streaks; identify gaps and address before next week
- [ ] Spot-check Answer Kit for accuracy vs current citable-stats bank

### Quarterly
- [ ] Re-run the full prompt set in ChatGPT + Perplexity + Gemini
- [ ] Record results in `content/reddit-citation-audits.json` (admin → add audit run)
- [ ] Review citation-lift trend in dashboard; compare to baseline
- [ ] Re-rank subreddits in `content/reddit-targets.json` by observed citation frequency
- [ ] Confirm/update top 2–3 priority subs
- [ ] Export newly observed questions to landing-page drafts (admin → feedback export)
- [ ] One team member authors and publishes a deep-dive post

---

## Bootstrap: First 12 Weeks

| Phase | Weeks | Human activity | Agent has ready |
|---|---|---|---|
| Setup | 1–2 | Map 2–3 priority subs; create real-name accounts + disclosure bios; read last 30 days of top posts | Prompt set, subreddit tracker, disclosure templates, accounts registry |
| Build presence | 3–6 | 3–5 substantive comments/week/account; **zero product mentions** | Cadence tracker live; Answer Kit (help-only mode) |
| Author & engage | 7–12 | Maintain cadence; ship one long-form post; begin answering category questions substantively | Deep-dive scaffold; criticism triage log |
| Sustain & compound | 13+ | Weekly cadence continues; one deep-dive/quarter; product-relevance comments grow toward ~20% | Citation-lift dashboard; feedback export to site content |

---

## Files in This Module

| File | Purpose |
|---|---|
| `content/reddit-prompt-set.json` | Audit prompt set (17 prompts across 9 clusters) |
| `content/reddit-targets.json` | Subreddit priority tracker (6 candidates) |
| `content/reddit-accounts.json` | Accounts registry (handles only) |
| `content/reddit-engagement-log.json` | Weekly engagement log |
| `content/reddit-mentions-log.json` | Mentions and criticism triage queue |
| `content/reddit-citation-audits.json` | Citation-lift audit store |
| `docs/reddit-disclosure-templates.md` | Profile bio + in-comment disclosure templates |
| `docs/reddit-answer-kit.md` | Vetted talking points by topic (15 kits) |
| `docs/reddit-deepdive-template.md` | Quarterly long-form post scaffold |
| `docs/reddit-criticism-response.md` | Criticism response checklist (four-move pattern) |
| Admin → Reddit AEO | Dashboard: cadence, mentions queue, citation trend |

---

## What This System Does NOT Do

- Does not post to Reddit on behalf of any user
- Does not generate comments intended to be pasted verbatim
- Does not simulate multiple accounts
- Does not fabricate citation data
- Does not monitor Reddit in real-time (Reddit API credentials not required for this module — ingestion uses existing `src/integrations/reddit.ts`)
