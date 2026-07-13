import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { reactorInvitePosts, reactorInviteSessions } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { engineConfig } from "../config/engine.js";
import { logger } from "../lib/logger.js";

const GRAPH_API = "https://graph.facebook.com/v19.0";

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

/** Scorer: is this post invite-ready? */
function isInviteReady(post: typeof reactorInvitePosts.$inferSelect): boolean {
  const cfg = engineConfig.reactorInvites;
  if (post.inviteStatus === "skipped") return false;
  if (post.reactionDelta >= cfg.inviteReadyDelta) return true;
  if (post.totalReactions >= cfg.inviteReadyMinTotal && post.inviteStatus === "never_invited") return true;
  return false;
}

/** GET /queue — invite-ready posts ranked by reaction_delta desc */
router.get("/queue", async (_req, res) => {
  try {
    const all = await db
      .select()
      .from(reactorInvitePosts)
      .orderBy(desc(reactorInvitePosts.reactionDelta));

    const items = all.filter(isInviteReady).map((p) => ({
      post_id: p.postId,
      post_snippet: p.postSnippet,
      permalink: p.permalink,
      published_at: p.publishedAt,
      last_harvested_at: p.lastHarvestedAt,
      total_reactions: p.totalReactions,
      reaction_delta: p.reactionDelta,
      reaction_breakdown: p.reactionBreakdown,
      invite_status: p.inviteStatus,
      invites_sent_count: p.invitesSentCount,
      last_invited_at: p.lastInvitedAt,
    }));

    res.json({ items, total: items.length });
  } catch (err) {
    logger.error({ err }, "GET /reactor-invites/queue failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /all — all harvested posts (admin view) */
router.get("/all", async (_req, res) => {
  try {
    const all = await db
      .select()
      .from(reactorInvitePosts)
      .orderBy(desc(reactorInvitePosts.reactionDelta));
    res.json({ items: all, total: all.length });
  } catch (err) {
    logger.error({ err }, "GET /reactor-invites/all failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /daily-cap — today's invite count and remaining headroom (midnight ET reset) */
router.get("/daily-cap", async (_req, res) => {
  try {
    const cfg = engineConfig.reactorInvites;

    // Compute midnight ET (approximate as UTC-5; good enough for daily reset)
    const etOffsetMs = -5 * 3600 * 1000;
    const nowEt = new Date(Date.now() + etOffsetMs);
    const midnightEt = new Date(nowEt);
    midnightEt.setUTCHours(0, 0, 0, 0);
    const midnightUtc = new Date(midnightEt.getTime() - etOffsetMs);

    const [row] = await db
      .select({ total: sql<number>`COALESCE(SUM(${reactorInviteSessions.invitesSent}), 0)` })
      .from(reactorInviteSessions)
      .where(sql`${reactorInviteSessions.loggedAt} >= ${midnightUtc.toISOString()}::timestamptz`);

    const todaySent = Number(row?.total ?? 0);
    const remaining = Math.max(0, cfg.dailyCap - todaySent);
    const isWarning = todaySent >= cfg.dailyCapWarning;

    res.json({
      today_invites_sent: todaySent,
      daily_cap: cfg.dailyCap,
      warning_threshold: cfg.dailyCapWarning,
      remaining,
      is_warning: isWarning,
      reset_reference: "Midnight ET",
    });
  } catch (err) {
    logger.error({ err }, "GET /reactor-invites/daily-cap failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /weekly-report — weekly rollup + live follower count snapshot */
router.get("/weekly-report", async (_req, res) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [sessionStats] = await db
      .select({
        totalInvites: sql<number>`COALESCE(SUM(${reactorInviteSessions.invitesSent}), 0)`,
        postsActioned: sql<number>`COUNT(DISTINCT ${reactorInviteSessions.postId})`,
      })
      .from(reactorInviteSessions)
      .where(sql`${reactorInviteSessions.loggedAt} >= ${weekAgo.toISOString()}::timestamptz`);

    let followersCount: number | null = null;
    const pageId = process.env["FACEBOOK_PAGE_ID"];
    const pageToken = process.env["FACEBOOK_PAGE_ACCESS_TOKEN"];
    if (pageId && pageToken) {
      try {
        const resp = await fetch(
          `${GRAPH_API}/${pageId}?fields=followers_count&access_token=${encodeURIComponent(pageToken)}`
        );
        const json = (await resp.json()) as { followers_count?: number; error?: unknown };
        if (!json.error) followersCount = json.followers_count ?? null;
      } catch {}
    }

    res.json({
      total_invites_sent: Number(sessionStats?.totalInvites ?? 0),
      posts_actioned: Number(sessionStats?.postsActioned ?? 0),
      followers_count: followersCount,
      period_days: 7,
      period_start: weekAgo.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "GET /reactor-invites/weekly-report failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /:postId/mark-invited — log a human invite session */
router.post("/:postId/mark-invited", async (req, res) => {
  try {
    const postId = decodeURIComponent(req.params["postId"] ?? "");
    const { count } = req.body as { count?: number };

    if (!count || !Number.isInteger(count) || count < 1) {
      res.status(400).json({ error: "count must be a positive integer" });
      return;
    }

    const [existing] = await db
      .select()
      .from(reactorInvitePosts)
      .where(eq(reactorInvitePosts.postId, postId));

    if (!existing) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    await db.insert(reactorInviteSessions).values({
      postId,
      invitesSent: count,
      loggedAt: new Date(),
    });

    await db
      .update(reactorInvitePosts)
      .set({
        inviteStatus: "invited",
        invitesSentCount: sql`${reactorInvitePosts.invitesSentCount} + ${count}`,
        lastInvitedAt: new Date(),
      })
      .where(eq(reactorInvitePosts.postId, postId));

    logger.info({ postId, count }, "Reactor invites: session logged");
    res.json({ ok: true, postId, count });
  } catch (err) {
    logger.error({ err }, "POST /reactor-invites/:postId/mark-invited failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /:postId/skip — remove a post from the invite queue */
router.post("/:postId/skip", async (req, res) => {
  try {
    const postId = decodeURIComponent(req.params["postId"] ?? "");
    await db
      .update(reactorInvitePosts)
      .set({ inviteStatus: "skipped" })
      .where(eq(reactorInvitePosts.postId, postId));
    res.json({ ok: true, postId });
  } catch (err) {
    logger.error({ err }, "POST /reactor-invites/:postId/skip failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /harvest — trigger the reaction harvester in the background */
router.post("/harvest", async (_req, res) => {
  res.json({ message: "Harvest triggered — running in background", status: "started" });
  (async () => {
    try {
      const { runHarvester } = await import("../loops/reactor-invite-queue/harvester.js");
      const result = await runHarvester();
      logger.info(result, "Manual reactor invite harvest complete");
    } catch (err) {
      logger.error({ err }, "Manual reactor invite harvest failed");
    }
  })();
});

export default router;
