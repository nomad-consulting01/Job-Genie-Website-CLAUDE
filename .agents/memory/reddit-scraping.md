---
name: Reddit scraping constraints
description: Reddit blocks JSON API from Replit datacenter IPs; RSS feed works; use RSS for server-side ingest.
---

# Reddit Scraping Constraints

## The rule
Reddit's JSON API (`www.reddit.com/*.json`) returns **403 from all datacenter/cloud IPs** including Replit dev and production servers. The RSS feed (`www.reddit.com/r/SUB.rss`) returns **200** and is the only unauthenticated server-side path.

**Why:** Reddit uses Cloudflare + IP-range blocking for programmatic access. They want devs to use OAuth. CORS proxies (corsproxy.io, allorigins.win) also return 403 because they're also in datacenter ranges.

**How to apply:**
- Loop 1 scheduled ingest → uses `fetchSubredditRss()` (works everywhere)
- `scrapeRedditPost(url)` → uses JSON API (works from residential/non-datacenter IPs only; gives clear 403 error message in dev)
- New Reddit share links (`/r/SUB/s/XXXX`) also 403 server-side AND require browser JS to resolve
- The scraper code is correct; the 403 is purely an IP-range issue, not a code bug
