import { Router } from "express";
import { listPublishedBlogPosts, getBlogPostBySlug } from "../corpus/db.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "20")), 100);
    const offset = parseInt(String(req.query["offset"] ?? "0"));
    const rows = await listPublishedBlogPosts(limit + 1, offset);
    const hasMore = rows.length > limit;
    const posts = rows.slice(0, limit).map(({ asset, question }) => {
      const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
      return {
        id: asset.id,
        slug: asset.externalId,
        seoTitle: meta["seoTitle"] ?? question.normalisedQuestion,
        metaDescription: meta["metaDescription"] ?? "",
        readTimeMinutes: meta["readTimeMinutes"] ?? null,
        publishedAt: asset.scheduledFor ?? asset.publishedAt,
        question: {
          id: question.id,
          normalisedQuestion: question.normalisedQuestion,
          painPointTags: question.painPointTags,
        },
      };
    });
    res.json({ posts, total: posts.length, limit, offset, hasMore });
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
    res.json({
      post: {
        id: asset.id,
        slug: asset.externalId,
        seoTitle: meta["seoTitle"] ?? question.normalisedQuestion,
        metaDescription: meta["metaDescription"] ?? "",
        readTimeMinutes: meta["readTimeMinutes"] ?? null,
        faqJsonLd: meta["faqJsonLd"] ?? null,
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
    });
  } catch (err) {
    logger.error({ err }, "GET /blog/:slug failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
