import { Router, type Request, type Response, type NextFunction } from "express";
import { getSchedulerStatus, pauseLoop, resumeLoop, type LoopName } from "../scheduler/index.js";
import { logger } from "../lib/logger.js";
import {
  readSelfImproveProposals,
  readVoiceLibrary,
  writeVoiceLibrary,
  writeSelfImproveProposals,
  appendVoiceChangelogEntry,
} from "../loops/voice-loop/fileStore.js";

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

// ── Status ────────────────────────────────────────────────────────────────────

/** GET /api/admin/loop-control/status — scheduler status + pause state for all loops */
router.get("/status", (_req, res) => {
  res.json(getSchedulerStatus());
});

// ── Pause / Resume ────────────────────────────────────────────────────────────

const VALID_LOOPS: LoopName[] = [
  "listingScraper", "loop1", "loop2", "loop3", "loop4",
  "reactorInviteHarvester", "voiceLoopMetrics", "voiceLoopSelfImprove",
];

/** POST /api/admin/loop-control/:loop/pause */
router.post("/:loop/pause", (req, res) => {
  const loop = req.params["loop"] as LoopName;
  if (!VALID_LOOPS.includes(loop)) {
    res.status(400).json({ error: `Unknown loop: ${loop}. Valid: ${VALID_LOOPS.join(", ")}` });
    return;
  }
  const result = pauseLoop(loop);
  logger.info({ loop, result }, "Admin: loop pause requested");
  res.json({ loop, ...result, pausedAt: result.paused ? new Date().toISOString() : undefined });
});

/** POST /api/admin/loop-control/:loop/resume */
router.post("/:loop/resume", (req, res) => {
  const loop = req.params["loop"] as LoopName;
  if (!VALID_LOOPS.includes(loop)) {
    res.status(400).json({ error: `Unknown loop: ${loop}. Valid: ${VALID_LOOPS.join(", ")}` });
    return;
  }
  const result = resumeLoop(loop);
  logger.info({ loop, result }, "Admin: loop resume requested");
  res.json({ loop, ...result, resumedAt: new Date().toISOString() });
});

// ── Self-Improve Proposals ────────────────────────────────────────────────────

/** GET /api/admin/loop-control/proposals — list all proposals */
router.get("/proposals", (_req, res) => {
  const propsFile = readSelfImproveProposals();
  res.json(propsFile);
});

let selfImproveRunning = false;

/** POST /api/admin/loop-control/self-improve/run — trigger manually */
router.post("/self-improve/run", async (_req, res) => {
  if (selfImproveRunning) {
    res.status(409).json({ error: "Self-improve already running" });
    return;
  }
  selfImproveRunning = true;
  res.json({ message: "Self-improve triggered — running in background", status: "started" });

  setImmediate(async () => {
    try {
      const { runVoiceLibrarySelfImprove } = await import("../loops/voice-loop/selfImprove.js");
      const result = await runVoiceLibrarySelfImprove();
      logger.info({ result }, "Manual self-improve completed");
    } catch (err) {
      logger.error({ err }, "Manual self-improve failed");
    } finally {
      selfImproveRunning = false;
    }
  });
});

/** GET /api/admin/loop-control/self-improve/status */
router.get("/self-improve/status", (_req, res) => {
  res.json({ running: selfImproveRunning });
});

/**
 * POST /api/admin/loop-control/proposals/:id/apply-selected
 * Body: { selectedIndices: number[], appliedBy?: string }
 *
 * Applies only the proposal actions at the given indices — admin cherry-picks
 * which tasks to complete before or after resume.
 */
router.post("/proposals/:id/apply-selected", async (req, res) => {
  const { id } = req.params;
  const { selectedIndices, appliedBy = "admin" } = req.body as {
    selectedIndices: number[];
    appliedBy?: string;
  };

  if (!Array.isArray(selectedIndices) || selectedIndices.length === 0) {
    res.status(400).json({ error: "selectedIndices must be a non-empty array of action indices" });
    return;
  }

  const propsFile = readSelfImproveProposals();
  const proposal = propsFile.proposals.find((p) => p.proposalId === id);

  if (!proposal) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }
  if (proposal.status !== "pending") {
    res.status(409).json({ error: `Proposal is already ${proposal.status}` });
    return;
  }

  const invalidIndices = selectedIndices.filter(
    (i) => i < 0 || i >= proposal.proposals.length
  );
  if (invalidIndices.length > 0) {
    res.status(400).json({
      error: `Invalid indices: ${invalidIndices.join(", ")}. Proposal has ${proposal.proposals.length} actions (0-based).`,
    });
    return;
  }

  const voiceLib = readVoiceLibrary();
  const appliedActions: string[] = [];

  for (const idx of selectedIndices) {
    const action = proposal.proposals[idx]!;
    if (action.action === "retire") {
      const voice = voiceLib.voices.find((v) => v.id === action.voiceId);
      if (voice) { voice.active = false; appliedActions.push(`retire:${action.voiceId}`); }
    } else if (action.action === "spawn" && action.newSpec) {
      const existing = voiceLib.voices.find((v) => v.id === action.voiceId);
      if (!existing) {
        voiceLib.voices.push(action.newSpec as typeof voiceLib.voices[number]);
        appliedActions.push(`spawn:${action.voiceId}`);
      }
    } else if (action.action === "reweight" && action.newWeight !== undefined) {
      const voice = voiceLib.voices.find((v) => v.id === action.voiceId);
      if (voice) { voice.samplingWeight = action.newWeight; appliedActions.push(`reweight:${action.voiceId}`); }
    }
  }

  voiceLib.updatedAt = new Date().toISOString();
  writeVoiceLibrary(voiceLib);

  // Mark proposal as applied (partially or fully)
  proposal.status = "applied";
  proposal.appliedAt = new Date().toISOString();
  proposal.appliedBy = `${appliedBy} (selected: ${selectedIndices.join(",")})`;
  writeSelfImproveProposals(propsFile);

  appendVoiceChangelogEntry(
    `\n**Proposal ${id} PARTIALLY APPLIED** by ${appliedBy} on ${new Date().toISOString().slice(0, 10)}\n` +
    `Actions applied: ${appliedActions.join(", ")}\n` +
    `Skipped indices: ${proposal.proposals
      .map((_, i) => i)
      .filter((i) => !selectedIndices.includes(i))
      .join(", ") || "none"}\n`
  );

  logger.info({ proposalId: id, appliedActions, appliedBy }, "Partial proposal apply completed");
  res.json({ applied: true, appliedActions });
});

/**
 * POST /api/admin/loop-control/proposals/:id/apply
 * Applies all actions in a proposal (existing behaviour, now also exposed here).
 */
router.post("/proposals/:id/apply", async (req, res) => {
  const { id } = req.params;
  const { appliedBy = "admin" } = req.body as { appliedBy?: string };
  try {
    const { applySelfImproveProposal } = await import("../loops/voice-loop/selfImprove.js");
    const result = await applySelfImproveProposal(id, appliedBy);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Apply proposal failed");
    res.status(500).json({ error: "Failed to apply proposal" });
  }
});

/** POST /api/admin/loop-control/proposals/:id/dismiss */
router.post("/proposals/:id/dismiss", async (req, res) => {
  const { id } = req.params;
  try {
    const { dismissSelfImproveProposal } = await import("../loops/voice-loop/selfImprove.js");
    const result = await dismissSelfImproveProposal(id);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Dismiss proposal failed");
    res.status(500).json({ error: "Failed to dismiss proposal" });
  }
});

export default router;
