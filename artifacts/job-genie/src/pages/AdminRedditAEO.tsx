import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken(): string {
  return localStorage.getItem("admin_token") ?? "";
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CadenceStreak {
  handle: string;
  currentStreak: number;
  helpCount: number;
  mentionCount: number;
  ratioOk: boolean;
  lastActive: string | null;
}

interface MentionSummary {
  id: string;
  discoveredAt: string;
  threadUrl: string;
  subreddit: string;
  mentionType: string;
  severity: string;
  summary: string;
  assignedResponder: string;
  responseStatus: string;
  responseUrl: string | null;
  notes?: string;
}

interface CitationPoint {
  runId: string;
  month: number;
  runDate: string;
  citationRate: number;
  teamAuthoredCitationRate: number;
  totalPrompts: number;
  jobGenieCited: number;
}

interface Dashboard {
  cadenceStreaks: CadenceStreak[];
  mentions: { pendingCount: number; highSeverityCount: number; recentPending: MentionSummary[] };
  citationTrend: CitationPoint[];
  totalEngagementEntries: number;
  totalAccounts: number;
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

interface EngagementEntry {
  id: string;
  date: string;
  accountHandle: string;
  subreddit: string;
  threadUrl: string;
  type: string;
  category: string;
  summary: string;
  mentionedJobGenie: boolean;
  disclosureIncluded: boolean;
  engagementOutcome: string;
  notes?: string;
}

interface AuditRun {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/30 text-yellow-300 border-yellow-700/40",
  responded: "bg-teal-900/30 text-teal-300 border-teal-700/40",
  resolved: "bg-green-900/30 text-green-300 border-green-700/40",
  no_action: "bg-gray-800 text-gray-400 border-gray-700",
  monitoring: "bg-blue-900/30 text-blue-300 border-blue-700/40",
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-900/30 text-red-300 border-red-700/40",
  medium: "bg-orange-900/30 text-orange-300 border-orange-700/40",
  low: "bg-gray-800 text-gray-400 border-gray-700",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "accounts" | "engagement" | "mentions" | "audits";

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ data }: { data: Dashboard }) {
  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Accounts", value: data.totalAccounts },
          { label: "Total Engagements", value: data.totalEngagementEntries },
          { label: "Pending Mentions", value: data.mentions.pendingCount },
          { label: "High-Severity", value: data.mentions.highSeverityCount },
        ].map((c) => (
          <div key={c.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-2xl font-semibold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Cadence streaks */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-3">
          Cadence Streaks
        </h2>
        {data.cadenceStreaks.length === 0 ? (
          <p className="text-gray-500 text-sm">No accounts registered yet. Add accounts in the Accounts tab.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-white/10">
                  <th className="pb-2 pr-4">Account</th>
                  <th className="pb-2 pr-4">Streak (weeks)</th>
                  <th className="pb-2 pr-4">Help</th>
                  <th className="pb-2 pr-4">Mention</th>
                  <th className="pb-2 pr-4">80/20 Ratio</th>
                  <th className="pb-2">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.cadenceStreaks.map((s) => (
                  <tr key={s.handle}>
                    <td className="py-2 pr-4 font-mono text-teal-400">u/{s.handle}</td>
                    <td className="py-2 pr-4">
                      <span className={`font-semibold ${s.currentStreak >= 3 ? "text-green-400" : s.currentStreak >= 1 ? "text-yellow-400" : "text-red-400"}`}>
                        {s.currentStreak}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-300">{s.helpCount}</td>
                    <td className="py-2 pr-4 text-gray-300">{s.mentionCount}</td>
                    <td className="py-2 pr-4">
                      {s.ratioOk ? (
                        <span className="text-green-400 text-xs">✓ OK</span>
                      ) : (
                        <span className="text-red-400 text-xs">⚠ Too many mentions</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-400 text-xs">{fmtDate(s.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Citation lift trend */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-3">
          Citation Lift Trend
        </h2>
        {data.citationTrend.length === 0 ? (
          <p className="text-gray-500 text-sm">No citation audits recorded yet. Add baseline in the Audits tab (month 0).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-white/10">
                  <th className="pb-2 pr-4">Run</th>
                  <th className="pb-2 pr-4">Month</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Prompts</th>
                  <th className="pb-2 pr-4">Job Genie Cited</th>
                  <th className="pb-2 pr-4">Citation Rate</th>
                  <th className="pb-2">Team Thread Cited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.citationTrend.map((r) => (
                  <tr key={r.runId}>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-400">{r.runId}</td>
                    <td className="py-2 pr-4 text-gray-300">M{r.month}</td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">{fmtDate(r.runDate)}</td>
                    <td className="py-2 pr-4 text-gray-300">{r.totalPrompts}</td>
                    <td className="py-2 pr-4 text-white font-semibold">{r.jobGenieCited}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full"
                            style={{ width: `${r.citationRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-teal-400">{r.citationRate}%</span>
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs ${r.teamAuthoredCitationRate > 0 ? "text-green-400" : "text-gray-500"}`}>
                        {r.teamAuthoredCitationRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending mentions preview */}
      {data.mentions.recentPending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-3">
            Mentions Needing Response
          </h2>
          <div className="space-y-2">
            {data.mentions.recentPending.map((m) => (
              <div key={m.id} className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-start gap-3">
                <Badge label={m.severity} colorClass={SEVERITY_COLORS[m.severity] ?? SEVERITY_COLORS.low!} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{m.summary}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.subreddit} · {fmtDate(m.discoveredAt)}</p>
                </div>
                <Badge label={m.responseStatus} colorClass={STATUS_COLORS[m.responseStatus] ?? STATUS_COLORS.pending!} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Accounts Tab ─────────────────────────────────────────────────────────────

function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ handle: "", realName: "", role: "", assignedSubs: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API_BASE}/api/admin/reddit-aeo/accounts`, { headers: authHeaders() });
    const d = await r.json() as { accounts: Account[] };
    setAccounts(d.accounts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addAccount() {
    if (!form.handle || !form.realName || !form.role) { setError("Handle, real name, and role are required"); return; }
    setSaving(true); setError(null);
    const r = await fetch(`${API_BASE}/api/admin/reddit-aeo/accounts`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ ...form, assignedSubs: form.assignedSubs.split(",").map(s => s.trim()).filter(Boolean), disclosureBioStatus: false }),
    });
    if (!r.ok) { const e = await r.json() as { error: string }; setError(e.error); }
    else { setForm({ handle: "", realName: "", role: "", assignedSubs: "", notes: "" }); await load(); }
    setSaving(false);
  }

  async function toggleDisclosure(handle: string, current: boolean) {
    await fetch(`${API_BASE}/api/admin/reddit-aeo/accounts/${handle}`, {
      method: "PATCH", headers: authHeaders(),
      body: JSON.stringify({ disclosureBioStatus: !current }),
    });
    await load();
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Add account form */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Register Account</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: "handle", label: "Reddit handle (no u/)", placeholder: "alexchen" },
            { key: "realName", label: "Real name", placeholder: "Alex Chen" },
            { key: "role", label: "Role at Job Genie", placeholder: "Founder" },
            { key: "assignedSubs", label: "Assigned subreddits (comma-sep)", placeholder: "r/jobs, r/careerguidance" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 block mb-1">{label}</label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <label className="text-xs text-gray-400 block mb-1">Notes (optional)</label>
          <input
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
            placeholder="Any notes about this account"
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <button
          onClick={() => void addAccount()}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Register Account"}
        </button>
      </div>

      {/* Accounts table */}
      {accounts.length === 0 ? (
        <p className="text-gray-500 text-sm">No accounts registered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-white/10">
                <th className="pb-2 pr-4">Handle</th>
                <th className="pb-2 pr-4">Real Name</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Assigned Subs</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2">Disclosure Bio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {accounts.map((a) => (
                <tr key={a.handle}>
                  <td className="py-2 pr-4 font-mono text-teal-400">u/{a.handle}</td>
                  <td className="py-2 pr-4 text-gray-200">{a.realName}</td>
                  <td className="py-2 pr-4 text-gray-400">{a.role}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{a.assignedSubs.join(", ") || "—"}</td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">{fmtDate(a.accountCreatedAt)}</td>
                  <td className="py-2">
                    <button
                      onClick={() => void toggleDisclosure(a.handle, a.disclosureBioStatus)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        a.disclosureBioStatus
                          ? "bg-green-900/30 text-green-300 border-green-700/40 hover:bg-green-900/50"
                          : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                      }`}
                    >
                      {a.disclosureBioStatus ? "✓ Set" : "Not set"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Engagement Log Tab ───────────────────────────────────────────────────────

function EngagementTab() {
  const [entries, setEntries] = useState<EngagementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    accountHandle: "", date: new Date().toISOString().split("T")[0] ?? "", subreddit: "",
    threadUrl: "", type: "comment", category: "help", summary: "",
    mentionedJobGenie: false, disclosureIncluded: false, engagementOutcome: "unknown", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      fetch(`${API_BASE}/api/admin/reddit-aeo/engagement`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/admin/reddit-aeo/accounts`, { headers: authHeaders() }),
    ]);
    const d1 = await r1.json() as { entries: EngagementEntry[] };
    const d2 = await r2.json() as { accounts: Account[] };
    setEntries((d1.entries ?? []).slice().reverse());
    setAccounts(d2.accounts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addEntry() {
    if (!form.accountHandle || !form.subreddit || !form.summary) { setError("Handle, subreddit, and summary are required"); return; }
    setSaving(true); setError(null);
    const r = await fetch(`${API_BASE}/api/admin/reddit-aeo/engagement`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify(form),
    });
    if (!r.ok) { const e = await r.json() as { error: string }; setError(e.error); }
    else { setForm(f => ({ ...f, summary: "", threadUrl: "", notes: "" })); await load(); }
    setSaving(false);
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Log Engagement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Account</label>
            <select
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              value={form.accountHandle}
              onChange={(e) => setForm(f => ({ ...f, accountHandle: e.target.value }))}
            >
              <option value="">Select account…</option>
              {accounts.map(a => <option key={a.handle} value={a.handle}>u/{a.handle}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Date</label>
            <input type="date" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Subreddit</label>
            <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
              placeholder="r/jobs" value={form.subreddit} onChange={(e) => setForm(f => ({ ...f, subreddit: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Type</label>
            <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="comment">Comment</option>
              <option value="post">Post</option>
              <option value="reply">Reply</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Category</label>
            <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="help">Help (counts toward 80%)</option>
              <option value="mention">Mention (counts toward 20%)</option>
              <option value="defence">Defence</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Outcome</label>
            <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              value={form.engagementOutcome} onChange={(e) => setForm(f => ({ ...f, engagementOutcome: e.target.value }))}>
              <option value="unknown">Unknown</option>
              <option value="upvoted">Upvoted</option>
              <option value="neutral">Neutral</option>
              <option value="downvoted">Downvoted</option>
              <option value="removed">Removed</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs text-gray-400 block mb-1">Thread URL</label>
          <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
            placeholder="https://reddit.com/r/jobs/comments/…" value={form.threadUrl}
            onChange={(e) => setForm(f => ({ ...f, threadUrl: e.target.value }))} />
        </div>
        <div className="mt-3">
          <label className="text-xs text-gray-400 block mb-1">Summary (one sentence — no verbatim content)</label>
          <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
            placeholder="Answered question about ATS ranking vs. rejection" value={form.summary}
            onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))} />
        </div>
        <div className="mt-3 flex gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.mentionedJobGenie}
              onChange={(e) => setForm(f => ({ ...f, mentionedJobGenie: e.target.checked }))}
              className="accent-teal-500" />
            Mentioned Job Genie
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.disclosureIncluded} disabled={!form.mentionedJobGenie}
              onChange={(e) => setForm(f => ({ ...f, disclosureIncluded: e.target.checked }))}
              className="accent-teal-500" />
            Disclosure included
          </label>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <button onClick={() => void addEntry()} disabled={saving}
          className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
          {saving ? "Saving…" : "Log Entry"}
        </button>
      </div>

      {/* Entries list */}
      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No entries logged yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, 50).map((e) => (
            <div key={e.id} className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-start gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                e.category === "help" ? "bg-teal-900/30 text-teal-300 border-teal-700/40"
                : e.category === "mention" ? "bg-orange-900/30 text-orange-300 border-orange-700/40"
                : "bg-blue-900/30 text-blue-300 border-blue-700/40"
              }`}>{e.category}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">{e.summary}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  u/{e.accountHandle} · {e.subreddit} · {fmtDate(e.date)}
                  {e.threadUrl && <> · <a href={e.threadUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">thread</a></>}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {e.mentionedJobGenie && (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-900/30 text-purple-300 border-purple-700/40">
                    {e.disclosureIncluded ? "✓ disclosed" : "⚠ no disclosure"}
                  </span>
                )}
                <span className="text-xs text-gray-500">{e.engagementOutcome}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mentions Tab ─────────────────────────────────────────────────────────────

function MentionsTab() {
  const [entries, setEntries] = useState<MentionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    threadUrl: "", subreddit: "", mentionType: "criticism", severity: "medium",
    summary: "", assignedResponder: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API_BASE}/api/admin/reddit-aeo/mentions`, { headers: authHeaders() });
    const d = await r.json() as { entries: MentionSummary[] };
    setEntries((d.entries ?? []).slice().reverse());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addMention() {
    if (!form.threadUrl || !form.summary) { setError("Thread URL and summary are required"); return; }
    setSaving(true); setError(null);
    const r = await fetch(`${API_BASE}/api/admin/reddit-aeo/mentions`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ ...form, subreddit: form.subreddit || "unknown" }),
    });
    if (!r.ok) { const e = await r.json() as { error: string }; setError(e.error); }
    else { setForm(f => ({ ...f, threadUrl: "", summary: "", notes: "" })); await load(); }
    setSaving(false);
  }

  async function updateStatus(id: string, responseStatus: string) {
    await fetch(`${API_BASE}/api/admin/reddit-aeo/mentions/${id}`, {
      method: "PATCH", headers: authHeaders(), body: JSON.stringify({ responseStatus }),
    });
    await load();
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Log Mention / Criticism</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Thread URL</label>
            <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
              placeholder="https://reddit.com/r/jobs/comments/…" value={form.threadUrl}
              onChange={(e) => setForm(f => ({ ...f, threadUrl: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Subreddit</label>
            <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
              placeholder="r/jobs" value={form.subreddit} onChange={(e) => setForm(f => ({ ...f, subreddit: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Type</label>
            <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              value={form.mentionType} onChange={(e) => setForm(f => ({ ...f, mentionType: e.target.value }))}>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="criticism">Criticism</option>
              <option value="question">Question</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Severity</label>
            <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              value={form.severity} onChange={(e) => setForm(f => ({ ...f, severity: e.target.value }))}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High — respond same day</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Assigned responder (handle)</label>
            <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
              placeholder="alexchen" value={form.assignedResponder} onChange={(e) => setForm(f => ({ ...f, assignedResponder: e.target.value }))} />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs text-gray-400 block mb-1">Summary</label>
          <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
            placeholder="User claims product gave wrong advice about salary negotiation" value={form.summary}
            onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))} />
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <button onClick={() => void addMention()} disabled={saving}
          className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
          {saving ? "Saving…" : "Log Mention"}
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No mentions logged yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((m) => (
            <div key={m.id} className={`rounded-lg p-4 border ${m.severity === "high" ? "border-red-700/40 bg-red-900/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-start gap-3">
                <Badge label={m.severity} colorClass={SEVERITY_COLORS[m.severity] ?? SEVERITY_COLORS.low!} />
                <Badge label={m.mentionType} colorClass="bg-gray-800 text-gray-300 border-gray-700" />
                <div className="flex-1">
                  <p className="text-sm text-gray-200">{m.summary}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {m.subreddit} · {fmtDate(m.discoveredAt)}
                    {m.assignedResponder && <> · assigned: u/{m.assignedResponder}</>}
                    {" · "}<a href={m.threadUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">thread ↗</a>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Badge label={m.responseStatus} colorClass={STATUS_COLORS[m.responseStatus] ?? STATUS_COLORS.pending!} />
                  {m.responseStatus === "pending" && (
                    <button onClick={() => void updateStatus(m.id, "responded")}
                      className="text-xs px-2 py-0.5 bg-teal-600 hover:bg-teal-500 text-white rounded-full transition-colors">
                      Mark responded
                    </button>
                  )}
                  {m.responseStatus === "responded" && (
                    <button onClick={() => void updateStatus(m.id, "resolved")}
                      className="text-xs px-2 py-0.5 bg-green-700 hover:bg-green-600 text-white rounded-full transition-colors">
                      Mark resolved
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Audits Tab ───────────────────────────────────────────────────────────────

function AuditsTab() {
  const [data, setData] = useState<{ baseline: AuditRun | null; runs: AuditRun[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ month: "0", runDate: new Date().toISOString().split("T")[0] ?? "", conductedBy: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API_BASE}/api/admin/reddit-aeo/audits`, { headers: authHeaders() });
    setData(await r.json() as { baseline: AuditRun | null; runs: AuditRun[] });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addRun() {
    if (!form.runDate || !form.conductedBy) { setError("Date and conducted-by are required"); return; }
    setSaving(true); setError(null);
    const r = await fetch(`${API_BASE}/api/admin/reddit-aeo/audits`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ month: parseInt(form.month, 10), runDate: form.runDate, conductedBy: form.conductedBy, results: [] }),
    });
    if (!r.ok) { const e = await r.json() as { error: string }; setError(e.error); }
    else { await load(); }
    setSaving(false);
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

  const allRuns = [data?.baseline, ...(data?.runs ?? [])].filter(Boolean) as AuditRun[];

  return (
    <div className="space-y-6">
      <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 text-sm text-amber-300">
        <strong>Guardrail:</strong> Run the prompt set manually in ChatGPT, Perplexity, and Gemini. Record what you observe. Never fabricate results.
        Add results via the JSON file (<code className="text-xs bg-black/30 px-1 rounded">content/reddit-citation-audits.json</code>) for full detail; use this form to register a run.
      </div>

      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Register Audit Run</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Month checkpoint</label>
            <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              value={form.month} onChange={(e) => setForm(f => ({ ...f, month: e.target.value }))}>
              <option value="0">Month 0 — Baseline</option>
              <option value="3">Month 3</option>
              <option value="6">Month 6</option>
              <option value="9">Month 9</option>
              <option value="12">Month 12</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Date conducted</label>
            <input type="date" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              value={form.runDate} onChange={(e) => setForm(f => ({ ...f, runDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Conducted by</label>
            <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500"
              placeholder="Your name" value={form.conductedBy} onChange={(e) => setForm(f => ({ ...f, conductedBy: e.target.value }))} />
          </div>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <button onClick={() => void addRun()} disabled={saving}
          className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
          {saving ? "Saving…" : "Register Run"}
        </button>
      </div>

      {allRuns.length === 0 ? (
        <p className="text-gray-500 text-sm">No audit runs yet. Register the month-0 baseline to start tracking.</p>
      ) : (
        <div className="space-y-3">
          {allRuns.map((run) => (
            <div key={run.runId} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${run.month === 0 ? "bg-teal-900/30 text-teal-300 border-teal-700/40" : "bg-gray-800 text-gray-300 border-gray-700"}`}>
                  {run.month === 0 ? "Baseline (M0)" : `M${run.month}`}
                </span>
                <span className="text-sm text-gray-200 font-mono">{run.runId}</span>
                <span className="text-xs text-gray-500">{fmtDate(run.runDate)} · by {run.conductedBy}</span>
              </div>
              {run.results.length === 0 ? (
                <p className="text-xs text-gray-500">No prompt results recorded. Edit <code className="bg-black/30 px-1 rounded">content/reddit-citation-audits.json</code> to add per-prompt results.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-black/20 rounded p-2">
                    <p className="text-gray-500">Prompts</p>
                    <p className="text-white font-semibold text-lg">{run.results.length}</p>
                  </div>
                  <div className="bg-black/20 rounded p-2">
                    <p className="text-gray-500">Job Genie cited</p>
                    <p className="text-teal-400 font-semibold text-lg">{run.results.filter(r => r.jobGenieCited).length}</p>
                  </div>
                  <div className="bg-black/20 rounded p-2">
                    <p className="text-gray-500">Citation rate</p>
                    <p className="text-white font-semibold text-lg">
                      {run.results.length > 0 ? Math.round(run.results.filter(r => r.jobGenieCited).length / run.results.length * 100) : 0}%
                    </p>
                  </div>
                  <div className="bg-black/20 rounded p-2">
                    <p className="text-gray-500">Team thread cited</p>
                    <p className="text-green-400 font-semibold text-lg">{run.results.filter(r => r.teamAuthoredThreadCited).length}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminRedditAEO() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    const r = await fetch(`${API_BASE}/api/admin/reddit-aeo/dashboard`, { headers: authHeaders() });
    if (r.ok) setDashboard(await r.json() as Dashboard);
    setDashLoading(false);
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "accounts", label: "👤 Accounts" },
    { id: "engagement", label: "✍️ Engagement Log" },
    { id: "mentions", label: "📣 Mentions Queue" },
    { id: "audits", label: "🔍 Citation Audits" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f0e] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🟠</span>
            <h1 className="text-2xl font-bold text-white">Reddit AEO Loop</h1>
          </div>
          <p className="text-sm text-gray-400">
            Supporting system for the SolCrys Reddit AEO Playbook. Humans run the loop; this dashboard tracks cadence, mentions, and citation lift.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2 w-fit">
            <span>⚠️</span>
            <span className="text-amber-300">This system never posts to Reddit. All participation is done by named humans, manually.</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id === "dashboard") void loadDashboard(); }}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.id ? "border-teal-500 text-teal-400" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "dashboard" && (
          dashLoading ? <p className="text-gray-500 text-sm">Loading…</p> :
          dashboard ? <DashboardTab data={dashboard} /> :
          <p className="text-red-400 text-sm">Failed to load dashboard. Check ADMIN_TOKEN.</p>
        )}
        {tab === "accounts" && <AccountsTab />}
        {tab === "engagement" && <EngagementTab />}
        {tab === "mentions" && <MentionsTab />}
        {tab === "audits" && <AuditsTab />}
      </div>
    </div>
  );
}
