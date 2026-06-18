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
    const [row, allPages] = await Promise.all([
      getAnswerPageBySlug(slug),
      listPublishedAnswerPages(200, 0),
    ]);
    if (!row) {
      res.status(404).json({ error: "Answer page not found" });
      return;
    }
    const { asset, answer, question } = row;
    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    const publishedAt = asset.scheduledFor ?? asset.publishedAt;

    // Related answers by shared pain_point_tags (scored by overlap count)
    const currentTags = new Set((question.painPointTags as string[] | null) ?? []);
    const related = allPages
      .filter(({ asset: a }) => a.externalId !== slug)
      .map(({ asset: a, answer: ans, question: q }) => {
        const p = (a.payloadJson ?? {}) as Record<string, unknown>;
        const sharedCount = ((q.painPointTags as string[] | null) ?? []).filter((t) => currentTags.has(t)).length;
        return {
          slug: a.externalId,
          title: String(p["title"] ?? q.normalisedQuestion),
          answerFirstBlock: ans.answerFirstBlock,
          painPointTags: q.painPointTags,
          _score: sharedCount,
        };
      })
      .filter((r) => r._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 4)
      .map(({ _score: _s, ...rest }) => rest);

    if (publishedAt) {
      res.setHeader("Last-Modified", new Date(publishedAt).toUTCString());
    }
    res.json({
      answer: {
        id: asset.id,
        slug: asset.externalId,
        title: String(payload["title"] ?? question.normalisedQuestion),
        answerMd: String(payload["answer_md"] ?? answer.answerMd),
        answerFirstBlock: answer.answerFirstBlock,
        sourceUrl: question.sourceUrl,
        publishedAt,
      },
      question: {
        id: question.id,
        normalisedQuestion: question.normalisedQuestion,
        painPointTags: question.painPointTags,
        sourceUrl: question.sourceUrl,
      },
      related,
    });
  } catch (err) {
    logger.error({ err }, "GET /answers/:slug failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
