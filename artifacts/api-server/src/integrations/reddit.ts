import { logger } from "../lib/logger.js";

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  ups: number;
  subreddit: string;
  permalink: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env["REDDIT_CLIENT_ID"];
  const clientSecret = process.env["REDDIT_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    logger.warn("REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set — skipping Reddit ingestion");
    return null;
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": `JobGenie/1.0 (by /u/${process.env["REDDIT_USERNAME"] ?? "JobGenieBot"})`,
    },
    body: "grant_type=client_credentials",
  });

  if (!resp.ok) {
    logger.error({ status: resp.status }, "Reddit OAuth token request failed");
    return null;
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export async function searchSubreddit(
  subreddit: string,
  query: string,
  limit = 10
): Promise<RedditPost[]> {
  const token = await getAccessToken();
  if (!token) return [];

  await new Promise((r) => setTimeout(r, 600));

  const url = `https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=top&t=month&limit=${limit}&restrict_sr=1`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": `JobGenie/1.0 (by /u/${process.env["REDDIT_USERNAME"] ?? "JobGenieBot"})`,
    },
  });

  if (!resp.ok) {
    logger.error({ status: resp.status, subreddit, query }, "Reddit search failed");
    return [];
  }

  const data = (await resp.json()) as {
    data: { children: Array<{ data: RedditPost }> };
  };

  return data.data.children
    .map((c) => c.data)
    .filter((p) => p.selftext && p.selftext.length > 50);
}

export interface IngestedPainPoint {
  source: "reddit";
  sourceUrl: string;
  rawText: string;
  engagementSignal: number;
}

export async function ingestFromReddit(
  subreddits: string[],
  queries: string[],
  maxTotal: number
): Promise<IngestedPainPoint[]> {
  const results: IngestedPainPoint[] = [];

  outer: for (const subreddit of subreddits) {
    for (const query of queries) {
      if (results.length >= maxTotal) break outer;
      const posts = await searchSubreddit(subreddit, query, 5);
      for (const p of posts) {
        if (results.length >= maxTotal) break;
        results.push({
          source: "reddit",
          sourceUrl: `https://reddit.com${p.permalink}`,
          rawText: `${p.title}\n\n${p.selftext}`.slice(0, 2000),
          engagementSignal: p.ups,
        });
      }
    }
  }

  logger.info({ count: results.length }, "Reddit ingestion complete");
  return results;
}
