import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, "../../../content");
const LANDING_PAGES_FILE = path.join(CONTENT_DIR, "landing-pages.json");

const router = Router();

// ─── Auth ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJson<T>(filename: string): T {
  const file = path.join(CONTENT_DIR, filename);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

function writeJson(filename: string, data: unknown): void {
  const file = path.join(CONTENT_DIR, filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function nextId(entries: Array<{ id: string }>, prefix: string): string {
  const nums = entries
    .map((e) => parseInt(e.id.replace(prefix + "-", ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface EngagementEntry {
  id: string;
  date: string;
  accountHandle: string;
  subreddit: string;
  threadUrl: string;
  type: "comment" | "post" | "reply";
  category: "help" | "mention" | "defence";
  summary: string;
  mentionedJobGenie: boolean;
  disclosureIncluded: boolean;
  engagementOutcome: string;
  notes?: string;
}

interface MentionEntry {
  id: string;
  discoveredAt: string;
  threadUrl: string;
  subreddit: string;
  mentionType: "positive" | "neutral" | "criticism" | "question";
  severity: "low" | "medium" | "high";
  summary: string;
  assignedResponder: string;
  responseStatus: "pending" | "responded" | "resolved" | "no_action";
  responseUrl: string | null;
  outcome: string;
  notes?: string;
}

interface CitationAuditRun {
  runId: string;
  month: number;
  runDate: string;
  conductedBy: string;
  results: Array<{
    promptId: string;
    engine: string;
    sourcesCited: string[];
    jobGenieCited: boolean;
    teamAuthoredThreadCited: boolean;
    jobGenieUrl: string | null;
    notes: string;
  }>;
}

interface Account {
  handle: string;
  realName: string;
  role: string;
  assignedSubs: string[];
  accountCreatedAt: string;
  disclosureBioStatus: boolean;
  notes?: string;
}

// ─── GET /api/admin/reddit-aeo/dashboard ─────────────────────────────────────

router.get("/dashboard", (_req, res) => {
  const engLog = readJson<{ entries: EngagementEntry[] }>("reddit-engagement-log.json");
  const mentions = readJson<{ entries: MentionEntry[] }>("reddit-mentions-log.json");
  const audits = readJson<{ baseline: CitationAuditRun | null; runs: CitationAuditRun[] }>(
    "reddit-citation-audits.json"
  );
  const accounts = readJson<{ accounts: Account[] }>("reddit-accounts.json");

  // Cadence: group by account × ISO week
  const weekMap: Record<string, Record<string, number>> = {};
  const mentionCountMap: Record<string, number> = {};
  for (const e of engLog.entries) {
    const week = isoWeek(e.date);
    if (!weekMap[e.accountHandle]) weekMap[e.accountHandle] = {};
    weekMap[e.accountHandle][week] = (weekMap[e.accountHandle][week] ?? 0) + 1;
    if (e.mentionedJobGenie) {
      mentionCountMap[e.accountHandle] = (mentionCountMap[e.accountHandle] ?? 0) + 1;
    }
  }

  // Per-account streak (consecutive weeks with ≥1 entry)
  const streaks: Array<{
    handle: string;
    currentStreak: number;
    helpCount: number;
    mentionCount: number;
    ratioOk: boolean;
    lastActive: string | null;
  }> = [];

  for (const acc of accounts.accounts) {
    const handle = acc.handle;
    const weeks = Object.keys(weekMap[handle] ?? {}).sort();
    let streak = 0;
    if (weeks.length) {
      const currentWeek = isoWeek(new Date().toISOString());
      let check = currentWeek;
      for (let i = weeks.length - 1; i >= 0; i--) {
        if (weeks[i] === check) {
          streak++;
          check = prevWeek(check);
        } else {
          break;
        }
      }
    }
    const entries = engLog.entries.filter((e) => e.accountHandle === handle);
    const helpCount = entries.filter((e) => e.category === "help").length;
    const mentionCount = entries.filter((e) => e.category === "mention").length;
    const total = entries.length;
    const ratioOk = total === 0 || mentionCount / total <= 0.25;
    const lastActive = entries.length
      ? entries.sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null
      : null;

    streaks.push({ handle, currentStreak: streak, helpCount, mentionCount, ratioOk, lastActive });
  }

  // Mentions triage summary
  const pendingMentions = mentions.entries.filter((m) => m.responseStatus === "pending");
  const highSeverity = pendingMentions.filter((m) => m.severity === "high");

  // Citation lift: job-genie cited rate per run
  const citationTrend = [audits.baseline, ...audits.runs]
    .filter(Boolean)
    .map((run) => {
      if (!run) return null;
      const total = run.results.length;
      const cited = run.results.filter((r) => r.jobGenieCited).length;
      const teamCited = run.results.filter((r) => r.teamAuthoredThreadCited).length;
      return {
        runId: run.runId,
        month: run.month,
        runDate: run.runDate,
        citationRate: total > 0 ? Math.round((cited / total) * 100) : 0,
        teamAuthoredCitationRate: total > 0 ? Math.round((teamCited / total) * 100) : 0,
        totalPrompts: total,
        jobGenieCited: cited,
      };
    })
    .filter(Boolean);

  res.json({
    cadenceStreaks: streaks,
    mentions: {
      pendingCount: pendingMentions.length,
      highSeverityCount: highSeverity.length,
      recentPending: pendingMentions.slice(0, 5),
    },
    citationTrend,
    totalEngagementEntries: engLog.entries.length,
    totalAccounts: accounts.accounts.length,
  });
});

// ─── Accounts ─────────────────────────────────────────────────────────────────

router.get("/accounts", (_req, res) => {
  res.json(readJson("reddit-accounts.json"));
});

router.post("/accounts", (req, res) => {
  const data = readJson<{ accounts: Account[] }>("reddit-accounts.json");
  const body = req.body as Account;
  if (!body.handle || !body.realName || !body.role) {
    res.status(400).json({ error: "handle, realName, and role are required" });
    return;
  }
  if (data.accounts.find((a) => a.handle === body.handle)) {
    res.status(409).json({ error: "Account with this handle already exists" });
    return;
  }
  const account: Account = {
    handle: body.handle,
    realName: body.realName,
    role: body.role,
    assignedSubs: body.assignedSubs ?? [],
    accountCreatedAt: body.accountCreatedAt ?? new Date().toISOString(),
    disclosureBioStatus: body.disclosureBioStatus ?? false,
    notes: body.notes,
  };
  data.accounts.push(account);
  writeJson("reddit-accounts.json", data);
  res.status(201).json(account);
});

router.patch("/accounts/:handle", (req, res) => {
  const data = readJson<{ accounts: Account[] }>("reddit-accounts.json");
  const idx = data.accounts.findIndex((a) => a.handle === req.params["handle"]);
  if (idx === -1) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  data.accounts[idx] = { ...data.accounts[idx]!, ...(req.body as Partial<Account>) };
  writeJson("reddit-accounts.json", data);
  res.json(data.accounts[idx]);
});

// ─── Engagement Log ───────────────────────────────────────────────────────────

router.get("/engagement", (_req, res) => {
  res.json(readJson("reddit-engagement-log.json"));
});

router.post("/engagement", (req, res) => {
  const data = readJson<{ entries: EngagementEntry[] }>("reddit-engagement-log.json");
  const body = req.body as Omit<EngagementEntry, "id">;
  if (!body.accountHandle || !body.date || !body.subreddit || !body.type || !body.category) {
    res.status(400).json({ error: "accountHandle, date, subreddit, type, and category are required" });
    return;
  }
  const entry: EngagementEntry = {
    id: nextId(data.entries, "eng"),
    date: body.date,
    accountHandle: body.accountHandle,
    subreddit: body.subreddit,
    threadUrl: body.threadUrl ?? "",
    type: body.type,
    category: body.category,
    summary: body.summary ?? "",
    mentionedJobGenie: body.mentionedJobGenie ?? false,
    disclosureIncluded: body.disclosureIncluded ?? false,
    engagementOutcome: body.engagementOutcome ?? "unknown",
    notes: body.notes,
  };
  data.entries.push(entry);
  writeJson("reddit-engagement-log.json", data);
  res.status(201).json(entry);
});

// ─── Mentions Log ─────────────────────────────────────────────────────────────

router.get("/mentions", (_req, res) => {
  res.json(readJson("reddit-mentions-log.json"));
});

router.post("/mentions", (req, res) => {
  const data = readJson<{ entries: MentionEntry[] }>("reddit-mentions-log.json");
  const body = req.body as Omit<MentionEntry, "id">;
  if (!body.threadUrl || !body.subreddit || !body.mentionType || !body.summary) {
    res.status(400).json({ error: "threadUrl, subreddit, mentionType, and summary are required" });
    return;
  }
  const entry: MentionEntry = {
    id: nextId(data.entries, "mnt"),
    discoveredAt: body.discoveredAt ?? new Date().toISOString(),
    threadUrl: body.threadUrl,
    subreddit: body.subreddit,
    mentionType: body.mentionType,
    severity: body.severity ?? "low",
    summary: body.summary,
    assignedResponder: body.assignedResponder ?? "",
    responseStatus: body.responseStatus ?? "pending",
    responseUrl: body.responseUrl ?? null,
    outcome: body.outcome ?? "monitoring",
    notes: body.notes,
  };
  data.entries.push(entry);
  writeJson("reddit-mentions-log.json", data);
  res.status(201).json(entry);
});

router.patch("/mentions/:id", (req, res) => {
  const data = readJson<{ entries: MentionEntry[] }>("reddit-mentions-log.json");
  const idx = data.entries.findIndex((e) => e.id === req.params["id"]);
  if (idx === -1) {
    res.status(404).json({ error: "Mention not found" });
    return;
  }
  data.entries[idx] = { ...data.entries[idx]!, ...(req.body as Partial<MentionEntry>) };
  writeJson("reddit-mentions-log.json", data);
  res.json(data.entries[idx]);
});

// ─── Citation Audits ──────────────────────────────────────────────────────────

router.get("/audits", (_req, res) => {
  res.json(readJson("reddit-citation-audits.json"));
});

router.post("/audits", (req, res) => {
  const data = readJson<{ baseline: CitationAuditRun | null; runs: CitationAuditRun[] }>(
    "reddit-citation-audits.json"
  );
  const body = req.body as Omit<CitationAuditRun, "runId">;
  if (body.month === undefined || !body.runDate || !body.conductedBy) {
    res.status(400).json({ error: "month, runDate, and conductedBy are required" });
    return;
  }

  const isBaseline = body.month === 0 && data.baseline === null;
  const run: CitationAuditRun = {
    runId: isBaseline ? "audit-m0" : `audit-m${body.month}-${Date.now()}`,
    month: body.month,
    runDate: body.runDate,
    conductedBy: body.conductedBy,
    results: body.results ?? [],
  };

  if (isBaseline) {
    data.baseline = run;
  } else {
    data.runs.push(run);
  }
  writeJson("reddit-citation-audits.json", data);

  // Feedback wiring: new questions from audit notes → landing-pages.json drafts
  const newQuestions: string[] = (body.results ?? [])
    .map((r) => r.notes)
    .filter((n) => n?.startsWith("NEW_QUESTION:"))
    .map((n) => n.replace("NEW_QUESTION:", "").trim());

  if (newQuestions.length) {
    const lpData = JSON.parse(fs.readFileSync(LANDING_PAGES_FILE, "utf-8")) as { pages: unknown[] };
    for (const q of newQuestions) {
      lpData.pages.push({
        _draft: true,
        _source: "reddit-aeo-citation-audit",
        _addedAt: new Date().toISOString(),
        primaryQuestion: q,
        slug: "",
        metaTitle: "",
        metaDescription: "",
        h1: "",
        directAnswer: "",
        keyTakeaways: [],
        sections: [],
      });
    }
    fs.writeFileSync(LANDING_PAGES_FILE, JSON.stringify(lpData, null, 2), "utf-8");
  }

  res.status(201).json({ run, newQuestionsAdded: newQuestions.length });
});

// ─── Targets & Prompt Set (read-only via API; editing is done in JSON files) ──

router.get("/targets", (_req, res) => {
  res.json(readJson("reddit-targets.json"));
});

router.get("/prompt-set", (_req, res) => {
  res.json(readJson("reddit-prompt-set.json"));
});

// ─── ISO Week Helpers ─────────────────────────────────────────────────────────

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function prevWeek(isoWeekStr: string): string {
  const [year, week] = isoWeekStr.split("-W").map(Number) as [number, number];
  if (week === 1) return `${year - 1}-W52`;
  return `${year}-W${String(week - 1).padStart(2, "0")}`;
}

export default router;
