import { listPublishedBlogPostsNotOnFacebook, markBlogPostFacebookShared } from "../../corpus/db.js";
import { postToFacebookPage } from "../../integrations/facebook.js";
import { logger } from "../../lib/logger.js";

const SITE_URL = "https://www.job-genie.ai";

export interface FacebookResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

function buildCaption(seoTitle: string, metaDescription: string): string {
  return `${seoTitle}\n\n${metaDescription}\n\n👉 Read the full post on Job Genie:`;
}

export async function runFacebook(limit: number): Promise<FacebookResult> {
  const pageId = process.env["FACEBOOK_PAGE_ID"];
  const pageAccessToken = process.env["FACEBOOK_PAGE_ACCESS_TOKEN"];

  if (!pageId || !pageAccessToken) {
    logger.warn("Loop 4 Facebook: FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not set — skipping");
    return { processed: 0, succeeded: 0, failed: 0, skipped: 0, errors: ["Facebook credentials not configured — set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN"] };
  }

  const pending = await listPublishedBlogPostsNotOnFacebook(limit);
  logger.info({ count: pending.length }, "Loop 4 Facebook: blog posts to share");

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const { asset } of pending) {
    const slug = asset.externalId;
    if (!slug) { skipped++; continue; }

    const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
    const seoTitle = String(meta["seoTitle"] ?? "New post on Job Genie");
    const metaDescription = String(meta["metaDescription"] ?? "");
    const link = `${SITE_URL}/blog/${slug}`;
    const caption = buildCaption(seoTitle, metaDescription);

    try {
      const { postId, error } = await postToFacebookPage(pageId, pageAccessToken, caption, link);

      if (postId) {
        await markBlogPostFacebookShared(asset.id, postId);
        succeeded++;
        logger.info({ assetId: asset.id, slug, postId }, "Loop 4 Facebook: post published");
      } else {
        failed++;
        errors.push(`Asset ${asset.id} (${slug}): ${error ?? "unknown error"}`);
        logger.error({ assetId: asset.id, slug, error }, "Loop 4 Facebook: post failed");
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Asset ${asset.id} (${slug}): ${msg}`);
      logger.error({ assetId: asset.id, slug, err: msg }, "Loop 4 Facebook: exception");
    }
  }

  return { processed: pending.length, succeeded, failed, skipped, errors };
}
