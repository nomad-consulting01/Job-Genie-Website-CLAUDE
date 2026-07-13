import { db } from "@workspace/db";
import { contentAssets, reactorInvitePosts } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { engineConfig } from "../../config/engine.js";
import { logger } from "../../lib/logger.js";

const GRAPH_API = "https://graph.facebook.com/v19.0";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithBackoff(url: string, retries = 3): Promise<Response | null> {
  let delay = 1000;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        logger.warn({ attempt: i + 1 }, "Reactor harvester: rate limited — backing off");
        await sleep(delay);
        delay *= 2;
        continue;
      }
      return resp;
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(delay);
      delay *= 2;
    }
  }
  return null;
}

interface ReactionResult {
  totalReactions: number;
  breakdown: Record<string, number>;
  snippet: string;
}

async function fetchPostReactions(postId: string, token: string): Promise<ReactionResult | null> {
  const fields = encodeURIComponent("message,reactions.limit(0).summary(true)");
  const url = `${GRAPH_API}/${postId}?fields=${fields}&access_token=${encodeURIComponent(token)}`;

  const resp = await fetchWithBackoff(url);
  if (!resp || !resp.ok) return null;

  const json = (await resp.json()) as {
    message?: string;
    reactions?: { summary?: { total_count?: number } };
    error?: { message: string };
  };

  if (json.error) {
    logger.warn({ postId, msg: json.error.message }, "Reactor harvester: Graph API error");
    return null;
  }

  const totalReactions = json.reactions?.summary?.total_count ?? 0;
  const snippet = (json.message ?? "").slice(0, 120);
  const breakdown = await fetchReactionBreakdown(postId, token);

  return { totalReactions, breakdown, snippet };
}

async function fetchReactionBreakdown(postId: string, token: string): Promise<Record<string, number>> {
  try {
    const url = `${GRAPH_API}/${postId}/insights?metric=post_reactions_by_type_total&access_token=${encodeURIComponent(token)}`;
    const resp = await fetchWithBackoff(url);
    if (!resp || !resp.ok) return {};

    const json = (await resp.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: Record<string, number> }> }>;
      error?: { message: string };
    };

    if (json.error || !json.data) return {};

    const insightRow = json.data[0];
    const values = insightRow?.values?.[0]?.value;
    if (values && typeof values === "object") {
      return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]));
    }
  } catch {
    // insights not available for all posts — silently skip
  }
  return {};
}

export interface HarvestResult {
  harvested: number;
  skipped: number;
  errors: string[];
}

export async function runHarvester(): Promise<HarvestResult> {
  const pageAccessToken = process.env["FACEBOOK_PAGE_ACCESS_TOKEN"];
  if (!pageAccessToken) {
    logger.warn("Reactor invite harvester: FACEBOOK_PAGE_ACCESS_TOKEN not set — skipping");
    return { harvested: 0, skipped: 0, errors: ["FACEBOOK_PAGE_ACCESS_TOKEN not set"] };
  }

  const lookbackDays = engineConfig.reactorInvites.lookbackDays;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const posts = await db
    .select()
    .from(contentAssets)
    .where(
      and(
        eq(contentAssets.channel, "blog_post"),
        eq(contentAssets.variant, "standard"),
        sql`(${contentAssets.engagementMetricsJson}->>'facebookPostId') IS NOT NULL`,
        sql`${contentAssets.publishedAt} >= ${cutoff.toISOString()}::timestamptz`
      )
    );

  logger.info({ count: posts.length, lookbackDays }, "Reactor invite harvester: posts to harvest");

  let harvested = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const asset of posts) {
    const metrics = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
    const fbPostId = String(metrics["facebookPostId"] ?? "");
    if (!fbPostId) { skipped++; continue; }

    const result = await fetchPostReactions(fbPostId, pageAccessToken);
    if (!result) {
      errors.push(`Post ${fbPostId}: failed to fetch reactions`);
      await sleep(1500);
      continue;
    }

    const [existing] = await db
      .select()
      .from(reactorInvitePosts)
      .where(eq(reactorInvitePosts.postId, fbPostId));

    const prevTotal = existing?.totalReactions ?? 0;
    const delta = Math.max(0, result.totalReactions - prevTotal);

    if (existing) {
      await db
        .update(reactorInvitePosts)
        .set({
          lastHarvestedAt: new Date(),
          totalReactions: result.totalReactions,
          reactionDelta: delta,
          reactionBreakdown: result.breakdown as Record<string, number>,
          postSnippet: existing.postSnippet || result.snippet || null,
        })
        .where(eq(reactorInvitePosts.postId, fbPostId));
    } else {
      await db.insert(reactorInvitePosts).values({
        postId: fbPostId,
        postSnippet: result.snippet || null,
        permalink: `https://www.facebook.com/${fbPostId}`,
        publishedAt: asset.publishedAt,
        lastHarvestedAt: new Date(),
        totalReactions: result.totalReactions,
        reactionDelta: delta,
        reactionBreakdown: result.breakdown as Record<string, number>,
      });
    }

    harvested++;
    logger.info(
      { postId: fbPostId, totalReactions: result.totalReactions, delta },
      "Reactor invite harvester: post harvested"
    );
    await sleep(400);
  }

  logger.info({ harvested, skipped, errors: errors.length }, "Reactor invite harvester: complete");
  return { harvested, skipped, errors };
}
