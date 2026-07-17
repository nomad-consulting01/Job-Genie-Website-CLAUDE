# Recursive Voice-Optimization Loop — Human Runbook

## Overview

The voice-optimization loop is a closed, self-improving system that learns which blog-copy voice maximizes Facebook engagement. It uses a multi-armed bandit (Thompson sampling) to bias the next batch of blog-post variants toward proven voices while still exploring new ones.

**Every publish decision and every weekly self-improvement proposal requires explicit human approval.**

---

## Architecture (7 Stations)

| Station | Name | Cadence | Output |
|---------|------|---------|--------|
| ① | FB Metrics Ingest | Daily | `data/fb-metrics-daily.json` |
| ② | Attribution Join | Daily (after ①) | `data/variant-attribution.json` |
| ③ | Voice Ledger Update | Daily (after ②) | `data/voice-ledger.json` |
| ④ | Multi-Voice Variant Generator | On new blog post | Voice variants in DB |
| ⑤ | Human Review (Admin Dashboard) | On-demand | Approved/rejected variants |
| ⑥ | Publish & Tag | On approval | `data/published-variants.json` |
| ⑦ | Weekly Self-Improvement | Weekly (Sunday 1 AM) | `docs/voice-library-changelog.md` proposal |

---

## Daily Operations

### What runs automatically (no human needed)

- **Stations ①–③** run daily at 7 AM (after Loop 4's Facebook post). They pull real metrics from the Meta Graph API and update the sampling policy. Check server logs for any missing-permission warnings.

### What requires human review

- **Station ⑤** — Voice variants appear in the `/admin/corpus` → **Voice Variants** tab. For each blog post, 5 variants (one per voice) are shown side-by-side. Review each, then:
  - **Approve** — marks the variant for publishing
  - **Edit then Approve** — edit the copy inline, then approve
  - **Reject** — auto-rejected with a reason; the next-best variant is not auto-published

- **Station ⑦** — Weekly proposals appear in the **Voice Variants** tab under the "Self-Improve" card. Review the proposed voice-library diff and evidence, then:
  - **Apply** — writes the change to `content/voice-library.json`
  - **Dismiss** — discards the proposal (it remains in the changelog for audit)

---

## Reviewing Voice Variants (Station ⑤)

1. Navigate to `/admin/corpus` → **Voice Variants** tab.
2. Each blog post shows a card with up to 5 variant panels.
3. Each panel shows:
   - **Voice label** (e.g. "Sabri Suby Direct Response")
   - **Predicted score** from the ledger (shown as "–" until 500+ impressions)
   - **Guardrail status**: ✅ Pass or 🚫 Blocked (with reason)
   - **Full generated body text**
4. Click **Approve** on the variant you want published. Only approved variants reach the publish route.
5. Publishing is **not possible** without a recorded approval (enforced server-side).

---

## Reviewing the Voice-Performance View (Station ③)

The ledger at `data/voice-ledger.json` shows:

```json
{
  "arms": {
    "sabri_suby_dr:career_advice:job_seekers:blog_post": {
      "alpha": 12.4,
      "beta": 3.1,
      "mean": 0.80,
      "impressions": 1840,
      "status": "active"
    }
  }
}
```

- **alpha / beta** — Beta distribution parameters (successes / failures)
- **mean** — current expected composite score (alpha / (alpha + beta))
- **impressions** — total impressions seen; arms below 500 are "under_test"
- **status** — `active`, `under_test`, `retired`

Higher `mean` → higher probability of being selected in the next exploit round.

---

## Reviewing Self-Improvement Proposals (Station ⑦)

1. Navigate to `/admin/corpus` → **Voice Variants** tab → scroll to "Self-Improve Proposals".
2. Each proposal shows:
   - **Evidence**: which arms underperformed / overperformed
   - **Proposed diff**: what changes to `content/voice-library.json`
   - **New voice spec** (if a new voice is being spawned from winning patterns)
3. Click **Apply** to commit the change, or **Dismiss** to discard.
4. All proposals (applied and dismissed) are logged to `docs/voice-library-changelog.md`.

---

## Dry-Run

```bash
pnpm --filter @workspace/api-server run voice-loop:dry-run
```

This runs all 7 stations end-to-end with **no live publishing**. If the `FACEBOOK_PAGE_ACCESS_TOKEN` is absent, it uses mock metrics. Output is a structured report covering:

- Files created/updated
- FB metrics pulled (or mock mode reason)
- Missing permissions (if any)
- Seed voice library
- Objective-function config
- Variants generated + guardrail results
- Proof that publishing requires approval
- Confirmation that nothing was published autonomously

---

## Budget Cap

Set `VOICE_LOOP_BUDGET_USD` (default: `2.00`). If a run's estimated LLM spend would exceed this cap, the run halts and logs a warning. The cap applies per run (not cumulative).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VOICE_LOOP_BUDGET_USD` | `2.00` | Hard cap on LLM spend per run |
| `VOICE_LOOP_MIN_IMPRESSIONS` | `500` | Minimum impressions before an arm is considered for exploit |
| `VOICE_LOOP_EXPLORE_WEIGHT` | `0.25` | Fraction of variants reserved for exploration |
| `FACEBOOK_PAGE_ID` | — | Facebook Page ID for Graph API |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | — | Page-scoped access token |

---

## Files

| File | Description |
|------|-------------|
| `content/voice-library.json` | Voice spec definitions and sampling policy |
| `data/fb-metrics-daily.json` | Raw Facebook metrics (idempotent rows) |
| `data/variant-attribution.json` | Attribution join: post → variant → metrics |
| `data/voice-ledger.json` | Thompson-sampling arm state |
| `data/published-variants.json` | post_id ↔ variant_id mapping |
| `docs/voice-library-changelog.md` | Append-only audit log of voice-library proposals |
