import { listAnswersWithRedditSource, markAssetDistributed, getWebAeoAssetForAnswer } from "../../corpus/db.js";
import { logger } from "../../lib/logger.js";

export interface RedditResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

async function getRedditToken(): Promise<string | null> {
  const clientId = process.env["REDDIT_CLIENT_ID"];
  const clientSecret = process.env["REDDIT_CLIENT_SECRET"];
  const username = process.env["REDDIT_USERNAME"];
  const password = process.env["REDDIT_PASSWORD"];

  if (!clientId || !clientSecret || !username || !password) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": `JobGenie/1.0 by ${username}`,
    },
    body: new URLSearchParams({
      grant_type: "password",
      username,
      password,
    }),
  });

  if (!resp.ok) {
    logger.warn({ status: resp.status }, "Loop 4 Reddit: failed to get access token");
    return null;
  }

  const data = (await resp.json()) as { access_token?: string };
  return data.access_token ?? null;
}

function extractThreadId(sourceUrl: string): string | null {
  const match = sourceUrl.match(/\/comments\/([a-z0-9]+)\//i);
  return match?.[1] ?? null;
}

async function postRedditComment(token: string, threadId: string, text: string, username: string): Promise<string | null> {
  const resp = await fetch("https://oauth.reddit.com/api/comment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": `JobGenie/1.0 by ${username}`,
    },
    body: new URLSearchParams({
      api_type: "json",
      thing_id: `t3_${threadId}`,
      text,
    }),
  });

  if (!resp.ok) {
    logger.warn({ status: resp.status, threadId }, "Loop 4 Reddit: comment POST failed");
    return null;
  }

  const data = (await resp.json()) as { json?: { data?: { things?: Array<{ data?: { name?: string } }> } } };
  return data.json?.data?.things?.[0]?.data?.name ?? null;
}

export async function runReddit(limit: number): Promise<RedditResult> {
  const username = process.env["REDDIT_USERNAME"] ?? "";
  const token = await getRedditToken();

  if (!token) {
    logger.info("Loop 4 Reddit: skipping — no credentials configured");
    return { processed: 0, succeeded: 0, failed: 0, skipped: 0, errors: ["No Reddit credentials configured — set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD"] };
  }

  const pending = await listAnswersWithRedditSource(limit);
  logger.info({ count: pending.length }, "Loop 4 Reddit: answers to reply to");

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const { answer, question } of pending) {
    const sourceUrl = question.sourceUrl ?? "";
    if (!sourceUrl.includes("reddit.com")) {
      skipped++;
      continue;
    }

    const threadId = extractThreadId(sourceUrl);
    if (!threadId) {
      skipped++;
      errors.push(`Answer ${answer.id}: could not extract thread ID from ${sourceUrl}`);
      continue;
    }

    // Check if already replied (look for a distributed asset for this answer)
    const existing = await getWebAeoAssetForAnswer(answer.id);
    if (existing?.asset.engagementMetricsJson && (existing.asset.engagementMetricsJson as Record<string, unknown>)["redditCommentId"]) {
      skipped++;
      continue;
    }

    const replyText = [
      answer.answerFirstBlock,
      "",
      "---",
      "*I'm a bot sharing AI-generated job-search intelligence. [Job Genie](https://job-genie.ai) helps candidates escape Application Silence.*",
    ].join("\n");

    try {
      const commentName = await postRedditComment(token, threadId, replyText, username);
      if (commentName && existing?.asset) {
        const existingMeta = (existing.asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
        await markAssetDistributed(existing.asset.id, existing.asset.externalId ?? existing.asset.id.toString(), "reddit", {
          ...existingMeta,
          redditCommentId: commentName,
          redditThreadId: threadId,
          repliedAt: new Date().toISOString(),
        });
        succeeded++;
        logger.info({ answerId: answer.id, threadId, commentName }, "Loop 4 Reddit: reply posted");
      } else {
        failed++;
        errors.push(`Answer ${answer.id}: failed to post comment`);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Answer ${answer.id}: ${msg}`);
      logger.error({ answerId: answer.id, err: msg }, "Loop 4 Reddit: error");
    }
  }

  return { processed: pending.length, succeeded, failed, skipped, errors };
}
