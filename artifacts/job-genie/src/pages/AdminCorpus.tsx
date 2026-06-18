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

interface Loop2Asset {
  asset: {
    id: number;
    answerId: number;
    channel: string;
    variant: string;
    payloadJson: {
      question?: string;
      content?: string;
      pain_point_tags?: string[];
    } | null;
    status: string;
    publishedAt: string | null;
  };
  answer: { id: number; answerFirstBlock: string; answerMd: string };
  question: { id: number; normalisedQuestion: string };
}

type Tab = "overview" | "questions" | "answers" | "content" | "blog" | "runs";

const CHANNEL_LABELS: Record<string, string> = {
  newsletter: "📧 Newsletter",
  blog_post: "📝 Blog Post",
  linkedin: "💼 LinkedIn",
  email_nurture: "💌 Email Nurture",
};

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

function VariantBadge({ variant }: { variant: string }) {
  return variant === "direct_response" ? (
    <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-900/30 text-amber-300 border-amber-700/40">⚡ Direct Response</span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-900/30 text-blue-300 border-blue-700/40">📊 Standard AEO</span>
  );
}

// Group Loop 2 assets by question → channel → variant for A/B display
function groupLoop2Assets(assets: Loop2Asset[]) {
  const byQuestion: Record<number, { question: Loop2Asset["question"]; byChannel: Record<string, { standard?: Loop2Asset; direct_response?: Loop2Asset }> }> = {};
  for (const a of assets) {
    const qid = a.question.id;
    if (!byQuestion[qid]) byQuestion[qid] = { question: a.question, byChannel: {} };
    const ch = a.asset.channel;
    if (!byQuestion[qid].byChannel[ch]) byQuestion[qid].byChannel[ch] = {};
    const v = a.asset.variant as "standard" | "direct_response";
    byQuestion[qid].byChannel[ch][v] = a;
  }
  return byQuestion;
}

function ContentPane({ content, channel }: { content: string; channel: string }) {
  if (!content) return <p className="text-gray-500 text-xs italic">No content</p>;

  if (channel === "email_nurture") {
    let emails: Array<{ subject?: string; preview_text?: string; body?: string; cta_text?: string }> = [];
    try { emails = JSON.parse(content) as typeof emails; } catch { /* raw */ }
    if (emails.length > 0) {
      return (
        <div className="space-y-3">
          {emails.map((e, i) => (
            <div key={i} className="bg-black/30 rounded-lg p-3 border border-white/5">
              <p className="text-xs text-purple-400 font-semibold mb-1">Email {i + 1}</p>
              {e.subject && <p className="text-xs font-medium text-white mb-1">Subject: {e.subject}</p>}
              {e.preview_text && <p className="text-xs text-gray-500 mb-2">Preview: {e.preview_text}</p>}
              <p className="text-xs text-gray-300 whitespace-pre-wrap">{e.body}</p>
              {e.cta_text && <p className="text-xs text-teal-400 mt-2">CTA: {e.cta_text}</p>}
            </div>
          ))}
        </div>
      );
    }
  }

  return <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{content}</p>;
}

export default function AdminCorpus() {
  const [token, setToken] = useState(getToken());
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [runs, setRuns] = useState<LoopRun[]>([]);
  const [loop2Assets, setLoop2Assets] = useState<Loop2Asset[]>([]);
  const [loading, setLoading] = useState(false);

  const [loop1Status, setLoop1Status] = useState<string | null>(null);
  const [loop2Status, setLoop2Status] = useState<string | null>(null);
  const [loop3Status, setLoop3Status] = useState<string | null>(null);
  const [blogPosts, setBlogPosts] = useState<Array<{ id: number; slug: string; seoTitle: string; readTimeMinutes: number | null; publishedAt: string | null }>>([]);
  const [scraperStatus, setScraperStatus] = useState<string | null>(null);

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

  // Content tab state
  const [selectedChannel, setSelectedChannel] = useState<string>("newsletter");
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

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
    const r = await fetch(`${API_BASE}/api/admin/corpus/loop-runs`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json() as { runs: LoopRun[] }; setRuns(d.runs); }
  }, []);

  const fetchLoop2Assets = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/admin/corpus/loop2-assets?limit=100`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json() as { assets: Loop2Asset[] }; setLoop2Assets(d.assets); }
  }, []);

  const fetchBlogPosts = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/blog?limit=50`);
    if (r.ok) { const d = await r.json() as { posts: typeof blogPosts }; setBlogPosts(d.posts); }
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([fetchStats(), fetchQuestions(), fetchAnswers(), fetchRuns(), fetchLoop2Assets(), fetchBlogPosts()]).finally(() => setLoading(false));
  }, [token, fetchStats, fetchQuestions, fetchAnswers, fetchRuns, fetchLoop2Assets, fetchBlogPosts]);

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

  const triggerListingScraper = async () => {
    setScraperStatus("triggering…");
    const r = await fetch(`${API_BASE}/api/admin/loops/scrape-listings/run`, { method: "POST", headers: authHeaders() });
    if (r.ok) {
      setScraperStatus("running in background — scraping 8 subreddits with 30s between each");
      setTimeout(async () => { await fetchQuestions(); await fetchStats(); }, 60000);
    } else {
      const d = await r.json() as { error?: string };
      setScraperStatus(`Error: ${d.error ?? "unknown"}`);
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

  const triggerLoop2 = async () => {
    setLoop2Status("triggering…");
    const r = await fetch(`${API_BASE}/api/admin/loops/loop2/run`, { method: "POST", headers: authHeaders() });
    if (r.ok) {
      setLoop2Status("running in background — generating newsletter, blog, LinkedIn & email × 2 variants");
      setTimeout(async () => { await fetchRuns(); await fetchLoop2Assets(); await fetchStats(); }, 5000);
    } else {
      const d = await r.json() as { error?: string };
      setLoop2Status(`Error: ${d.error ?? "unknown"}`);
    }
  };

  const triggerLoop3 = async () => {
    setLoop3Status("triggering…");
    const r = await fetch(`${API_BASE}/api/admin/loops/loop3/run`, { method: "POST", headers: authHeaders() });
    if (r.ok) {
      setLoop3Status("running in background — generating slugs, SEO meta & FAQ JSON-LD");
      setTimeout(async () => { await fetchRuns(); await fetchBlogPosts(); }, 5000);
    } else {
      const d = await r.json() as { error?: string };
      setLoop3Status(`Error: ${d.error ?? "unknown"}`);
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

  const grouped2 = groupLoop2Assets(loop2Assets);
  const questionIds2 = Object.keys(grouped2).map(Number);
  const loop2Runs = runs.filter((r) => r.loop === "loop2");
  const loop1Runs = runs.filter((r) => r.loop === "loop1");

  const loop3Runs = runs.filter((r) => r.loop === "loop3");

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "questions", label: `Questions (${questions.length})` },
    { id: "answers", label: `Answers (${answers.length})` },
    { id: "content", label: `Content (${questionIds2.length} q)` },
    { id: "blog", label: `Blog (${blogPosts.length})` },
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

      <div className="max-w-7xl mx-auto px-5 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/8 flex-wrap">
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
                  { label: "Content Assets", value: loop2Assets.length },
                ].map((s) => (
                  <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{s.value ?? 0}</div>
                    <div className="text-xs text-gray-400 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Pipeline overview */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Daily Pipeline</p>
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="bg-orange-900/20 text-orange-300 border border-orange-700/30 px-3 py-1 rounded-full">🕑 2AM — Scraper</span>
                <span className="text-gray-600">→</span>
                <span className="bg-purple-900/20 text-purple-300 border border-purple-700/30 px-3 py-1 rounded-full">🕒 3AM — Loop 1 (AEO)</span>
                <span className="text-gray-600">→</span>
                <span className="bg-amber-900/20 text-amber-300 border border-amber-700/30 px-3 py-1 rounded-full">🕓 4AM — Loop 2 (Content × 2)</span>
                <span className="text-gray-600">→</span>
                <span className="bg-teal-900/20 text-teal-300 border border-teal-700/30 px-3 py-1 rounded-full">🕔 5AM — Loop 3 (Blog Publication)</span>
              </div>
            </div>

            {/* Reddit URL Scraper */}
            <div className="bg-white/5 border border-white/8 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Scrape Reddit Thread</h2>
              <p className="text-sm text-gray-400 mb-4">
                Paste any Reddit link to preview and import all comments as corpus questions.
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

            {/* Listing Scraper */}
            <div className="bg-white/5 border border-white/8 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Reddit Listing Scraper</h2>
              <p className="text-sm text-gray-400 mb-2">
                Scrapes top posts from all configured subreddits. Runs daily at <strong className="text-gray-200">2 AM</strong>.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {["r/jobs (year)", "r/jobs (month)", "r/careerguidance (year)", "r/careerguidance (month)",
                  "r/cscareerquestions (year)", "r/recruitinghell (year)", "r/resumes (year)", "r/jobsearchhacks (year)"].map((s) => (
                  <span key={s} className="text-xs bg-orange-900/20 text-orange-300 border border-orange-700/30 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
              <button onClick={triggerListingScraper} className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                ▶ Run Scraper Now
              </button>
              {scraperStatus && <p className="mt-3 text-sm text-orange-300">{scraperStatus}</p>}
            </div>

            {/* Loop 1 */}
            <div className="bg-white/5 border border-white/8 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Loop 1 — Pain Point Miner</h2>
              <p className="text-sm text-gray-400 mb-1">
                Normalises Reddit posts → Claude answers → quality gate → publishes AEO pages.
                Runs at <strong className="text-gray-200">3 AM</strong> daily.
              </p>
              {loop1Runs[0] && (
                <p className="text-xs text-gray-500 mb-4">
                  Last run: {new Date(loop1Runs[0].startedAt).toLocaleString()} ·{" "}
                  <StatusBadge status={loop1Runs[0].status} /> · {loop1Runs[0].itemsProcessed} processed
                </p>
              )}
              <button onClick={triggerLoop1} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                ▶ Trigger Loop 1 Now
              </button>
              {loop1Status && <p className="mt-3 text-sm text-purple-300">{loop1Status}</p>}
            </div>

            {/* Loop 2 */}
            <div className="bg-white/5 border border-amber-700/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold text-white">Loop 2 — Content Distribution Engine</h2>
                <span className="text-xs bg-amber-900/30 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded-full">NEW</span>
              </div>
              <p className="text-sm text-gray-400 mb-2">
                Takes answered questions → generates 4 channels × 2 variants (Standard AEO + Direct Response) = 8 assets per question.
                Runs at <strong className="text-gray-200">4 AM</strong> daily.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {["📧 Newsletter", "📝 Blog Post", "💼 LinkedIn", "💌 Email Nurture"].map((ch) => (
                  <span key={ch} className="text-xs bg-white/5 text-gray-300 border border-white/10 px-2 py-0.5 rounded-full">{ch}</span>
                ))}
                <span className="text-xs text-gray-500">×</span>
                <span className="text-xs bg-blue-900/20 text-blue-300 border border-blue-700/30 px-2 py-0.5 rounded-full">📊 Standard AEO</span>
                <span className="text-xs bg-amber-900/20 text-amber-300 border border-amber-700/30 px-2 py-0.5 rounded-full">⚡ Direct Response</span>
              </div>
              {loop2Runs[0] && (
                <p className="text-xs text-gray-500 mb-4">
                  Last run: {new Date(loop2Runs[0].startedAt).toLocaleString()} ·{" "}
                  <StatusBadge status={loop2Runs[0].status} /> · {loop2Runs[0].itemsProcessed} answered · {loop2Assets.length} assets total
                </p>
              )}
              <button onClick={triggerLoop2} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                ▶ Trigger Loop 2 Now
              </button>
              {loop2Status && <p className="mt-3 text-sm text-amber-300">{loop2Status}</p>}
            </div>

            {/* Loop 3 */}
            <div className="bg-white/5 border border-teal-700/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold text-white">Loop 3 — Blog Publication Engine</h2>
                <span className="text-xs bg-teal-900/30 text-teal-300 border border-teal-700/40 px-2 py-0.5 rounded-full">NEW</span>
              </div>
              <p className="text-sm text-gray-400 mb-2">
                Takes Loop 2 blog posts → generates slug, SEO title, meta description, read time & FAQ JSON-LD.
                Posts appear live at <a href="/blog" target="_blank" className="text-teal-400 hover:underline">/blog</a>.
                Runs at <strong className="text-gray-200">5 AM</strong> daily.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {["🔗 URL Slug", "🏷️ SEO Title", "📝 Meta Description", "⏱️ Read Time", "📋 FAQ JSON-LD"].map((item) => (
                  <span key={item} className="text-xs bg-white/5 text-gray-300 border border-white/10 px-2 py-0.5 rounded-full">{item}</span>
                ))}
              </div>
              {loop3Runs[0] && (
                <p className="text-xs text-gray-500 mb-4">
                  Last run: {new Date(loop3Runs[0].startedAt).toLocaleString()} ·{" "}
                  <StatusBadge status={loop3Runs[0].status} /> · {loop3Runs[0].itemsProcessed} posts · {blogPosts.length} live
                </p>
              )}
              <button onClick={triggerLoop3} className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                ▶ Trigger Loop 3 Now
              </button>
              {loop3Status && <p className="mt-3 text-sm text-teal-300">{loop3Status}</p>}
            </div>

            {/* Manual seed */}
            <div className="bg-white/5 border border-white/8 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Seed a Question Manually</h2>
              <p className="text-sm text-gray-400 mb-4">
                Paste a question or full post text. Claude will normalise it and add it to the pending queue.
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
                <button onClick={seedQuestion} className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
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
            {answers.length === 0 && <p className="text-gray-400 text-sm">No answers yet. Run Loop 1 to generate answers.</p>}
            {answers.map(({ answer, question }) => (
              <div key={answer.id} className="bg-white/5 border border-white/8 rounded-xl p-5">
                <p className="text-sm font-semibold text-white mb-2">{question.normalisedQuestion}</p>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-gray-400">Score: <strong className="text-white">{answer.qualityScore?.toFixed(1)}/10</strong></span>
                  <span className="text-xs text-gray-500">{answer.modelUsed}</span>
                  <span className="text-xs text-gray-500">{new Date(answer.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                  <p className="text-xs text-teal-400 font-medium mb-2">First block (AEO snippet)</p>
                  <p className="text-sm text-gray-200">{answer.answerFirstBlock}</p>
                </div>
                <details className="mt-3">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">Full answer (markdown)</summary>
                  <pre className="mt-2 text-xs text-gray-300 whitespace-pre-wrap bg-black/20 rounded p-3 overflow-auto max-h-60">{answer.answerMd}</pre>
                </details>
              </div>
            ))}
          </div>
        )}

        {/* CONTENT — Loop 2 A/B viewer */}
        {tab === "content" && (
          <div>
            {/* Channel picker */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {Object.entries(CHANNEL_LABELS).map(([ch, label]) => (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    selectedChannel === ch
                      ? "bg-amber-600/20 text-amber-300 border-amber-600/40"
                      : "bg-white/5 text-gray-400 border-white/10 hover:text-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {questionIds2.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <p className="text-4xl mb-4">📭</p>
                <p className="text-lg font-medium text-gray-400 mb-2">No content assets yet</p>
                <p className="text-sm mb-6">Run Loop 2 to generate newsletter, blog, LinkedIn &amp; email content in Standard and Direct Response variants.</p>
                <button
                  onClick={triggerLoop2}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  ▶ Trigger Loop 2 Now
                </button>
                {loop2Status && <p className="mt-3 text-sm text-amber-300">{loop2Status}</p>}
              </div>
            )}

            <div className="space-y-4">
              {questionIds2.map((qid) => {
                const { question, byChannel } = grouped2[qid];
                const chData = byChannel[selectedChannel];
                const isExpanded = expandedQuestion === qid;

                return (
                  <div key={qid} className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
                    {/* Question header */}
                    <button
                      onClick={() => setExpandedQuestion(isExpanded ? null : qid)}
                      className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-white/3 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{question.normalisedQuestion}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {Object.keys(byChannel).length} channels ·{" "}
                          {Object.values(byChannel).reduce((n, v) => n + Object.keys(v).length, 0)} assets
                        </p>
                      </div>
                      <span className="text-gray-500 ml-4">{isExpanded ? "▲" : "▼"}</span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-white/8 px-5 py-5">
                        {!chData || Object.keys(chData).length === 0 ? (
                          <p className="text-gray-500 text-sm">No assets for this channel yet.</p>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Standard variant */}
                            <div className="bg-black/20 rounded-xl border border-blue-900/30 p-5">
                              <div className="flex items-center gap-2 mb-4">
                                <VariantBadge variant="standard" />
                                <span className="text-xs text-gray-500">Informational / AEO</span>
                              </div>
                              {chData.standard ? (
                                <div className="max-h-[500px] overflow-y-auto">
                                  <ContentPane
                                    content={chData.standard.asset.payloadJson?.content ?? ""}
                                    channel={selectedChannel}
                                  />
                                </div>
                              ) : (
                                <p className="text-gray-600 text-sm italic">Not generated yet</p>
                              )}
                            </div>

                            {/* Direct response variant */}
                            <div className="bg-black/20 rounded-xl border border-amber-900/30 p-5">
                              <div className="flex items-center gap-2 mb-4">
                                <VariantBadge variant="direct_response" />
                                <span className="text-xs text-gray-500">Attention → Action</span>
                              </div>
                              {chData.direct_response ? (
                                <div className="max-h-[500px] overflow-y-auto">
                                  <ContentPane
                                    content={chData.direct_response.asset.payloadJson?.content ?? ""}
                                    channel={selectedChannel}
                                  />
                                </div>
                              ) : (
                                <p className="text-gray-600 text-sm italic">Not generated yet</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BLOG — Loop 3 published posts */}
        {tab === "blog" && (
          <div className="space-y-4">
            {blogPosts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-4">📝</p>
                <p className="text-gray-400 mb-6">No blog posts published yet — trigger Loop 3 to generate them.</p>
                <button onClick={triggerLoop3} className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                  ▶ Trigger Loop 3 Now
                </button>
                {loop3Status && <p className="mt-3 text-sm text-teal-300">{loop3Status}</p>}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">{blogPosts.length} post{blogPosts.length !== 1 ? "s" : ""} published</p>
                  <a href="/blog" target="_blank" className="text-xs text-teal-400 hover:underline">View public blog →</a>
                </div>
                {blogPosts.map((p) => (
                  <div key={p.id} className="bg-white/5 border border-white/8 rounded-xl p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.seoTitle}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">/blog/{p.slug}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                        {p.readTimeMinutes && <span>{p.readTimeMinutes} min read</span>}
                        {p.publishedAt && <span>{new Date(p.publishedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <a
                      href={`/blog/${p.slug}`}
                      target="_blank"
                      className="flex-shrink-0 text-xs bg-teal-900/30 text-teal-300 border border-teal-700/40 px-3 py-1 rounded-lg hover:bg-teal-900/50 transition-colors whitespace-nowrap"
                    >
                      View post →
                    </a>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* LOOP RUNS */}
        {tab === "runs" && (
          <div className="space-y-3">
            {runs.length === 0 && <p className="text-gray-400 text-sm">No loop runs yet.</p>}
            {runs.map((r) => (
              <div key={r.id} className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                        r.loop === "loop3" ? "bg-teal-900/30 text-teal-300" : r.loop === "loop2" ? "bg-amber-900/30 text-amber-300" : r.loop === "loop1" ? "bg-purple-900/30 text-purple-300" : "bg-orange-900/30 text-orange-300"
                      }`}>
                        {r.loop}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-xs text-gray-400">
                      Started: {new Date(r.startedAt).toLocaleString()}
                      {r.finishedAt && ` · Finished: ${new Date(r.finishedAt).toLocaleString()}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Items processed: <strong className="text-white">{r.itemsProcessed}</strong>
                      {r.costEstimate != null && ` · Cost: $${r.costEstimate.toFixed(4)}`}
                    </p>
                  </div>
                </div>
                {r.error && (
                  <p className="mt-2 text-xs text-red-400 bg-red-900/10 rounded p-2 border border-red-900/30">{r.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
