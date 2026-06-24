import { Router } from "express";
import { logger } from "../lib/logger.js";
import {
  listUnpublishedNewsletterAssets,
  listUnmigratedBlogPosts,
} from "../corpus/db.js";
import { publishNewsletterAsset } from "../publishers/newsletter.js";
import { migrateBlogPostToBeehiiv } from "../publishers/blog-migrator.js";
import { isBeehiivConfigured } from "../integrations/beehiiv.js";

const router = Router();

// ---------------------------------------------------------------------------
// Newsletter
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
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, assetId }, "publish/newsletter failed");
    res.status(400).json({ ok: false, error: msg });
  }
});

// ---------------------------------------------------------------------------
// Blog post migration (web-only, backdated)
// ---------------------------------------------------------------------------

/** List blog posts that have a slug but haven't been pushed to Beehiiv yet */
router.get("/admin/publish/blog/queue", async (_req, res) => {
  try {
    const rows = await listUnmigratedBlogPosts(50);
    res.json({
      configured: isBeehiivConfigured(),
      count: rows.length,
      posts: rows.map(({ asset, question }) => {
        const m = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
        const p = (asset.payloadJson ?? {}) as Record<string, unknown>;
        return {
          id: asset.id,
          slug: asset.externalId,
          seoTitle: String(m["seoTitle"] ?? question.normalisedQuestion),
          painPointTags: Array.isArray(p["pain_point_tags"])
            ? p["pain_point_tags"]
            : question.painPointTags,
          imageUrl: m["featuredImageUrl"] ?? p["image_dark_teal_url"] ?? null,
          publishedAt: asset.scheduledFor ?? asset.publishedAt,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "publish/blog/queue failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Migrate one blog post to Beehiiv as a web-only backdated draft.
 * Body (all optional): { assetId?: number }
 */
router.post("/admin/publish/blog", async (req, res) => {
  if (!isBeehiivConfigured()) {
    res.status(503).json({ error: "Beehiiv credentials not configured" });
    return;
  }
  const assetId =
    req.body && typeof req.body.assetId === "number"
      ? (req.body.assetId as number)
      : undefined;
  try {
    const result = await migrateBlogPostToBeehiiv(assetId);
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, assetId }, "publish/blog failed");
    res.status(400).json({ ok: false, error: msg });
  }
});

/**
 * Batch-migrate all unmigrated blog posts (up to limit).
 * Body (optional): { limit?: number }
 */
router.post("/admin/publish/blog/batch", async (req, res) => {
  if (!isBeehiivConfigured()) {
    res.status(503).json({ error: "Beehiiv credentials not configured" });
    return;
  }
  const limit =
    req.body && typeof req.body.limit === "number" ? req.body.limit : 10;
  try {
    const rows = await listUnmigratedBlogPosts(limit);
    const results: Array<{ ok: boolean; slug?: string; beehiivPostId?: string; error?: string }> = [];
    for (const row of rows) {
      try {
        const r = await migrateBlogPostToBeehiiv(row.asset.id);
        results.push({ ok: true, slug: r.slug, beehiivPostId: r.beehiivPostId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ ok: false, slug: String(row.asset.externalId ?? ""), error: msg });
      }
    }
    res.json({ ok: true, migrated: results.filter((r) => r.ok).length, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "publish/blog/batch failed");
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
