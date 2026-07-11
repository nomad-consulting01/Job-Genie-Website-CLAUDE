import { Router } from "express";
import { listPublishedBlogPosts, getBlogPostBySlug, getPublicDirectResponseForAnswer } from "../corpus/db.js";
import { listBeehiivPosts, isBeehiivConfigured, type BeehiivPost } from "../integrations/beehiiv.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "20")), 100);
    const offset = parseInt(String(req.query["offset"] ?? "0"));

    // Fetch internal posts and Beehiiv posts in parallel
    const [rows, beehiivPosts] = await Promise.all([
      listPublishedBlogPosts(limit + 1, offset),
      isBeehiivConfigured()
        ? listBeehiivPosts(50).catch((err) => {
            logger.warn({ err: err instanceof Error ? err.message : String(err) }, "GET /blog: Beehiiv fetch failed — using internal only");
            return [];
          })
        : Promise.resolve([] as BeehiivPost[]),
    ]);

    const internal = rows.slice(0, limit).map(({ asset, question }) => {
      const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
      return {
        id: String(asset.id),
        slug: String(asset.externalId ?? ""),
        seoTitle: String(meta["seoTitle"] ?? question.normalisedQuestion),
        metaDescription: String(meta["metaDescription"] ?? ""),
        readTimeMinutes: (meta["readTimeMinutes"] as number | null) ?? null,
        publishedAt: (asset.scheduledFor ?? asset.publishedAt)?.toISOString() ?? null,
        source: "internal" as const,
        webUrl: null,
        question: {
          id: question.id,
          normalisedQuestion: question.normalisedQuestion,
          painPointTags: question.painPointTags,
        },
      };
    });

    const internalSlugs = new Set(internal.map((p) => p.slug));

    const beehiiv = beehiivPosts
      .filter((p) => !internalSlugs.has(p.slug)) // don't duplicate cross-posted content
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        seoTitle: p.title,
        metaDescription: p.subtitle ?? "",
        readTimeMinutes: null,
        publishedAt: p.publishDate ? new Date(p.publishDate * 1000).toISOString() : null,
        source: "beehiiv" as const,
        webUrl: p.webUrl,
        question: { id: null, normalisedQuestion: p.title, painPointTags: p.contentTags },
      }));

    // Merge and sort newest first
    const merged = [...internal, ...beehiiv].sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    });

    res.json({ posts: merged, total: merged.length, limit, offset, hasMore: rows.length > limit, beehiivCount: beehiiv.length });
  } catch (err) {
    logger.error({ err }, "GET /blog failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params["slug"] ?? "";
    const row = await getBlogPostBySlug(slug);
    if (!row) {
      res.status(404).json({ error: "Blog post not found" });
      return;
    }
    const { asset, answer, question } = row;
    const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    const directResponse = await getPublicDirectResponseForAnswer(answer.id);
    res.json({
      post: {
        id: asset.id,
        slug: asset.externalId,
        seoTitle: meta["seoTitle"] ?? question.normalisedQuestion,
        metaDescription: meta["metaDescription"] ?? "",
        readTimeMinutes: meta["readTimeMinutes"] ?? null,
        faqJsonLd: meta["faqJsonLd"] ?? null,
        featuredImageUrl: (meta["featuredImageUrl"] as string | undefined) ?? null,
        content: payload["content"] ?? "",
        publishedAt: asset.scheduledFor ?? asset.publishedAt,
      },
      question: {
        id: question.id,
        normalisedQuestion: question.normalisedQuestion,
        painPointTags: question.painPointTags,
        sourceUrl: question.sourceUrl,
      },
      answer: {
        id: answer.id,
        answerFirstBlock: answer.answerFirstBlock,
      },
      directResponse,
    });
  } catch (err) {
    logger.error({ err }, "GET /blog/:slug failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
