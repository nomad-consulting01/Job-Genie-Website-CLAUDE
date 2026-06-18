import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken(): string {
  return localStorage.getItem("admin_token") ?? "";
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

interface Question {
  id: number;
  source: string;
  sourceUrl: string | null;
  normalisedQuestion: string;
  painPointTags: string[];
  engagementSignal: number;
  discoveredAt: string;
  status: string;
}

interface Answer {
  answer: { id: number; answerFirstBlock: string; answerMd: string; qualityScore: number; modelUsed: string; createdAt: string };
  question: { id: number; normalisedQuestion: string };
}

interface LoopRun {
  id: number;
  loop: string;
  startedAt: string;
  finishedAt: string | null;
  itemsProcessed: number;
  costEstimate: number | null;
  status: string;
  error: string | null;
}

interface Stats {
  totalQuestions: number;
  pendingQuestions: number;
  answeredQuestions: number;
  totalAnswers: number;
  publishedAssets: number;
  draftAssets: number;
}

type Tab = "overview" | "questions" | "answers" | "runs";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/30 text-yellow-300 border-yellow-700/40",
  approved: "bg-green-900/30 text-green-300 border-green-700/40",
  rejected: "bg-red-900/30 text-red-300 border-red-700/40",
  answered: "bg-teal-900/30 text-teal-300 border-teal-700/40",
  pending_review: "bg-orange-900/30 text-orange-300 border-orange-700/40",
  published: "bg-purple-900/30 text-purple-300 border-purple-700/40",
  running: "bg-blue-900/30 text-blue-300 border-blue-700/40",
  completed: "bg-green-900/30 text-green-300 border-green-700/40",
  completed_with_errors: "bg-orange-900/30 text-orange-300 border-orange-700/40",
  failed: "bg-red-900/30 text-red-300 border-red-700/40",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[status] ?? "bg-gray-800 text-gray-300 border-gray-700"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function AdminCorpus() {
  const [token, setToken] = useState(getToken());
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [runs, setRuns] = useState<LoopRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [loop1Status, setLoop1Status] = useState<string | null>(null);
  const [seedText, setSeedText] = useState("");
  const [seedUrl, setSeedUrl] = useState("");
  const [seedSource, setSeedSource] = useState<"manual" | "quora" | "linkedin">("manual");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const [redditUrl, setRedditUrl] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{
    title: string; subreddit: string; type: "post" | "listing"; totalComments: number;
    postText: string; postScore: number; postUrl: string;
    comments: Array<{ text: string; score: number; url: string }>;
  } | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<{ scraped: number; imported: number; skipped: number } | null>(null);

  const saveToken = (t: string) => {
    setToken(t);
    localStorage.setItem("admin_token", t);
  };

  const fetchStats = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/admin/corpus/stats`, { headers: authHeaders() });
    if (r.ok) setStats(await r.json() as Stats);
  }, []);

  const fetchQuestions = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/admin/corpus/questions?limit=50`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json() as { questions: Question[] }; setQuestions(d.questions); }
  }, []);

  const fetchAnswers = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/admin/corpus/answers?limit=50`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json() as { answers: Answer[] }; setAnswers(d.answers); }
  }, []);

  const fetchRuns = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/admin/corpus/loop-runs?loop=loop1`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json() as { runs: LoopRun[] }; setRuns(d.runs); }
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([fetchStats(), fetchQuestions(), fetchAnswers(), fetchRuns()]).finally(() => setLoading(false));
  }, [token, fetchStats, fetchQuestions, fetchAnswers, fetchRuns]);

  const updateQStatus = async (id: number, status: string) => {
    await fetch(`${API_BASE}/api/admin/corpus/questions/${id}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    await fetchQuestions();
    await fetchStats();
  };

  const scrapeRedditUrl = async () => {
    setScrapeError(null);
    setScrapeResult(null);
    setIngestResult(null);
    if (!redditUrl.trim()) { setScrapeError("Enter a Reddit URL"); return; }
    setScrapeLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/corpus/scrape-url`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ url: redditUrl.trim() }),
      });
      const d = await r.json() as { error?: string } & typeof scrapeResult;
      if (!r.ok) { setScrapeError((d as { error?: string }).error ?? "Scrape failed"); return; }
      setScrapeResult(d as typeof scrapeResult);
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Network error");
    } finally {
      setScrapeLoading(false);
    }
  };

  const ingestRedditUrl = async () => {
    setIngestResult(null);
    setIngestLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/corpus/ingest-url`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          url: redditUrl.trim(),
          // Send cached scrape data to avoid a second Reddit request
          items: scrapeResult?.comments ?? [],
        }),
      });
      const d = await r.json() as { scraped: number; imported: number; skipped: number; error?: string };
      if (!r.ok) { setScrapeError(d.error ?? "Ingest failed"); return; }
      setIngestResult(d);
      await fetchQuestions();
      await fetchStats();
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Network error");
    } finally {
      setIngestLoading(false);
    }
  };

  const triggerLoop1 = async () => {
    setLoop1Status("triggering…");
    const r = await fetch(`${API_BASE}/api/admin/loops/loop1/run`, { method: "POST", headers: authHeaders() });
    if (r.ok) {
      setLoop1Status("running in background — check Loop Runs tab");
      setTimeout(() => fetchRuns(), 3000);
    } else {
      const d = await r.json() as { error?: string };
      setLoop1Status(`Error: ${d.error ?? "unknown"}`);
    }
  };

  const seedQuestion = async () => {
    setSeedError(null);
    setSeedSuccess(false);
    if (!seedText.trim()) { setSeedError("Enter the question text"); return; }
    const r = await fetch(`${API_BASE}/api/admin/corpus/questions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ raw_text: seedText, source_url: seedUrl || null, source: seedSource }),
    });
    if (r.ok) {
      setSeedSuccess(true);
      setSeedText("");
      setSeedUrl("");
      await fetchQuestions();
      await fetchStats();
    } else {
      const d = await r.json() as { error?: string };
      setSeedError(d.error ?? "Failed to seed question");
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center px-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-white mb-6">Corpus Admin — Login</h1>
          <input
            type="password"
            placeholder="Admin token"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white mb-4 outline-none focus:border-purple-500"
            onKeyDown={(e) => e.key === "Enter" && saveToken((e.target as HTMLInputElement).value)}
          />
          <button
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 font-semibold"
            onClick={(e) => {
              const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
              saveToken(input.value);
            }}
          >
            Access Admin
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "questions", label: `Questions (${questions.length})` },
    { id: "answers", label: `Answers (${answers.length})` },
    { id: "runs", label: `Loop Runs (${runs.length})` },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-gray-100">
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div>
          <a href="/" className="font-bold text-white text-lg">Job <span className="text-purple-400">Genie</span></a>
          <span className="ml-3 text-sm text-gray-500">/ Corpus Admin</span>
        </div>
        <button
          onClick={() => { localStorage.removeItem("admin_token"); setToken(""); }}
          className="text-xs text-gray-500 hover:text-red-400"
        >
          Sign out
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-5 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/8">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === t.id ? "bg-purple-600/20 text-purple-300 border-b-2 border-purple-500" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-gray-400 text-sm mb-4">Loading…</p>}

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Total Questions", value: stats.totalQuestions },
                  { label: "Pending", value: stats.pendingQuestions },
                  { label: "Answered", value: stats.answeredQuestions },
                  { label: "Total Answers", value: stats.totalAnswers },
                  { label: "Published AEO", value: stats.publishedAssets },
                  { label: "Drafts", value: stats.draftAssets },
                ].map((s) => (
                  <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{s.value ?? 0}</div>
                    <div className="text-xs text-gray-400 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Reddit URL Scraper */}
            <div className="bg-white/5 border border-white/8 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Scrape Reddit Thread</h2>
              <p className="text-sm text-gray-400 mb-4">
                Paste any Reddit link — including Share button links — to preview and import all comments as corpus questions.
                No API credentials required.
              </p>
              <div className="flex gap-3 mb-4">
                <input
                  value={redditUrl}
                  onChange={(e) => { setRedditUrl(e.target.value); setScrapeResult(null); setScrapeError(null); setIngestResult(null); }}
                  onKeyDown={(e) => e.key === "Enter" && scrapeRedditUrl()}
                  placeholder="https://www.reddit.com/r/jobs/s/…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-orange-500 font-mono"
                />
                <button
                  onClick={scrapeRedditUrl}
                  disabled={scrapeLoading}
                  className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
                >
                  {scrapeLoading ? "Scraping…" : "🔍 Scrape"}
                </button>
              </div>

              {scrapeError && <p className="text-red-400 text-sm mb-3">{scrapeError}</p>}

              {scrapeResult && (
                <div className="space-y-3">
                  <div className="bg-white/5 border border-orange-700/30 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-white">{scrapeResult.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            scrapeResult.type === "listing"
                              ? "bg-blue-900/30 text-blue-300 border-blue-700/40"
                              : "bg-orange-900/30 text-orange-300 border-orange-700/40"
                          }`}>
                            {scrapeResult.type === "listing" ? "subreddit listing" : "post + comments"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          r/{scrapeResult.subreddit} · {scrapeResult.comments.length} {scrapeResult.type === "listing" ? "posts" : "comments"} scraped
                          {scrapeResult.type === "post" && ` · ↑${scrapeResult.postScore}`}
                        </p>
                      </div>
                      <button
                        onClick={ingestRedditUrl}
                        disabled={ingestLoading}
                        className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0"
                      >
                        {ingestLoading ? "Importing…" : `↓ Import ${scrapeResult.comments.length + (scrapeResult.type === "post" ? 1 : 0)} items`}
                      </button>
                    </div>
                    {ingestResult && (
                      <p className="mt-3 text-sm text-teal-300">
                        ✓ Imported {ingestResult.imported} new · {ingestResult.skipped} duplicates skipped
                      </p>
                    )}
                  </div>

                  {scrapeResult.postText && (
                    <div className="bg-white/3 border border-white/8 rounded-lg p-3">
                      <p className="text-xs text-orange-400 font-medium mb-1">Original post</p>
                      <p className="text-xs text-gray-300 line-clamp-4">{scrapeResult.postText}</p>
                    </div>
                  )}

                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {scrapeResult.comments.map((c, i) => (
                      <div key={i} className="bg-white/3 border border-white/8 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-300 line-clamp-3">{c.text}</p>
                        <p className="text-xs text-gray-600 mt-1">↑{c.score}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Loop 1 trigger */}
            <div className="bg-white/5 border border-white/8 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Loop 1 — Pain Point Miner</h2>
              <p className="text-sm text-gray-400 mb-4">
                Ingests Reddit posts → normalises questions → Claude answers → quality gate → publishes AEO pages.
                Runs automatically at 3 AM daily; trigger manually here.
              </p>
              <button
                onClick={triggerLoop1}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-semibold"
              >
                ▶ Trigger Loop 1 Now
              </button>
              {loop1Status && (
                <p className="mt-3 text-sm text-purple-300">{loop1Status}</p>
              )}
            </div>

            {/* Manual seed */}
            <div className="bg-white/5 border border-white/8 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Seed a Question Manually</h2>
              <p className="text-sm text-gray-400 mb-4">
                Paste a question or full post text. Claude will normalise it and add it to the pending queue.
                Use for Quora threads, LinkedIn comments, or your own observations.
              </p>
              <div className="space-y-3">
                <textarea
                  value={seedText}
                  onChange={(e) => setSeedText(e.target.value)}
                  rows={4}
                  placeholder="Paste the question or pain-point post here…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-purple-500 resize-none"
                />
                <div className="flex gap-3">
                  <input
                    value={seedUrl}
                    onChange={(e) => setSeedUrl(e.target.value)}
                    placeholder="Source URL (optional)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                  />
                  <select
                    value={seedSource}
                    onChange={(e) => setSeedSource(e.target.value as "manual" | "quora" | "linkedin")}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                  >
                    <option value="manual">Manual</option>
                    <option value="quora">Quora</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                </div>
                {seedError && <p className="text-red-400 text-sm">{seedError}</p>}
                {seedSuccess && <p className="text-green-400 text-sm">✓ Question seeded successfully</p>}
                <button
                  onClick={seedQuestion}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-semibold"
                >
                  Seed Question
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUESTIONS */}
        {tab === "questions" && (
          <div className="space-y-3">
            {questions.length === 0 && <p className="text-gray-400 text-sm">No questions yet.</p>}
            {questions.map((q) => (
              <div key={q.id} className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{q.normalisedQuestion}</p>
                    <div className="flex flex-wrap gap-2 mt-2 items-center">
                      <StatusBadge status={q.status} />
                      <span className="text-xs text-gray-500">{q.source}</span>
                      {q.engagementSignal > 0 && (
                        <span className="text-xs text-gray-500">↑{q.engagementSignal}</span>
                      )}
                      {q.painPointTags.map((t) => (
                        <span key={t} className="text-xs text-purple-400">{t.replace(/_/g, " ")}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {q.status !== "approved" && (
                      <button
                        onClick={() => updateQStatus(q.id, "approved")}
                        className="text-xs bg-green-900/30 text-green-300 border border-green-700/40 px-2 py-1 rounded hover:bg-green-900/50"
                      >
                        Approve
                      </button>
                    )}
                    {q.status !== "rejected" && (
                      <button
                        onClick={() => updateQStatus(q.id, "rejected")}
                        className="text-xs bg-red-900/30 text-red-300 border border-red-700/40 px-2 py-1 rounded hover:bg-red-900/50"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ANSWERS */}
        {tab === "answers" && (
          <div className="space-y-4">
            {answers.length === 0 && <p className="text-gray-400 text-sm">No answers yet.</p>}
            {answers.map((a) => (
              <div key={a.answer.id} className="bg-white/5 border border-white/8 rounded-xl p-5">
                <p className="text-xs text-gray-400 mb-2">{a.question.normalisedQuestion}</p>
                <blockquote className="border-l-2 border-purple-500 pl-3 text-sm text-gray-200 italic mb-3">
                  {a.answer.answerFirstBlock}
                </blockquote>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>Score: <strong className="text-white">{a.answer.qualityScore?.toFixed(1) ?? "—"}/10</strong></span>
                  <span>{a.answer.modelUsed}</span>
                  <span>{new Date(a.answer.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LOOP RUNS */}
        {tab === "runs" && (
          <div className="space-y-3">
            {runs.length === 0 && <p className="text-gray-400 text-sm">No loop runs yet. Trigger Loop 1 from the Overview tab.</p>}
            {runs.map((r) => (
              <div key={r.id} className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="font-medium text-white text-sm">Run #{r.id}</span>
                    <span className="text-gray-500 text-xs ml-2">{r.loop}</span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
                  <span>Started: {new Date(r.startedAt).toLocaleString()}</span>
                  {r.finishedAt && <span>Finished: {new Date(r.finishedAt).toLocaleString()}</span>}
                  <span>Items: {r.itemsProcessed ?? 0}</span>
                  {r.costEstimate != null && <span>Cost: ${r.costEstimate.toFixed(4)}</span>}
                </div>
                {r.error && (
                  <p className="mt-2 text-xs text-red-400 bg-red-900/10 rounded px-3 py-1">{r.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
