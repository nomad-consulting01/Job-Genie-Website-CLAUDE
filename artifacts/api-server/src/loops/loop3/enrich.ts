import { generateBlogMeta } from "../../integrations/claude.js";
import { updateBlogMeta } from "../../corpus/db.js";
import { generateBlogHeroImage } from "../../lib/blogImages.js";
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
  const payload = asset.payloadJson as Record<string, unknown> | null;
  const blogContent = (payload?.["content"] as string) ?? "";

  // Fallback brand templates, only used if unique image generation fails.
  const fallbackImageUrl =
    asset.id % 2 === 0
      ? (payload?.["image_dark_teal_url"] as string | undefined)
      : (payload?.["image_warm_editorial_url"] as string | undefined);

  try {
    const meta = await generateBlogMeta(
      question.normalisedQuestion,
      answer.answerFirstBlock,
      blogContent
    );

    let featuredImageUrl: string | null = fallbackImageUrl ?? null;
    try {
      featuredImageUrl = await generateBlogHeroImage(
        { title: question.normalisedQuestion, summary: answer.answerFirstBlock },
        meta.slug,
        asset.id % 2 === 0 ? "dark_teal" : "warm_editorial"
      );
    } catch (imgErr) {
      logger.error(
        {
          assetId: asset.id,
          answerId: answer.id,
          err: imgErr instanceof Error ? imgErr.message : String(imgErr),
        },
        "Loop 3: unique hero image generation failed, falling back to brand template"
      );
    }

    await updateBlogMeta(asset.id, meta.slug, {
      seoTitle: meta.seoTitle,
      metaDescription: meta.metaDescription,
      readTimeMinutes: meta.readTimeMinutes,
      faqJsonLd: meta.faqJsonLd,
      featuredImageUrl,
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
