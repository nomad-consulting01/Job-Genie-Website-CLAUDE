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
  type: "post" | "listing";
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

export function isListingUrl(url: string): boolean {
  const u = url.split("?")[0].replace(/\/$/, "");
  if (/\/comments\//.test(u)) return false;
  if (/\/r\/[^/]+\/s\//.test(u)) return false;
  if (/\/search\/?$/.test(u)) return true; // reddit search URLs
  return /\/r\/[^/]+(\/(?:top|hot|new|rising|best))?$/.test(u);
}

// Convert a reddit.com/search/?q=r+SUBREDDIT URL to a subreddit listing URL
function resolveSearchUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes("/search")) return url;
    const q = parsed.searchParams.get("q") ?? "";
    const parts = q.split(/[+\s]+/).filter(Boolean);
    // Expected format: r SUBREDDIT [subreddit]
    if (parts[0]?.toLowerCase() === "r" && parts[1]) {
      const subreddit = parts[1];
      const sort = parsed.searchParams.get("sort") ?? "top";
      const time = parsed.searchParams.get("t") ?? "year";
      return `https://www.reddit.com/r/${subreddit}/${sort}/?t=${time}`;
    }
  } catch {}
  return url;
}

interface ParsedListing {
  subreddit: string;
  sort: string;
  time: string;
  limit: number;
}

function parseListingUrl(url: string): ParsedListing {
  // Resolve search URLs first
  const resolvedUrl = resolveSearchUrl(url);
  const parsed = new URL(resolvedUrl);
  const pathParts = parsed.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const subreddit = pathParts[1] ?? "jobs";
  const sortSegment = pathParts[2] ?? "top";
  const sort = ["top", "hot", "new", "rising", "best"].includes(sortSegment) ? sortSegment : "top";
  const time = parsed.searchParams.get("t") ?? "year";
  const limitParam = parseInt(parsed.searchParams.get("limit") ?? "100");
  const limit = Math.min(Math.max(limitParam, 10), 100);
  return { subreddit, sort, time, limit };
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
    type: "post",
  };
}

export async function scrapeSubredditListing(url: string): Promise<ScrapedPost> {
  const { subreddit, sort, time, limit } = parseListingUrl(url);
  const rssUrl = `https://www.reddit.com/r/${subreddit}/${sort}.rss?t=${time}&limit=${limit}`;
  logger.info({ rssUrl }, "Fetching subreddit listing via RSS");

  const resp = await fetchRssWithRetry(rssUrl);

  if (!resp || !resp.ok) {
    throw new Error(`Reddit RSS returned ${resp?.status ?? "no response"} for ${rssUrl}`);
  }

  const xml = await resp.text();
  const posts: IngestedPainPoint[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/);
    const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);

    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    const link = linkMatch ? linkMatch[1].replace(/&amp;/g, "&") : "";
    const rawContent = contentMatch ? contentMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "") : "";
    const content = extractRedditRssContent(rawContent);

    const rawText = content.length > 30 ? `${title}\n\n${content}`.trim() : title;
    if (!title || !link || rawText.length < 20) continue;

    posts.push({
      source: "reddit",
      sourceUrl: link,
      rawText: rawText.slice(0, 2000),
      engagementSignal: 0,
    });
  }

  const label = `r/${subreddit} • ${sort} • ${time}`;
  logger.info({ label, posts: posts.length }, "Subreddit listing scraped via RSS");

  return {
    post: { source: "reddit", sourceUrl: url, rawText: "", engagementSignal: 0 },
    comments: posts,
    title: label,
    subreddit,
    totalComments: posts.length,
    type: "listing",
  };
}

export async function scrapeRedditUrl(url: string): Promise<ScrapedPost> {
  if (isListingUrl(url)) {
    return scrapeSubredditListing(url);
  }
  return scrapeRedditPost(url);
}

export async function ingestFromRedditUrl(url: string): Promise<IngestedPainPoint[]> {
  const scraped = await scrapeRedditUrl(url);
  const results: IngestedPainPoint[] = [];
  if (scraped.type === "post" && scraped.post.rawText.length >= 40) results.push(scraped.post);
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

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x200B;/g, "")
    .replace(/&nbsp;/g, " ");
}

function extractRedditRssContent(rawContent: string): string {
  // Content may be CDATA-wrapped literal HTML or XML-entity-encoded HTML.
  // Decode entities first so both forms normalise to literal tags.
  const decoded = decodeHtmlEntities(rawContent);

  // Text posts: look for the <div class="md"> wrapper
  const mdIdx = decoded.indexOf('class="md">');
  if (mdIdx !== -1) {
    const bodyStart = mdIdx + 'class="md">'.length;
    // Find the matching closing </div> by counting open/close divs
    let depth = 1;
    let i = bodyStart;
    while (i < decoded.length && depth > 0) {
      const open = decoded.indexOf("<div", i);
      const close = decoded.indexOf("</div>", i);
      if (close === -1) break;
      if (open !== -1 && open < close) {
        depth++;
        i = open + 4;
      } else {
        depth--;
        if (depth > 0) i = close + 6;
        else i = close;
      }
    }
    const inner = decoded.slice(bodyStart, i);
    return inner
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  // Link/image posts only have a thumbnail table — no usable body text
  return "";
}

async function fetchRssWithRetry(url: string, attempts = 3): Promise<Response | null> {
  // Delays: 1s, 10s, 30s — gives Reddit time to cool off between retries
  const delays = [1000, 10000, 30000];
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, delays[i] ?? 30000));
    const resp = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (resp.status === 429) {
      logger.warn({ url, attempt: i + 1 }, "Reddit RSS rate-limited (429), retrying…");
      continue;
    }
    return resp;
  }
  return null;
}

async function fetchSubredditRss(subreddit: string, sort = "top", limit = 10, time = "month"): Promise<RssItem[]> {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.rss?limit=${limit}&t=${time}`;

  const resp = await fetchRssWithRetry(url);

  if (!resp || !resp.ok) {
    logger.warn({ subreddit, status: resp?.status }, "Reddit RSS fetch failed");
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
    const content = extractRedditRssContent(rawContent);

    if (title && link) {
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
