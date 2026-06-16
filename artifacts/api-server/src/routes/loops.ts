import { Router, type Request, type Response, type NextFunction } from "express";
import { getSchedulerStatus } from "../scheduler/index.js";
import { logger } from "../lib/logger.js";

const router = Router();
let loop1Running = false;

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

export default router;
