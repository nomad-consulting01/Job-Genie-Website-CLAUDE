import { logger } from "../../lib/logger.js";
import { generateVoiceVariants } from "./variantGenerator.js";
import { insertContentAsset } from "../../corpus/db.js";

export interface GenerateAndSaveResult {
  generated: number;
  stored: number;
  autoRejected: number;
  budgetUsedUsd: number;
  errors: string[];
}

/**
 * Station ④ — Generate voice variants for a blog post and persist them as
 * `voice_variant` content_asset rows. Safe to call fire-and-forget from Loop 3.
 */
export async function generateAndSaveVoiceVariants(blogPost: {
  assetId: number;
  answerId: number;
  slug: string;
  question: string;
  answerMd: string;
  seoTitle: string;
}, opts: { dryRun?: boolean } = {}): Promise<GenerateAndSaveResult> {
  const result = await generateVoiceVariants({
    assetId: blogPost.assetId,
    slug: blogPost.slug,
    question: blogPost.question,
    answerMd: blogPost.answerMd,
    seoTitle: blogPost.seoTitle,
  }, opts);

  let stored = 0;
  for (const variant of result.variants) {
    try {
      await insertContentAsset({
        answerId: blogPost.answerId,
        channel: "voice_variant",
        variant: variant.voiceId,
        payloadJson: variant as unknown as Record<string, unknown>,
        status: variant.status === "rejected" ? "rejected" : "draft",
        publishedAt: new Date(),
      });
      stored++;
    } catch (err) {
      result.errors.push(`Failed to save variant ${variant.voiceId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  logger.info(
    { assetId: blogPost.assetId, slug: blogPost.slug, generated: result.variants.length, stored, autoRejected: result.autoRejected },
    "Voice Loop Station ④: variants generated and saved"
  );

  return {
    generated: result.variants.length,
    stored,
    autoRejected: result.autoRejected,
    budgetUsedUsd: result.budgetUsedUsd,
    errors: result.errors,
  };
}
