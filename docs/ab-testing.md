# Job Genie — A/B Testing Guide

---

## 1. Overview

Job Genie uses a deterministic, hash-based A/B testing system that requires no server-side infrastructure. Variants are assigned at page load using a hashed `visitor_id` stored in `localStorage`, so the same visitor always sees the same variant across sessions.

Experiment configuration lives in `content/ab-tests.json`. The React app reads this file and applies overrides at render time.

---

## 2. Assignment Algorithm

```
variant = sha256(experiment_id + ":" + visitor_id) % 100
```

Visitors are bucketed into slots 0–99. Each variant has a cumulative weight threshold:

```
Variant A (weight 0.34) → slots 0–33
Variant B (weight 0.33) → slots 34–66
Variant C (weight 0.33) → slots 67–99
```

The `visitor_id` is generated on first visit:
```javascript
// Pseudocode — see actual implementation in useExperiment hook
const id = localStorage.getItem("jg_visitor_id") ?? crypto.randomUUID();
localStorage.setItem("jg_visitor_id", id);
```

This ensures:
- Same visitor always sees the same variant (no flickering)
- No server infrastructure needed
- Variant assignment is reproducible for debugging

---

## 3. Configuration in `content/ab-tests.json`

### Schema
```json
{
  "_meta": { "version": "...", "docs": "docs/ab-testing.md" },

  "experiments": [
    {
      "id": "unique_experiment_id",
      "name": "Human-readable name",
      "status": "active | paused | completed | archived",
      "page": "home | ghost-jobs | ...",
      "dimension": "h1 | direct_answer | cta_headline | cta_button_text | faq_order | hero_subheadline",
      "traffic_split": 1.0,
      "variants": [
        {
          "id": "control",
          "name": "Control — description",
          "weight": 0.5,
          "overrides": {}
        },
        {
          "id": "variant_b",
          "name": "Variant B — description",
          "weight": 0.5,
          "overrides": {
            "key": "value"
          }
        }
      ],
      "primary_metric": "cta_click_rate",
      "secondary_metrics": ["scroll_depth_50"],
      "started_at": "2026-06-01",
      "min_sample_per_variant": 200
    }
  ],

  "archived": [ ... completed experiments ... ]
}
```

### Fields reference

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier — used in hash assignment |
| `status` | enum | `active` → running; `paused` → suspended; `completed` → winner declared; `archived` → moved to `archived` array |
| `page` | string | Which page this experiment applies to |
| `dimension` | string | What element is being tested |
| `traffic_split` | 0–1 | Fraction of visitors in the experiment (1.0 = 100%) |
| `variants[].weight` | 0–1 | Fraction of experiment traffic (must sum to 1.0) |
| `variants[].overrides` | object | Key-value pairs applied to the page component |
| `primary_metric` | string | The metric that determines the winner |
| `min_sample_per_variant` | int | Minimum sample before reading results |

---

## 4. Available Dimensions and Overrides

| Dimension | Override key(s) | Applies to |
|---|---|---|
| `h1` | `headline_line1`, `headline_line2`, `headline_line3` | Home hero |
| `direct_answer` | `direct_answer_text` | Home direct-answer section / AEO pages |
| `cta_headline` | `cta_headline` | CTA section heading |
| `cta_button_text` | `button_text` | Primary CTA button |
| `faq_order` | `faq_order` (array of question IDs) | FAQ accordion order |
| `hero_subheadline` | `hero_subheadline` | Hero sub-headline below H1 |

---

## 5. How to Add a New Experiment

1. **Define a hypothesis** — What do you expect the variant to improve, and why?
   > "Changing the CTA button from 'Run My Free Autopsy' to 'Get My Application Silence Score' will improve CTR because the second copy names the specific output the user will receive."

2. **Choose a dimension** from the table above, or add a new one (requires adding override handling to the relevant component).

3. **Add the experiment** to `content/ab-tests.json`:
   ```json
   {
     "id": "home_cta_btn_score_vs_autopsy",
     "name": "CTA button: Score vs Autopsy copy",
     "status": "active",
     "page": "home",
     "dimension": "cta_button_text",
     "traffic_split": 1.0,
     "variants": [
       { "id": "control", "weight": 0.5, "overrides": { "button_text": "Run My Free Autopsy →" } },
       { "id": "variant_b", "weight": 0.5, "overrides": { "button_text": "Get My Application Silence Score →" } }
     ],
     "primary_metric": "cta_click_rate",
     "min_sample_per_variant": 200,
     "started_at": "2026-06-17"
   }
   ```

4. **Wire the override** in the relevant React component. The `useExperiment(experimentId)` hook returns the active variant's `overrides` object:
   ```tsx
   import { useExperiment } from "@/hooks/useExperiment";

   function CTASection() {
     const { overrides } = useExperiment("home_cta_btn_score_vs_autopsy");
     const buttonText = overrides?.button_text ?? "Run My Free Autopsy →";
     // ...
   }
   ```

5. **Fire an analytics event** when the primary metric action occurs:
   ```tsx
   // On CTA click:
   analytics.track("cta_click", {
     experiment_id: "home_cta_btn_score_vs_autopsy",
     variant_id: activeVariant.id,
     page: "home",
   });
   ```

6. **Set a review reminder** for when `min_sample_per_variant` is reached.

---

## 6. Reading Results in the Admin Dashboard

Navigate to `/admin` (requires ADMIN_TOKEN) to view experiment results. The dashboard shows:

- Variant impression counts
- Primary metric rates per variant
- Statistical significance estimate (Z-test, requires min sample)
- P-value and confidence interval

**Minimum sample rule:** Do not read results until each variant has reached `min_sample_per_variant` impressions. Reading early inflates false-positive rates.

---

## 7. Declaring a Winner

1. Verify `min_sample_per_variant` is met for all variants.
2. Check statistical significance: p ≤ 0.05 required; p ≤ 0.01 preferred.
3. Check secondary metrics — ensure the winner did not harm scroll depth or time-on-page.
4. **Declare the winner:**
   - Update the experiment `status` to `"completed"`
   - Add `"winner": "variant_id"` and `"completed_at": "YYYY-MM-DD"` fields
   - Apply the winning variant's `overrides` as the new default in the component
   - Remove the `useExperiment` hook from the component

5. **Archive the experiment:**
   - Move the experiment object from `"experiments"` to `"archived"`
   - Add `"archived_reason": "Winner applied as default"` to the archived entry

6. **Document the result** — Add a row to the A/B test results log (create `docs/ab-test-results.md` if needed):
   ```
   | Date | ID | Dimension | Winner | Improvement | Sample |
   ```

---

## 8. Backward Compatibility with `experiments.json`

The legacy file `artifacts/job-genie/src/data/experiments.json` remains in place for components that import it directly. The original `home_headline_test` experiment has been migrated to `home_h1_framing` in `content/ab-tests.json` with a third C variant added.

If a component imports `experiments.json` directly, update it to use `useExperiment()` and the canonical `content/ab-tests.json` format instead. The `experiments.json` file is effectively frozen — no new experiments should be added there.

---

## 9. Statistical Significance Calculator

Quick reference for minimum sample sizes (α=0.05, power=0.80, two-tailed):

| Expected lift | Min sample per variant |
|---|---|
| 5% relative improvement | ~1,600 |
| 10% relative improvement | ~400 |
| 20% relative improvement | ~100 |
| 50% relative improvement | ~20 |

At typical traffic volumes, set `min_sample_per_variant` to **200** for most CTA tests, **500** for scroll-depth tests (noisier metric), and **100** for direct-answer tests (large expected effect).
