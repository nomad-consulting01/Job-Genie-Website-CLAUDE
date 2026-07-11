import { generateMetaInstagramCopy, type MarketingVariant } from "../integrations/claude.js";
import {
  insertContentAsset,
  getMarketingAssetsForAnswer,
  deleteMarketingAssetForAnswer,
} from "../corpus/db.js";
import { logger } from "../lib/logger.js";

/** Compose a human-readable markdown block from a structured variant (for back-compat display). */
export function composeMarketingMarkdown(v: MarketingVariant): string {
  const parts: string[] = [];
  if (v.copy.trim()) parts.push(v.copy.trim());
  if (v.cta.trim()) parts.push(`**CTA:** ${v.cta.trim()}`);
  if (v.hashtags.length) parts.push(v.hashtags.join(" "));
  return parts.join("\n\n");
}

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
      if (result.meta.copy.trim()) deletes.push(deleteMarketingAssetForAnswer(answerId, "meta_ads"));
      if (result.instagram.copy.trim()) deletes.push(deleteMarketingAssetForAnswer(answerId, "instagram"));
      await Promise.all(deletes);
    }

    const inserts: Promise<unknown>[] = [];

    if (needMeta && result.meta.copy.trim()) {
      inserts.push(
        insertContentAsset({
          answerId,
          channel: "meta_ads",
          variant: "direct_response",
          payloadJson: {
            channel: "meta_ads",
            variant: "direct_response",
            question,
            copy: result.meta.copy,
            hashtags: result.meta.hashtags,
            cta: result.meta.cta,
            content: composeMarketingMarkdown(result.meta),
            generated_at: new Date().toISOString(),
          },
          // Generated copy starts as a draft — it must be approved before public exposure.
          status: "draft",
        })
      );
      created.push("meta_ads");
    } else if (!needMeta) {
      skipped.push("meta_ads");
    }

    if (needInstagram && result.instagram.copy.trim()) {
      inserts.push(
        insertContentAsset({
          answerId,
          channel: "instagram",
          variant: "direct_response",
          payloadJson: {
            channel: "instagram",
            variant: "direct_response",
            question,
            copy: result.instagram.copy,
            hashtags: result.instagram.hashtags,
            cta: result.instagram.cta,
            content: composeMarketingMarkdown(result.instagram),
            generated_at: new Date().toISOString(),
          },
          // Generated copy starts as a draft — it must be approved before public exposure.
          status: "draft",
        })
      );
      created.push("instagram");
    } else if (!needInstagram) {
      skipped.push("instagram");
    }

    await Promise.all(inserts);

    if ((needMeta && !result.meta.copy.trim()) || (needInstagram && !result.instagram.copy.trim())) {
      logger.warn(
        { answerId, metaEmpty: !result.meta.copy.trim(), instagramEmpty: !result.instagram.copy.trim() },
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
