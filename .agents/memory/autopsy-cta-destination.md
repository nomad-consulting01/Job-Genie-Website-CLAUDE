---
name: Autopsy CTA destination
description: Why Job Genie marketing CTAs currently lead to the branded signup page rather than the diagnostic tool.
---

Marketing calls to action for both the free Autopsy and the Pro offer should currently point to the branded `/free-autopsy` email signup page. This is a deliberate product choice, even though the diagnostic tool is a separate app and the signup page does not immediately run it or open a Pro checkout.

**Why:** The user explicitly preferred a branded signup destination over sending visitors to an unbranded working tool and a short link. Relabel Pro buttons honestly rather than implying that the signup form immediately sells Pro access.

**How to apply:** When editing marketing CTAs, preserve this routing until the user provides a branded diagnostic-tool or checkout destination. Do not silently restore external tool links or promise immediate results from the email form.

Every CTA button on the homepage at `https://www.job-genie.ai/` must navigate to `https://www.job-genie.ai/free-autopsy/`, including the trailing slash.

**Why:** The user explicitly requested one destination for all homepage CTA buttons.

**How to apply:** Preserve this homepage-wide conversion destination when adding or changing CTAs; do not redirect menu toggles or FAQ expanders, which are interface controls rather than CTAs.