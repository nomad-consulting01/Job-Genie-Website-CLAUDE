import { generateMetaInstagramCopy } from "../integrations/claude.js";
import {
  insertContentAsset,
  getMarketingAssetsForAnswer,
  deleteMarketingAssetForAnswer,
} from "../corpus/db.js";
import { logger } from "../lib/logger.js";

export interface MarketingGenerateResult {
  answerId: number;
  created: string[];
  skipped: string[];
  tokensUsed: number;
  error?: string;
}

/**
 * Generate Meta Ads + Instagram marketing copy for a blog post's answer and
 * persist them as content_assets (channels `meta_ads` / `instagram`, variant
 * `direct_response`). Idempotent: channels that already exist are skipped unless
 * `force` is set.
 */
export async function generateAndStoreBlogMarketing(
  answerId: number,
  question: string,
  answerMd: string,
  force = false
): Promise<MarketingGenerateResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  try {
    const existing = await getMarketingAssetsForAnswer(answerId);
    const existingChannels = new Set(existing.map((a) => a.channel));

    const needMeta = force || !existingChannels.has("meta_ads");
    const needInstagram = force || !existingChannels.has("instagram");

    if (!needMeta && !needInstagram) {
      return { answerId, created, skipped: ["meta_ads", "instagram"], tokensUsed: 0 };
    }

    const result = await generateMetaInstagramCopy(question, answerMd);

    // On force-regenerate, remove stale rows first so we never accumulate duplicates.
    if (force) {
      const deletes: Promise<unknown>[] = [];
      if (result.metaAds.trim()) deletes.push(deleteMarketingAssetForAnswer(answerId, "meta_ads"));
      if (result.instagram.trim()) deletes.push(deleteMarketingAssetForAnswer(answerId, "instagram"));
      await Promise.all(deletes);
    }

    const inserts: Promise<unknown>[] = [];

    if (needMeta && result.metaAds.trim()) {
      inserts.push(
        insertContentAsset({
          answerId,
          channel: "meta_ads",
          variant: "direct_response",
          payloadJson: {
            channel: "meta_ads",
            variant: "direct_response",
            question,
            content: result.metaAds,
            generated_at: new Date().toISOString(),
          },
          status: "published",
          publishedAt: new Date(),
        })
      );
      created.push("meta_ads");
    } else if (!needMeta) {
      skipped.push("meta_ads");
    }

    if (needInstagram && result.instagram.trim()) {
      inserts.push(
        insertContentAsset({
          answerId,
          channel: "instagram",
          variant: "direct_response",
          payloadJson: {
            channel: "instagram",
            variant: "direct_response",
            question,
            content: result.instagram,
            generated_at: new Date().toISOString(),
          },
          status: "published",
          publishedAt: new Date(),
        })
      );
      created.push("instagram");
    } else if (!needInstagram) {
      skipped.push("instagram");
    }

    await Promise.all(inserts);

    if ((needMeta && !result.metaAds.trim()) || (needInstagram && !result.instagram.trim())) {
      logger.warn(
        { answerId, metaEmpty: !result.metaAds.trim(), instagramEmpty: !result.instagram.trim() },
        "Marketing: Claude returned empty copy for a requested channel (possible truncated/invalid JSON)"
      );
    }

    logger.info({ answerId, created, skipped }, "Marketing: Meta/Instagram copy generated");
    return { answerId, created, skipped, tokensUsed: result.tokensUsed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ answerId, err: msg }, "Marketing: failed to generate Meta/Instagram copy");
    return { answerId, created, skipped, tokensUsed: 0, error: msg };
  }
}
