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
} from "../corpus/db.js";
import { seedManualQuestion } from "../loops/loop1/ingest.js";
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
    await updateContentAssetStatus(id, status, status === "published" ? new Date() : undefined);
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

export default router;
