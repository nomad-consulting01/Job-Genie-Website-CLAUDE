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
