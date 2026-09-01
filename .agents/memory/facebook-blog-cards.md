---
name: Facebook blog cards
description: The required Facebook publishing format for Job Genie blog shares.
---

Publish Job Genie blog shares through Facebook's `/feed` endpoint as link shares. Let Facebook construct the clickable card from the blog page's Open Graph title, description, and image.

**Why:** The user confirmed the older clickable link-preview card is the intended format. Posting through `/photos` produces a native photo post with the URL only in the caption, which looks and behaves differently.

**How to apply:** Keep the blog URL as the Graph API `link` parameter. Do not switch to `/photos` merely because a featured image exists. Ensure distribution queries exclude internal sentinel slugs such as `_cannibalised`.