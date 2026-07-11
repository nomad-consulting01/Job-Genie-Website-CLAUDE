---
name: LLM bulk-endpoint batching
description: Why bulk endpoints that fan out many sequential LLM calls must batch + client-loop instead of running in one request.
---

# Bulk LLM endpoints must batch, not run all-in-one

A single admin action that generates content for many corpus items (e.g. Meta Ads +
Instagram copy for every published blog post) must NOT run all the Claude calls inside
one HTTP request.

**Why:** each item is one Claude call; N items = N sequential calls in a single request,
which blows past the Replit preview proxy / browser fetch timeout. The user sees a
misleading "Generation failed" even though the server keeps working.

**How to apply:**
- Server: accept a `limit` param (small default, capped), select only items still MISSING
  output, process at most `limit` per request, and return `{ generated, remaining, missingTotal }`.
- Client: loop the endpoint until `remaining <= 0`, refreshing UI between batches, with a
  hard iteration cap.
- Add a no-progress guard: if a batch returns `generated === 0` (posts failing repeatedly),
  stop instead of burning the full iteration budget on permanently-failing items.
