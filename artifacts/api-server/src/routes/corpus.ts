import { Router, type Request, type Response, type NextFunction } from "express";
import {
  listQuestions,
  getQuestionById,
  updateQuestionStatus,
  listAnswers,
  listLoopRuns,
  getCorpusStats,
  updateContentAssetStatus,
  listPublishedQAs,
  insertQuestion,
  getAllNormalisedQuestions,
  listLoop2Assets,
  getLoop2AssetsForAnswer,
  listPublishedBlogPosts,
  getMarketingAssetsForAnswer,
  getContentAssetById,
  getBlogSlugByAnswerId,
  updateMarketingAssetPayload,
} from "../corpus/db.js";
import { seedManualQuestion } from "../loops/loop1/ingest.js";
import { scrapeRedditUrl, ingestFromRedditUrl } from "../integrations/reddit.js";
import { generateAndStoreBlogMarketing, composeMarketingMarkdown } from "../marketing/generate.js";
import { invalidatePrerenderedBlogPost } from "./blog-html.js";
import { invalidateSitemapCache } from "./sitemap.js";
import { pingGoogleSitemap } from "../lib/google-ping.js";
import { logger } from "../lib/logger.js";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const ADMIN_TOKEN = process.env["ADMIN_TOKEN"];
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: "Admin not configured — set ADMIN_TOKEN env var" });
    return;
  }
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(requireAdmin);

router.get("/stats", async (_req, res) => {
  try {
    const stats = await getCorpusStats();
    res.json(stats);
  } catch (err) {
    logger.error({ err }, "GET /corpus/stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/questions", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "50")), 200);
    const offset = parseInt(String(req.query["offset"] ?? "0"));
    const questions = await listQuestions(limit, offset);
    res.json({ questions, limit, offset });
  } catch (err) {
    logger.error({ err }, "GET /corpus/questions failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/questions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    const question = await getQuestionById(id);
    if (!question) { res.status(404).json({ error: "Not found" }); return; }
    res.json(question);
  } catch (err) {
    logger.error({ err }, "GET /corpus/questions/:id failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/questions", async (req, res) => {
  try {
    const { raw_text, source_url, source } = req.body as {
      raw_text?: string;
      source_url?: string;
      source?: "manual" | "quora" | "linkedin";
    };
    if (!raw_text || typeof raw_text !== "string" || raw_text.trim().length < 10) {
      res.status(400).json({ error: "raw_text must be at least 10 characters" });
      return;
    }
    const question = await seedManualQuestion(
      raw_text.trim(),
      source_url ?? null,
      source ?? "manual"
    );
    res.status(201).json(question);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "POST /corpus/questions failed");
    res.status(400).json({ error: msg });
  }
});

router.put("/questions/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    const { status } = req.body as { status?: string };
    const allowed = ["pending", "approved", "rejected", "answered", "pending_review"];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      return;
    }
    await updateQuestionStatus(id, status);
    res.json({ id, status });
  } catch (err) {
    logger.error({ err }, "PUT /corpus/questions/:id/status failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/answers", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "50")), 200);
    const offset = parseInt(String(req.query["offset"] ?? "0"));
    const answers = await listAnswers(limit, offset);
    res.json({ answers, limit, offset });
  } catch (err) {
    logger.error({ err }, "GET /corpus/answers failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/assets/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    const { status } = req.body as { status?: string };
    const allowed = ["draft", "approved", "scheduled", "published", "rejected"];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      return;
    }

    /** Block voice_variant assets from being published via this generic route.
     *  Publishing a voice variant requires human approval — use POST /api/admin/voice-variants/:id/publish. */
    if (status === "published") {
      const asset = await getContentAssetById(id);
      if (asset?.channel === "voice_variant") {
        res.status(403).json({
          error: "Voice variant publishing requires human approval. Use POST /api/admin/voice-variants/:id/publish after approving via /approve.",
        });
        return;
      }
    }

    await updateContentAssetStatus(id, status, status === "published" ? new Date() : undefined);
    if (status === "published") {
      invalidateSitemapCache();
      pingGoogleSitemap();
    }
    res.json({ id, status });
  } catch (err) {
    logger.error({ err }, "PUT /corpus/assets/:id/status failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/loop-runs", async (req, res) => {
  try {
    const loop = req.query["loop"] as string | undefined;
    const runs = await listLoopRuns(loop, 30);
    res.json({ runs });
  } catch (err) {
    logger.error({ err }, "GET /corpus/loop-runs failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/loop2-assets", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "100")), 500);
    const assets = await listLoop2Assets(limit);
    res.json({ assets, total: assets.length });
  } catch (err) {
    logger.error({ err }, "GET /corpus/loop2-assets failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/loop2-assets/answer/:answerId", async (req, res) => {
  try {
    const answerId = parseInt(req.params["answerId"] ?? "0");
    const assets = await getLoop2AssetsForAnswer(answerId);
    res.json({ assets });
  } catch (err) {
    logger.error({ err }, "GET /corpus/loop2-assets/answer/:id failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/scrape-url", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== "string" || !url.includes("reddit.com")) {
      res.status(400).json({ error: "A valid reddit.com URL is required" });
      return;
    }
    const scraped = await scrapeRedditUrl(url.trim());
    res.json({
      title: scraped.title,
      subreddit: scraped.subreddit,
      type: scraped.type,
      totalComments: scraped.totalComments,
      postText: scraped.type === "post" ? scraped.post.rawText : "",
      postUrl: scraped.type === "post" ? scraped.post.sourceUrl : url.trim(),
      postScore: scraped.post.engagementSignal,
      comments: scraped.comments.slice(0, 100).map((c) => ({
        text: c.rawText,
        score: c.engagementSignal,
        url: c.sourceUrl,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "POST /corpus/scrape-url failed");
    res.status(500).json({ error: msg });
  }
});

function deriveNormalisedQuestion(rawText: string): string {
  const first = rawText.split(/[\n.!?]/)[0]?.trim() ?? rawText;
  return first.slice(0, 200) || rawText.slice(0, 200);
}

function cosineLike(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/));
  const tb = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  return intersection / Math.sqrt(ta.size * tb.size);
}

router.post("/ingest-url", async (req, res) => {
  try {
    const { url, items: preScraped } = req.body as {
      url?: string;
      items?: Array<{ text: string; url: string; score: number }>;
    };
    if (!url || typeof url !== "string" || !url.includes("reddit.com")) {
      res.status(400).json({ error: "A valid reddit.com URL is required" });
      return;
    }

    // Use pre-scraped items if provided (avoids a second Reddit request / rate-limit)
    const items = preScraped && preScraped.length > 0
      ? preScraped.map((p) => ({
          source: "reddit" as const,
          sourceUrl: p.url,
          rawText: p.text,
          engagementSignal: p.score,
        }))
      : await ingestFromRedditUrl(url.trim());
    const existing = await getAllNormalisedQuestions();

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      const normQ = deriveNormalisedQuestion(item.rawText);
      const isDupe = existing.some((e) => cosineLike(normQ, e) >= 0.75);
      if (isDupe) { skipped++; continue; }

      try {
        await insertQuestion({
          source: item.source,
          sourceUrl: item.sourceUrl,
          rawText: item.rawText,
          normalisedQuestion: normQ,
          painPointTags: [],
          engagementSignal: item.engagementSignal,
          status: "pending",
        });
        existing.push(normQ);
        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(msg);
        if (errors.length >= 5) break;
      }
    }

    logger.info({ url, scraped: items.length, imported, skipped }, "Reddit URL ingest complete");
    res.json({ scraped: items.length, imported, skipped, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "POST /corpus/ingest-url failed");
    res.status(500).json({ error: msg });
  }
});

// ─── Blog marketing copy (Meta Ads + Instagram) ──────────────────────────────

/** Published blog posts with their Meta Ads + Instagram copy (if generated). */
router.get("/blog-marketing", async (_req, res) => {
  try {
    const posts = await listPublishedBlogPosts(100, 0);
    const items = await Promise.all(
      posts.map(async ({ asset, answer, question }) => {
        const marketing = await getMarketingAssetsForAnswer(answer.id);
        // Rows are ordered newest-first; keep the first (newest) per channel so
        // any legacy duplicate rows show the most recent copy.
        const byChannel = new Map<string, (typeof marketing)[number]>();
        for (const m of marketing) {
          if (!byChannel.has(m.channel)) byChannel.set(m.channel, m);
        }
        const readVariant = (channel: string) => {
          const a = byChannel.get(channel);
          if (!a) return null;
          const payload = (a.payloadJson ?? {}) as Record<string, unknown>;
          const structuredCopy = typeof payload["copy"] === "string" ? (payload["copy"] as string) : "";
          const legacyContent = typeof payload["content"] === "string" ? (payload["content"] as string) : "";
          return {
            assetId: a.id,
            status: a.status,
            copy: structuredCopy || legacyContent,
            hashtags: Array.isArray(payload["hashtags"]) ? (payload["hashtags"] as unknown[]).map(String) : [],
            cta: typeof payload["cta"] === "string" ? (payload["cta"] as string) : "",
            content: legacyContent || structuredCopy,
          };
        };
        return {
          blogPostId: asset.id,
          answerId: answer.id,
          slug: asset.externalId,
          question: question.normalisedQuestion,
          meta: readVariant("meta_ads"),
          instagram: readVariant("instagram"),
        };
      })
    );
    res.json({ items, total: items.length });
  } catch (err) {
    logger.error({ err }, "GET /corpus/blog-marketing failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Generate Meta Ads + Instagram copy for blog posts.
 * Body: { answerId?: number, force?: boolean }. If answerId is omitted, generates
 * for all published blog posts missing marketing copy.
 */
router.post("/blog-marketing/generate", async (req, res) => {
  try {
    const { answerId, force, limit } = req.body as { answerId?: number; force?: boolean; limit?: number };
    const posts = await listPublishedBlogPosts(100, 0);

    // Single-post path: regenerate/generate one answer (honours `force`).
    if (answerId) {
      const target = posts.find((p) => p.answer.id === answerId);
      if (!target) {
        res.status(404).json({ error: "No matching published blog post found" });
        return;
      }
      const result = await generateAndStoreBlogMarketing(
        target.answer.id,
        target.question.normalisedQuestion,
        target.answer.answerMd,
        force === true
      );
      res.json({
        requested: 1,
        generated: result.created.length > 0 ? 1 : 0,
        failed: result.error ? 1 : 0,
        remaining: 0,
        results: [result],
      });
      return;
    }

    // Bulk backfill path: only touch posts still missing Meta/Instagram copy, and
    // process at most `batch` per request so a single HTTP call can't run for
    // minutes (each post is one Claude call). The client loops until remaining=0.
    const batch = Math.min(Math.max(1, limit ?? 4), 10);
    const missing: typeof posts = [];
    for (const p of posts) {
      const marketing = await getMarketingAssetsForAnswer(p.answer.id);
      const channels = new Set(marketing.map((m) => m.channel));
      if (!channels.has("meta_ads") || !channels.has("instagram")) missing.push(p);
    }

    if (missing.length === 0) {
      res.json({ requested: 0, generated: 0, failed: 0, remaining: 0, missingTotal: 0, results: [] });
      return;
    }

    const slice = missing.slice(0, batch);
    const results = [];
    for (const { answer, question } of slice) {
      const result = await generateAndStoreBlogMarketing(
        answer.id,
        question.normalisedQuestion,
        answer.answerMd,
        false
      );
      results.push(result);
    }

    const generated = results.filter((r) => r.created.length > 0).length;
    const failed = results.filter((r) => r.error).length;
    const remaining = Math.max(0, missing.length - slice.length);
    logger.info({ requested: slice.length, generated, failed, remaining }, "Blog marketing generation batch complete");
    res.json({ requested: slice.length, generated, failed, remaining, missingTotal: missing.length, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "POST /corpus/blog-marketing/generate failed");
    res.status(500).json({ error: msg });
  }
});

/**
 * Background bulk-generate: responds immediately, processes all posts missing
 * Meta/Instagram copy in the background. Monitor via server logs.
 */
router.post("/blog-marketing/generate-all", requireAdmin, async (req, res) => {
  res.json({ message: "Marketing generation started — running in background", status: "started" });

  (async () => {
    try {
      const posts = await listPublishedBlogPosts(100, 0);
      const missing: typeof posts = [];
      for (const p of posts) {
        const marketing = await getMarketingAssetsForAnswer(p.answer.id);
        const channels = new Set(marketing.map((m) => m.channel));
        if (!channels.has("meta_ads") || !channels.has("instagram")) missing.push(p);
      }
      logger.info({ total: missing.length }, "Blog marketing generate-all: posts to process");
      let generated = 0;
      let failed = 0;
      for (const { answer, question } of missing) {
        const result = await generateAndStoreBlogMarketing(
          answer.id,
          question.normalisedQuestion,
          answer.answerMd,
          false
        );
        if (result.created.length > 0) {
          generated++;
          logger.info({ answerId: answer.id, channels: result.created }, "Blog marketing generate-all: generated");
        }
        if (result.error) {
          failed++;
          logger.error({ answerId: answer.id, err: result.error }, "Blog marketing generate-all: failed");
        }
      }
      logger.info({ generated, failed, total: missing.length }, "Blog marketing generate-all: complete");
    } catch (err) {
      logger.error({ err }, "Blog marketing generate-all: fatal error");
    }
  })();
});

/**
 * Edit a marketing variant's structured fields (copy / hashtags / cta).
 * Recomposes the display markdown and resets the asset to 'draft' — it must be
 * re-approved before it appears publicly. Invalidates any prerendered file.
 */
router.patch("/blog-marketing/:assetId", async (req, res) => {
  try {
    const assetId = parseInt(req.params["assetId"] ?? "0");
    const asset = await getContentAssetById(assetId);
    if (!asset || (asset.channel !== "meta_ads" && asset.channel !== "instagram")) {
      res.status(404).json({ error: "Marketing asset not found" });
      return;
    }
    const body = req.body as { copy?: string; hashtags?: string[] | string; cta?: string };
    const copy = typeof body.copy === "string" ? body.copy.trim() : "";
    const cta = typeof body.cta === "string" ? body.cta.trim() : "";
    let hashtags: string[] = [];
    if (Array.isArray(body.hashtags)) hashtags = body.hashtags.map((h) => String(h).trim()).filter(Boolean);
    else if (typeof body.hashtags === "string") hashtags = body.hashtags.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    hashtags = hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`));

    const variant = { copy, hashtags, cta };
    const content = composeMarketingMarkdown(variant);
    await updateMarketingAssetPayload(assetId, { ...variant, content });

    // Editing un-approves — drop any stale prerendered HTML for this post.
    if (asset.answerId != null) {
      const slug = await getBlogSlugByAnswerId(asset.answerId);
      if (slug) invalidatePrerenderedBlogPost(slug);
    }

    res.json({ id: assetId, status: "draft", ...variant, content });
  } catch (err) {
    logger.error({ err }, "PATCH /corpus/blog-marketing/:assetId failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Approve or unapprove a marketing variant for public exposure.
 * Body: { approved: boolean }. Invalidates the prerendered file so crawlers get fresh HTML.
 */
router.post("/blog-marketing/:assetId/approval", async (req, res) => {
  try {
    const assetId = parseInt(req.params["assetId"] ?? "0");
    const asset = await getContentAssetById(assetId);
    if (!asset || (asset.channel !== "meta_ads" && asset.channel !== "instagram")) {
      res.status(404).json({ error: "Marketing asset not found" });
      return;
    }
    const { approved } = req.body as { approved?: boolean };
    const status = approved ? "approved" : "draft";
    await updateContentAssetStatus(assetId, status);

    if (asset.answerId != null) {
      const slug = await getBlogSlugByAnswerId(asset.answerId);
      if (slug) invalidatePrerenderedBlogPost(slug);
    }

    res.json({ id: assetId, status });
  } catch (err) {
    logger.error({ err }, "POST /corpus/blog-marketing/:assetId/approval failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
