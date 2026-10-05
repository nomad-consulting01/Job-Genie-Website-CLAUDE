---
name: Sandbox preview section targeting
description: A preview-capture quirk when targeting sections of long sandbox mockups.
---

Prefer query-free sandbox preview URLs. For section targeting, use a URL fragment or navigation inside the preview.

**Why:** Homepage comparison captures with a section query parameter repeatedly showed only a blank navy background despite clean browser logs and successful HTTP responses. The same components rendered correctly without the query parameter, including fragment-based section targeting. The underlying cause was not established; do not assume a successful response proves that the preview rendered.

**How to apply:** When a sandbox preview is blank without a browser error, compare the query-free URL before changing the component or restarting a healthy server. Verify the visible content before presenting it.

Long-page section captures can also show the wrong viewport or a blank background while scrolling or entrance animations are active, even when the compiled HTML contains the section.

**Why:** During homepage graduation, live fragment captures returned the hero, and full static fragment captures were blank. Isolated compiled sections with scrolling and animations disabled rendered correctly.

**How to apply:** Treat a blank section capture as inconclusive rather than proof of a broken page. For static layout verification, isolate the compiled section and disable motion in a temporary snapshot; check live functionality separately and remove the snapshot afterward.