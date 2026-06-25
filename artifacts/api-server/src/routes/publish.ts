import { Router } from "express";
import { logger } from "../lib/logger.js";
import {
  listUnpublishedNewsletterAssets,
  listUnmigratedBlogPosts,
  getBlogPostById,
} from "../corpus/db.js";
import { publishNewsletterAsset } from "../publishers/newsletter.js";
import { migrateBlogPostToBeehiiv, buildBlogWebHtml } from "../publishers/blog-migrator.js";
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

// ---------------------------------------------------------------------------
// GET /api/admin/publish/blog/preview/:assetId
// Returns a full standalone HTML page for copy-pasting into Beehiiv's HTML block
// ---------------------------------------------------------------------------
router.get("/admin/publish/blog/preview/:assetId", async (req, res) => {
  const assetId = Number(req.params["assetId"]);
  if (!assetId) { res.status(400).send("Invalid assetId"); return; }

  try {
    const row = await getBlogPostById(assetId);
    if (!row) { res.status(404).send("Blog post not found"); return; }

    const { asset, question } = row;
    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;

    const slug = String(asset.externalId ?? "");
    const seoTitle = String(meta["seoTitle"] ?? question.normalisedQuestion);
    const content = String(payload["content"] ?? "");
    const painPointTags = Array.isArray(payload["pain_point_tags"])
      ? (payload["pain_point_tags"] as string[])
      : question.painPointTags ?? [];
    const imageUrl = String(
      meta["featuredImageUrl"] ?? payload["image_dark_teal_url"] ?? "https://job-genie.ai/brand/blog-og-dark-teal.png"
    );

    const bodyHtml = buildBlogWebHtml({ slug, seoTitle, content, painPointTags, imageUrl });

    const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${seoTitle} — Beehiiv Preview</title>
  <style>
    body { background: #f0f0f0; margin: 0; padding: 32px 16px; font-family: sans-serif; }
    .toolbar {
      max-width: 720px; margin: 0 auto 16px;
      background: #1e1e2e; color: #cdd6f4; border-radius: 10px;
      padding: 12px 18px; font-size: 13px; display: flex; gap: 12px; align-items: center;
    }
    .toolbar strong { flex: 1; }
    .toolbar a { color: #89b4fa; text-decoration: none; }
    .card { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 40px 48px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .copy-btn {
      background: #7C83FF; color: #fff; border: none; border-radius: 8px;
      padding: 8px 16px; cursor: pointer; font-size: 13px; font-weight: 600;
    }
    .copy-btn:hover { background: #6570f0; }
    textarea#raw { width:100%; height:180px; font-family:monospace; font-size:11px; border-radius:8px; border:1px solid #ddd; padding:10px; resize:vertical; margin-top:12px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>📋 Beehiiv Preview — ${seoTitle}</strong>
    <a href="https://job-genie.ai/blog/${slug}" target="_blank">View live post →</a>
    <button class="copy-btn" onclick="copyHtml()">Copy HTML</button>
  </div>
  <div class="card" id="preview">${bodyHtml}</div>
  <div style="max-width:720px;margin:16px auto 0">
    <p style="font-size:12px;color:#666;margin-bottom:4px">Raw HTML (paste into Beehiiv → Add block → HTML block):</p>
    <textarea id="raw" readonly>${bodyHtml.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
  </div>
  <script>
    function copyHtml() {
      const raw = document.getElementById('raw');
      raw.select(); document.execCommand('copy');
      document.querySelector('.copy-btn').textContent = 'Copied!';
      setTimeout(() => document.querySelector('.copy-btn').textContent = 'Copy HTML', 2000);
    }
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(page);
  } catch (err) {
    logger.error({ err, assetId }, "publish/blog/preview failed");
    res.status(500).send("Internal server error");
  }
});

export default router;
