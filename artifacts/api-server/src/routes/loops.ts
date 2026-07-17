import { Router, type Request, type Response, type NextFunction } from "express";
import { getSchedulerStatus } from "../scheduler/index.js";
import { logger } from "../lib/logger.js";

const router = Router();
let loop1Running = false;
let loop2Running = false;
let loop3Running = false;
let loop4Running = false;
let scraperRunning = false;

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

router.get("/status", (_req, res) => {
  res.json(getSchedulerStatus());
});

router.post("/loop1/run", async (_req, res) => {
  if (loop1Running) {
    res.status(409).json({ error: "Loop 1 is already running" });
    return;
  }
  loop1Running = true;
  res.json({ message: "Loop 1 triggered — running in background", status: "started" });

  setImmediate(async () => {
    try {
      const { run } = await import("../loops/loop1/index.js");
      const result = await run();
      logger.info({ result }, "Manual Loop 1 run completed");
    } catch (err) {
      logger.error({ err }, "Manual Loop 1 run failed");
    } finally {
      loop1Running = false;
    }
  });
});

router.post("/loop2/run", async (_req, res) => {
  if (loop2Running) {
    res.status(409).json({ error: "Loop 2 is already running" });
    return;
  }
  loop2Running = true;
  res.json({ message: "Loop 2 triggered — running in background", status: "started" });

  setImmediate(async () => {
    try {
      const { run } = await import("../loops/loop2/index.js");
      const result = await run();
      logger.info({ result }, "Manual Loop 2 run completed");
    } catch (err) {
      logger.error({ err }, "Manual Loop 2 run failed");
    } finally {
      loop2Running = false;
    }
  });
});

router.post("/loop3/run", async (_req, res) => {
  if (loop3Running) {
    res.status(409).json({ error: "Loop 3 is already running" });
    return;
  }
  loop3Running = true;
  res.json({ message: "Loop 3 triggered — running in background", status: "started" });

  setImmediate(async () => {
    try {
      const { run } = await import("../loops/loop3/index.js");
      const result = await run();
      logger.info({ result }, "Manual Loop 3 run completed");
    } catch (err) {
      logger.error({ err }, "Manual Loop 3 run failed");
    } finally {
      loop3Running = false;
    }
  });
});

router.post("/loop4/run", async (_req, res) => {
  if (loop4Running) {
    res.status(409).json({ error: "Loop 4 is already running" });
    return;
  }
  loop4Running = true;
  res.json({ message: "Loop 4 triggered — running in background", status: "started" });

  setImmediate(async () => {
    try {
      const { run } = await import("../loops/loop4/index.js");
      const result = await run();
      logger.info({ result }, "Manual Loop 4 run completed");
    } catch (err) {
      logger.error({ err }, "Manual Loop 4 run failed");
    } finally {
      loop4Running = false;
    }
  });
});

let heroImageBackfillRunning = false;

router.post("/backfill-hero-images/run", async (req, res) => {
  if (heroImageBackfillRunning) {
    res.status(409).json({ error: "Hero image backfill is already running" });
    return;
  }
  const force = req.query["force"] === "true";
  heroImageBackfillRunning = true;
  res.json({ message: "Hero image backfill triggered — running in background", status: "started", force });

  setImmediate(async () => {
    try {
      const { listAllPublishedBlogPostsForImageGen, setFeaturedImageUrl } = await import("../corpus/db.js");
      const { generateBlogHeroImage } = await import("../lib/blogImages.js");
      const rows = await listAllPublishedBlogPostsForImageGen();
      let success = 0;
      let skipped = 0;
      let failed = 0;

      for (const row of rows) {
        const slug = row.asset.externalId ?? `post-${row.asset.id}`;
        const meta = row.asset.engagementMetricsJson as Record<string, unknown> | null;
        const existingUrl = meta?.["featuredImageUrl"] as string | undefined;
        if (!force && existingUrl?.includes("/api/blog-images/")) {
          skipped += 1;
          continue;
        }
        try {
          const url = await generateBlogHeroImage(
            { title: row.question.normalisedQuestion, summary: row.answer.answerFirstBlock },
            slug,
            row.asset.id % 2 === 0 ? "dark_teal" : "warm_editorial"
          );
          await setFeaturedImageUrl(row.asset.id, url);
          success += 1;
          logger.info({ slug, assetId: row.asset.id, url }, "Backfilled hero image");
        } catch (err) {
          failed += 1;
          logger.error(
            { slug, assetId: row.asset.id, err: err instanceof Error ? err.message : String(err) },
            "Failed to backfill hero image"
          );
        }
      }
      logger.info({ success, skipped, failed, total: rows.length }, "Hero image backfill completed");
    } catch (err) {
      logger.error({ err }, "Hero image backfill failed");
    } finally {
      heroImageBackfillRunning = false;
    }
  });
});

router.get("/backfill-hero-images/status", (_req, res) => {
  res.json({ running: heroImageBackfillRunning });
});

let voiceLoopDryRunRunning = false;

router.post("/voice-loop/dry-run", async (_req, res) => {
  if (voiceLoopDryRunRunning) {
    res.status(409).json({ error: "Voice loop dry-run is already running" });
    return;
  }
  voiceLoopDryRunRunning = true;
  res.json({ message: "Voice loop dry-run started — stations ①②③④⑤⑥⑦ will be exercised without publishing", status: "started" });

  setImmediate(async () => {
    try {
      const { runFbMetricsIngest } = await import("../loops/voice-loop/fbMetrics.js");
      const { runAttribution } = await import("../loops/voice-loop/attribution.js");
      const { runLedgerUpdate } = await import("../loops/voice-loop/ledger.js");
      const { generateVoiceVariants } = await import("../loops/voice-loop/variantGenerator.js");
      const { runVoiceLibrarySelfImprove } = await import("../loops/voice-loop/selfImprove.js");

      const fbMetrics = await runFbMetricsIngest({ dryRun: true });
      const attribution = await runAttribution({ dryRun: true });
      const ledger = await runLedgerUpdate({ dryRun: true });

      const variants = await generateVoiceVariants({
        assetId: 0,
        slug: "dry-run-post",
        question: "Why do job applications get ignored?",
        answerMd: "Job applications are often ignored because of ATS filtering and lack of recruiter-ready language.",
        seoTitle: "Why Your Job Applications Get Ignored (Dry Run)",
      }, { dryRun: true });

      const selfImprove = await runVoiceLibrarySelfImprove({ dryRun: true });

      logger.info({ fbMetrics, attribution, ledger, variants: { generated: variants.variants.length, autoRejected: variants.autoRejected }, selfImprove }, "Voice loop dry-run completed");
    } catch (err) {
      logger.error({ err }, "Voice loop dry-run failed");
    } finally {
      voiceLoopDryRunRunning = false;
    }
  });
});

router.get("/voice-loop/status", (_req, res) => {
  res.json({ running: voiceLoopDryRunRunning });
});

router.post("/scrape-listings/run", async (req, res) => {
  if (scraperRunning) {
    res.status(409).json({ error: "Listing scraper is already running" });
    return;
  }
  scraperRunning = true;

  const { urls } = (req.body as { urls?: string[] }) ?? {};
  res.json({
    message: "Listing scraper triggered — running in background",
    status: "started",
    urls: urls ?? "default config",
  });

  setImmediate(async () => {
    try {
      const { runListingScraper } = await import("../loops/scrape-listings/index.js");
      const result = await runListingScraper(urls);
      logger.info({ result }, "Manual listing scraper run completed");
    } catch (err) {
      logger.error({ err }, "Manual listing scraper run failed");
    } finally {
      scraperRunning = false;
    }
  });
});

export default router;
