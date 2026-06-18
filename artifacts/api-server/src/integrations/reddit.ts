import { logger } from "../lib/logger.js";

export interface IngestedPainPoint {
  source: "reddit";
  sourceUrl: string;
  rawText: string;
  engagementSignal: number;
}

export interface ScrapedPost {
  post: IngestedPainPoint;
  comments: IngestedPainPoint[];
  title: string;
  subreddit: string;
  totalComments: number;
}

const USER_AGENT = "JobGenie/1.0 AEO content engine (educational, read-only)";

interface RedditPostData {
  title: string;
  selftext: string;
  ups: number;
  permalink: string;
  subreddit: string;
  num_comments: number;
}

interface RedditCommentData {
  id: string;
  body: string;
  ups: number;
  permalink: string;
  replies?: { data: { children: RedditCommentWrapper[] } } | "";
}

interface RedditCommentWrapper {
  kind: string;
  data: RedditCommentData;
}

interface RedditListing {
  data: { children: Array<{ kind: string; data: RedditPostData | RedditCommentData }> };
}

function normaliseUrl(url: string): string {
  return url.replace(/\.json$/, "").replace(/\?.*$/, "").replace(/\/$/, "");
}

async function resolveShareLink(url: string): Promise<string> {
  const resp = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": USER_AGENT },
  });
  return normaliseUrl(resp.url);
}

function flattenComments(
  wrappers: RedditCommentWrapper[],
  results: IngestedPainPoint[]
): void {
  for (const w of wrappers) {
    if (w.kind !== "t1") continue;
    const c = w.data as RedditCommentData;
    if (c.body && c.body !== "[deleted]" && c.body !== "[removed]" && c.body.trim().length >= 40) {
      results.push({
        source: "reddit",
        sourceUrl: `https://reddit.com${c.permalink}`,
        rawText: c.body.trim().slice(0, 2000),
        engagementSignal: Math.max(0, c.ups ?? 0),
      });
    }
    if (c.replies && typeof c.replies !== "string" && c.replies.data?.children) {
      flattenComments(c.replies.data.children, results);
    }
  }
}

export async function scrapeRedditPost(inputUrl: string): Promise<ScrapedPost> {
  let canonicalUrl = normaliseUrl(inputUrl);

  const isShareLink = /\/r\/[^/]+\/s\//.test(canonicalUrl) || !/\/comments\//.test(canonicalUrl);
  if (isShareLink) {
    logger.info({ url: canonicalUrl }, "Resolving Reddit share link");
    canonicalUrl = await resolveShareLink(inputUrl);
    if (!/\/comments\//.test(canonicalUrl)) {
      throw new Error(
        "Could not resolve share link to a canonical post URL. " +
        "Open the link in your browser, copy the full URL from the address bar " +
        "(it should contain /comments/), then paste that URL instead."
      );
    }
  }

  const jsonUrl = `${canonicalUrl}.json?limit=500&depth=10`;
  logger.info({ url: jsonUrl }, "Fetching Reddit post JSON");

  await new Promise((r) => setTimeout(r, 500));

  const resp = await fetch(jsonUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    redirect: "follow",
  });

  if (resp.status === 403 || resp.status === 429) {
    throw new Error(
      `Reddit blocked the request (${resp.status}) — this happens from cloud/datacenter IPs. ` +
      "The scraper works correctly; this is a development environment limitation. " +
      "It will work from a deployed production server or from your local machine."
    );
  }

  if (!resp.ok) {
    throw new Error(`Reddit returned ${resp.status} for ${jsonUrl}`);
  }

  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new Error(`Expected JSON but got ${contentType}. The URL may not be a post.`);
  }

  const [postListing, commentListing] = (await resp.json()) as [RedditListing, RedditListing];

  if (!postListing?.data?.children?.[0]) {
    throw new Error("Reddit response did not contain post data");
  }

  const postData = postListing.data.children[0].data as RedditPostData;

  const post: IngestedPainPoint = {
    source: "reddit",
    sourceUrl: `https://reddit.com${postData.permalink}`,
    rawText: [postData.title, postData.selftext].filter(Boolean).join("\n\n").trim().slice(0, 2000),
    engagementSignal: Math.max(0, postData.ups ?? 0),
  };

  const comments: IngestedPainPoint[] = [];
  if (commentListing?.data?.children) {
    flattenComments(commentListing.data.children as RedditCommentWrapper[], comments);
  }

  comments.sort((a, b) => b.engagementSignal - a.engagementSignal);

  logger.info({ title: postData.title, comments: comments.length }, "Reddit post scraped");

  return {
    post,
    comments,
    title: postData.title,
    subreddit: postData.subreddit,
    totalComments: postData.num_comments ?? comments.length,
  };
}

export async function ingestFromRedditUrl(url: string): Promise<IngestedPainPoint[]> {
  const scraped = await scrapeRedditPost(url);
  const results: IngestedPainPoint[] = [];
  if (scraped.post.rawText.length >= 40) results.push(scraped.post);
  results.push(...scraped.comments);
  logger.info({ url, total: results.length }, "Reddit URL ingest complete");
  return results;
}

// ── RSS-based subreddit ingestion (works from all server IPs) ─────────────────

interface RssItem {
  title: string;
  link: string;
  content: string;
  score: number;
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<table>.*?<\/table>/gs, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSubredditRss(subreddit: string, sort = "top", limit = 10): Promise<RssItem[]> {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.rss?limit=${limit}&t=month`;
  await new Promise((r) => setTimeout(r, 400));

  const resp = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
  });

  if (!resp.ok) {
    logger.warn({ subreddit, status: resp.status }, "Reddit RSS fetch failed");
    return [];
  }

  const xml = await resp.text();
  const items: RssItem[] = [];

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/);
    const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);

    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    const link = linkMatch ? linkMatch[1] : "";
    const rawContent = contentMatch ? contentMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "") : "";
    const content = extractTextFromHtml(rawContent);

    if (title && link && content.length > 30) {
      items.push({ title, link, content, score: 0 });
    }
  }

  logger.info({ subreddit, found: items.length }, "Reddit RSS fetched");
  return items;
}

export async function ingestFromReddit(
  subreddits: string[],
  _queries: string[],
  maxTotal: number
): Promise<IngestedPainPoint[]> {
  const results: IngestedPainPoint[] = [];

  for (const subreddit of subreddits) {
    if (results.length >= maxTotal) break;
    const perSub = Math.ceil((maxTotal - results.length) / (subreddits.length));
    const items = await fetchSubredditRss(subreddit, "top", Math.min(perSub * 2, 25));

    for (const item of items) {
      if (results.length >= maxTotal) break;
      const rawText = `${item.title}\n\n${item.content}`.trim();
      if (rawText.length < 60) continue;
      results.push({
        source: "reddit",
        sourceUrl: item.link,
        rawText: rawText.slice(0, 2000),
        engagementSignal: item.score,
      });
    }
  }

  logger.info({ count: results.length }, "Reddit RSS ingestion complete");
  return results;
}
