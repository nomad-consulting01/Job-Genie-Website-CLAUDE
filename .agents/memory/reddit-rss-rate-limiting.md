---
name: Reddit RSS rate limiting
description: How Reddit rate-limits RSS feeds from Replit IPs and the mitigations in place.
---

## The rule
Reddit aggressively 429s RSS requests when the same IP fires multiple requests within seconds. Once rate-limited, retries within ~10 minutes from the same IP will keep failing.

**Why:** Replit IPs are shared/datacenter IPs. Reddit treats rapid burst requests as bot activity and throttles them hard.

## Impact on the listing scraper
- Running the scraper manually during a development session (after many test requests) will see most subreddits fail with 429.
- The daily scheduled run at 2 AM on a "cold" IP will succeed because there's been no prior activity.

## Mitigations in place
- `fetchRssWithRetry`: 3 attempts with delays 1s → 10s → 30s before giving up on a single URL.
- `runListingScraper`: 30s + random jitter (0–10s) between each subreddit URL.
- Errors are logged and skipped — the scraper continues to the next URL rather than aborting.

## How to apply
- Never trigger the listing scraper manually during active dev sessions (it will mostly 429).
- Trust the 2 AM cron — that's when it works.
- If you need to test a new subreddit URL, test it individually via `scrape-url` admin endpoint, not by triggering the full scraper batch.
