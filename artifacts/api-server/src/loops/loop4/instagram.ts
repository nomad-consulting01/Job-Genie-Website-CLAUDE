import { listPublishedBlogPostsNotOnInstagram, markBlogPostInstagramShared, getApprovedMarketingForAnswer } from "../../corpus/db.js";
import { getInstagramUserId, postToInstagram } from "../../integrations/instagram.js";
import { logger } from "../../lib/logger.js";
import { readPublishedVariants, writePublishedVariants } from "../voice-loop/fileStore.js";

const SITE_URL = "https://www.job-genie.ai";

export interface InstagramResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

function buildCaption(copy: string, hashtags: string[], cta: string, url: string): string {
  const parts: string[] = [copy];
  if (cta) parts.push(cta);
  parts.push(`👉 ${url}`);
  if (hashtags.length > 0) parts.push(hashtags.join(" "));
  return parts.join("\n\n");
}

export async function runInstagram(limit: number): Promise<InstagramResult> {
  const pageId = process.env["FACEBOOK_PAGE_ID"];
  const pageAccessToken = process.env["FACEBOOK_PAGE_ACCESS_TOKEN"];

  if (!pageId || !pageAccessToken) {
    logger.warn("Loop 4 Instagram: FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not set — skipping");
    return { processed: 0, succeeded: 0, failed: 0, skipped: 0, errors: ["Instagram credentials not configured — set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN"] };
  }

  const igUserId = await getInstagramUserId(pageId, pageAccessToken);
  if (!igUserId) {
    return { processed: 0, succeeded: 0, failed: 0, skipped: 0, errors: ["No Instagram Business Account linked to this Facebook Page"] };
  }

  const pending = await listPublishedBlogPostsNotOnInstagram(limit);
  logger.info({ count: pending.length }, "Loop 4 Instagram: blog posts to share");

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const { asset, answer } of pending) {
    const slug = asset.externalId;
    if (!slug) { skipped++; continue; }

    const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
    const featuredImageUrl = String(meta["featuredImageUrl"] ?? "");
    if (!featuredImageUrl) { skipped++; continue; }

    // Get approved instagram copy
    const { instagram: igAsset } = await getApprovedMarketingForAnswer(answer.id);
    if (!igAsset) { skipped++; continue; }

    const payload = (igAsset.payloadJson ?? {}) as Record<string, unknown>;
    const copy = String(payload["copy"] ?? payload["content"] ?? "").trim();
    const hashtags = Array.isArray(payload["hashtags"])
      ? (payload["hashtags"] as unknown[]).map(String)
      : [];
    const cta = String(payload["cta"] ?? "").trim();

    if (!copy) { skipped++; continue; }

    const url = `${SITE_URL}/blog/${slug}`;
    const caption = buildCaption(copy, hashtags, cta, url);

    try {
      const { postId, error } = await postToInstagram(igUserId, pageAccessToken, featuredImageUrl, caption);

      if (postId) {
        await markBlogPostInstagramShared(asset.id, postId);
        succeeded++;
        logger.info({ assetId: asset.id, slug, postId }, "Loop 4 Instagram: post published");

        /** Close the Station ② attribution loop for voice variants:
         *  if the IG content asset was created by the voice loop (it embeds variantId),
         *  stamp the real Instagram post_id into published-variants.json so Thompson sampling
         *  can pull IG engagement back to the correct voice variant. */
        const igVariantId = payload["variantId"] as string | undefined;
        if (igVariantId) {
          try {
            const pvFile = readPublishedVariants();
            const idx = pvFile.entries.findIndex((e) => e.variant_id === igVariantId);
            if (idx >= 0) {
              pvFile.entries[idx] = { ...pvFile.entries[idx], instagram_post_id: postId };
            } else {
              pvFile.entries.push({
                post_id: `pending:${igVariantId}`,
                instagram_post_id: postId,
                variant_id: igVariantId,
                voice_id: String(payload["voiceId"] ?? ""),
                hook_type: "unknown",
                blog_post_asset_id: asset.id,
                approver: "loop4-ig",
                approvedAt: new Date().toISOString(),
                publishedAt: new Date().toISOString(),
              });
            }
            pvFile.lastUpdatedAt = new Date().toISOString();
            writePublishedVariants(pvFile);
            logger.info({ igVariantId, postId }, "Loop 4 Instagram: variant attribution stamped into published-variants.json");
          } catch (attrErr) {
            logger.warn({ err: attrErr }, "Loop 4 Instagram: failed to stamp variant attribution — continuing");
          }
        }
      } else {
        failed++;
        errors.push(`Asset ${asset.id} (${slug}): ${error ?? "unknown error"}`);
        logger.error({ assetId: asset.id, slug, error }, "Loop 4 Instagram: post failed");
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Asset ${asset.id} (${slug}): ${msg}`);
      logger.error({ assetId: asset.id, slug, err: msg }, "Loop 4 Instagram: exception");
    }
  }

  return { processed: pending.length, succeeded, failed, skipped, errors };
}
