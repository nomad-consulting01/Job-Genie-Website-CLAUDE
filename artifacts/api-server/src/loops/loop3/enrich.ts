import { generateBlogMeta } from "../../integrations/claude.js";
import { updateBlogMeta } from "../../corpus/db.js";
import { logger } from "../../lib/logger.js";
import type { Answer, Question, ContentAsset } from "@workspace/db";

export interface Loop3EnrichResult {
  assetId: number;
  answerId: number;
  slug: string;
  tokensUsed: number;
  error?: string;
}

export async function enrichBlogPost(
  asset: ContentAsset,
  answer: Answer,
  question: Question
): Promise<Loop3EnrichResult> {
  const blogContent = (asset.payloadJson as Record<string, unknown> | null)?.["content"] as string ?? "";

  try {
    const meta = await generateBlogMeta(
      question.normalisedQuestion,
      answer.answerFirstBlock,
      blogContent
    );

    await updateBlogMeta(asset.id, meta.slug, {
      seoTitle: meta.seoTitle,
      metaDescription: meta.metaDescription,
      readTimeMinutes: meta.readTimeMinutes,
      faqJsonLd: meta.faqJsonLd,
    });

    logger.info(
      { assetId: asset.id, answerId: answer.id, slug: meta.slug },
      "Loop 3: blog post enriched"
    );

    return { assetId: asset.id, answerId: answer.id, slug: meta.slug, tokensUsed: meta.tokensUsed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ assetId: asset.id, answerId: answer.id, err: msg }, "Loop 3: failed to enrich blog post");
    return { assetId: asset.id, answerId: answer.id, slug: "", tokensUsed: 0, error: msg };
  }
}
