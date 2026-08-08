import { generateBlogMeta } from "../../integrations/claude.js";
import { updateBlogMeta, listPublishedBlogQuestionsAndSlugs, insertBlogRedirect } from "../../corpus/db.js";
import { generateBlogHeroImage } from "../../lib/blogImages.js";
import { logger } from "../../lib/logger.js";
import type { Answer, Question, ContentAsset } from "@workspace/db";

/**
 * Cosine-like token similarity — same algorithm used in Loop 1 question dedupe.
 * Returns 0–1; 1 = identical token sets.
 */
function cosineLikeSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/));
  const tokensB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  return intersection / Math.sqrt(tokensA.size * tokensB.size);
}

export interface CannibalMatch {
  keeperSlug: string;
  score: number;
}

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
  question: Question,
  threshold: number
): Promise<Loop3EnrichResult> {
  const payload = asset.payloadJson as Record<string, unknown> | null;
  const blogContent = (payload?.["content"] as string) ?? "";

  // Fallback brand templates, only used if unique image generation fails.
  const fallbackImageUrl =
    asset.id % 2 === 0
      ? (payload?.["image_dark_teal_url"] as string | undefined)
      : (payload?.["image_warm_editorial_url"] as string | undefined);

  try {
    // ── Cannibalization guard ────────────────────────────────────────────────
    // Compare this question against all published blog questions before generating
    // expensive meta/images. If too similar to an existing post, auto-redirect.
    const published = await listPublishedBlogQuestionsAndSlugs();
    let bestMatch: CannibalMatch | null = null;
    for (const existing of published) {
      const score = cosineLikeSimilarity(question.normalisedQuestion, existing.normalisedQuestion);
      if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { keeperSlug: existing.slug, score };
      }
    }
    if (bestMatch) {
      await insertBlogRedirect(
        asset.id,
        // Generate the slug the post *would* have had (for the redirect map).
        // We use a lightweight slug derived from the question rather than calling Claude.
        question.normalisedQuestion
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 80),
        bestMatch.keeperSlug,
        question.normalisedQuestion,
        bestMatch.score
      );
      logger.info(
        { assetId: asset.id, keeper: bestMatch.keeperSlug, score: bestMatch.score },
        "Loop 3: cannibalization detected — auto-redirected to keeper, skipped publish"
      );
      return { assetId: asset.id, answerId: answer.id, slug: `_redirected:${bestMatch.keeperSlug}`, tokensUsed: 0 };
    }
    // ── End cannibalization guard ────────────────────────────────────────────

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
