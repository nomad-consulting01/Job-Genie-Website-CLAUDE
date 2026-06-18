import { Router } from "express";
import { listPublishedAnswerPages, getAnswerPageBySlug } from "../corpus/db.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "50")), 200);
    const offset = parseInt(String(req.query["offset"] ?? "0"));
    const rows = await listPublishedAnswerPages(limit + 1, offset);
    const hasMore = rows.length > limit;
    const answers = rows.slice(0, limit).map(({ asset, answer, question }) => {
      const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
      return {
        id: asset.id,
        slug: asset.externalId,
        title: String(payload["title"] ?? question.normalisedQuestion),
        answerFirstBlock: answer.answerFirstBlock,
        painPointTags: question.painPointTags,
        sourceUrl: question.sourceUrl,
        publishedAt: asset.scheduledFor ?? asset.publishedAt,
      };
    });
    res.json({ answers, total: answers.length, limit, offset, hasMore });
  } catch (err) {
    logger.error({ err }, "GET /answers failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params["slug"] ?? "";
    const row = await getAnswerPageBySlug(slug);
    if (!row) {
      res.status(404).json({ error: "Answer page not found" });
      return;
    }
    const { asset, answer, question } = row;
    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    res.json({
      answer: {
        id: asset.id,
        slug: asset.externalId,
        title: String(payload["title"] ?? question.normalisedQuestion),
        answerMd: String(payload["answer_md"] ?? answer.answerMd),
        answerFirstBlock: answer.answerFirstBlock,
        sourceUrl: question.sourceUrl,
        publishedAt: asset.scheduledFor ?? asset.publishedAt,
      },
      question: {
        id: question.id,
        normalisedQuestion: question.normalisedQuestion,
        painPointTags: question.painPointTags,
        sourceUrl: question.sourceUrl,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /answers/:slug failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
