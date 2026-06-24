import { Router } from "express";
import { logger } from "../lib/logger.js";
import {
  listUnpublishedNewsletterAssets,
} from "../corpus/db.js";
import { publishNewsletterAsset } from "../publishers/newsletter.js";
import { isBeehiivConfigured } from "../integrations/beehiiv.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/admin/publish/newsletter/queue
// List newsletter assets that have not yet been pushed to Beehiiv
// ---------------------------------------------------------------------------
router.get("/admin/publish/newsletter/queue", async (_req, res) => {
  try {
    const rows = await listUnpublishedNewsletterAssets(50);
    res.json({
      configured: isBeehiivConfigured(),
      count: rows.length,
      assets: rows.map(({ asset, question }) => {
        const p = (asset.payloadJson ?? {}) as Record<string, unknown>;
        return {
          id: asset.id,
          question: String(p["question"] ?? question.normalisedQuestion),
          painPointTags: Array.isArray(p["pain_point_tags"])
            ? p["pain_point_tags"]
            : question.painPointTags,
          imageUrl: p["image_dark_teal_url"] ?? null,
          publishedAt: asset.publishedAt,
          contentPreview: String(p["content"] ?? "").slice(0, 200),
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "publish/newsletter/queue failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/publish/newsletter
// Push the next (or a specific) newsletter asset to Beehiiv as a draft
//
// Body (all optional):
//   { assetId?: number }
// ---------------------------------------------------------------------------
router.post("/admin/publish/newsletter", async (req, res) => {
  if (!isBeehiivConfigured()) {
    res.status(503).json({ error: "Beehiiv credentials not configured" });
    return;
  }

  const assetId =
    req.body && typeof req.body.assetId === "number"
      ? (req.body.assetId as number)
      : undefined;

  try {
    const result = await publishNewsletterAsset(assetId);
    res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, assetId }, "publish/newsletter failed");
    res.status(400).json({ ok: false, error: msg });
  }
});

export default router;
