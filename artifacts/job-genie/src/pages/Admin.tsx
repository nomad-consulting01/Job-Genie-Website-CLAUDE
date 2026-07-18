import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trackEvent } from "../lib/analytics";
import experimentsData from "../data/experiments.json";
import geoScoresData from "../data/geo-scores.json";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ReactorPost {
  post_id: string;
  post_snippet: string | null;
  permalink: string | null;
  published_at: string | null;
  last_harvested_at: string | null;
  total_reactions: number;
  reaction_delta: number;
  reaction_breakdown: Record<string, number> | null;
  invite_status: string;
  invites_sent_count: number;
  last_invited_at: string | null;
}

interface DailyCap {
  today_invites_sent: number;
  daily_cap: number;
  warning_threshold: number;
  remaining: number;
  is_warning: boolean;
}

interface WeeklyReport {
  total_invites_sent: number;
  posts_actioned: number;
  followers_count: number | null;
  period_days: number;
}

export default function Admin() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("ADMIN_TOKEN"));
  const [metrics, setMetrics] = useState<any>(null);
  const [, setLocation] = useLocation();

  const [reactorQueue, setReactorQueue] = useState<ReactorPost[]>([]);
  const [reactorAllPosts, setReactorAllPosts] = useState<ReactorPost[]>([]);
  const [reactorDailyCap, setReactorDailyCap] = useState<DailyCap | null>(null);
  const [reactorWeekly, setReactorWeekly] = useState<WeeklyReport | null>(null);
  const [reactorLoading, setReactorLoading] = useState(false);
  const [reactorRefreshKey, setReactorRefreshKey] = useState(0);
  const [showAllPosts, setShowAllPosts] = useState(false);

  useEffect(() => {
    if (!token) {
      const input = window.prompt("Enter Admin Token:");
      if (input) {
        localStorage.setItem("ADMIN_TOKEN", input);
        setToken(input);
      } else {
        setLocation("/");
      }
    }
  }, [token, setLocation]);

  useEffect(() => {
    if (token) {
      fetch("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (r.status === 401) {
            localStorage.removeItem("ADMIN_TOKEN");
            setToken(null);
            return null;
          }
          return r.json();
        })
        .then((data) => { if (data) setMetrics(data); })
        .catch((e) => console.error("Failed to fetch metrics", e));
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setReactorLoading(true);
      try {
        const [qRes, capRes, weeklyRes, allRes] = await Promise.all([
          fetch("/api/admin/reactor-invites/queue", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/admin/reactor-invites/daily-cap", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/admin/reactor-invites/weekly-report", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/admin/reactor-invites/all", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (qRes.status === 401 || capRes.status === 401) {
          localStorage.removeItem("ADMIN_TOKEN");
          setToken(null);
          return;
        }
        const [q, cap, weekly, all] = await Promise.all([
          qRes.ok ? qRes.json() : null,
          capRes.ok ? capRes.json() : null,
          weeklyRes.ok ? weeklyRes.json() : null,
          allRes.ok ? allRes.json() : null,
        ]);
        setReactorQueue(q?.items ?? []);
        setReactorDailyCap(cap ?? null);
        setReactorWeekly(weekly ?? null);
        setReactorAllPosts(all?.items ?? []);
      } catch (e) {
        console.error("Failed to fetch reactor data", e);
      } finally {
        setReactorLoading(false);
      }
    };
    load();
  }, [token, reactorRefreshKey]);

  const refreshReactor = useCallback(() => setReactorRefreshKey((k) => k + 1), []);

  const markInvited = useCallback(
    async (postId: string) => {
      const countStr = window.prompt("How many invites did you send? (enter a number)");
      if (!countStr) return;
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count < 1) {
        window.alert("Please enter a valid positive number.");
        return;
      }
      await fetch(`/api/admin/reactor-invites/${encodeURIComponent(postId)}/mark-invited`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      refreshReactor();
    },
    [token, refreshReactor]
  );

  const skipPost = useCallback(
    async (postId: string) => {
      await fetch(`/api/admin/reactor-invites/${encodeURIComponent(postId)}/skip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      refreshReactor();
    },
    [token, refreshReactor]
  );

  const runHarvest = useCallback(async () => {
    setReactorLoading(true);
    await fetch("/api/admin/reactor-invites/harvest", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await new Promise((r) => setTimeout(r, 4000));
    refreshReactor();
  }, [token, refreshReactor]);

  if (!token) return null;

  const capPct = reactorDailyCap
    ? Math.min(100, (reactorDailyCap.today_invites_sent / reactorDailyCap.daily_cap) * 100)
    : 0;

  const displayPosts = showAllPosts ? reactorAllPosts : reactorQueue;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Job Genie Admin</h1>
          <p className="text-zinc-400">Marketing & A/B Test Operations</p>
        </div>

        {/* Site Metrics */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white border-b border-zinc-800 pb-2">Site Metrics</h2>
          {metrics ? (
            <div className="overflow-x-auto bg-zinc-900 border border-zinc-800 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">Slug</th>
                    <th className="px-6 py-4 font-medium">Page Views</th>
                    <th className="px-6 py-4 font-medium">Unique Visitors</th>
                    <th className="px-6 py-4 font-medium">Free Autopsy Clicks</th>
                    <th className="px-6 py-4 font-medium">Newsletter Signups</th>
                    <th className="px-6 py-4 font-medium">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {metrics.by_slug?.map((row: any) => (
                    <tr key={row.slug} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{row.slug}</td>
                      <td className="px-6 py-4">{row.page_views}</td>
                      <td className="px-6 py-4">{row.unique_visitors}</td>
                      <td className="px-6 py-4">{row.free_autopsy_clicks}</td>
                      <td className="px-6 py-4">{row.newsletter_signups}</td>
                      <td className="px-6 py-4 text-emerald-400">{(row.conversion_rate || 0).toFixed(2)}%</td>
                    </tr>
                  ))}
                  {!metrics.by_slug?.length && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                        No metrics data available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-zinc-800 rounded"></div>
                  <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* GEO Score Trend */}
        <section className="space-y-4">
          <div className="border-b border-zinc-800 pb-2">
            <h2 className="text-xl font-semibold text-white">GEO Score Trend</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Monthly AI citation score (0–5). Target: 5/5 by month 6 (Nov 2026).
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={geoScoresData.months.map((m) => ({
                  label: m.label,
                  score: m.score,
                  target: Math.round(((m.month - 1) / (geoScoresData.targetMonth - 1)) * geoScoresData.target * 10) / 10,
                }))}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 12 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tick={{ fill: "#71717a", fontSize: 12 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}/5`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px", color: "#f4f4f5" }}
                  labelStyle={{ color: "#a1a1aa", marginBottom: "4px", fontWeight: 600 }}
                  formatter={(value: any, name: string) => {
                    if (name === "Actual Score") return value !== null ? [`${value}/5`, name] : ["Scheduled", name];
                    return [`${value}/5`, name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "13px", paddingTop: "16px" }}
                  formatter={(value) => <span style={{ color: "#a1a1aa" }}>{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Target (5/5 by M6)"
                  stroke="#3f3f46"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Actual Score"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#10b981", strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: "#34d399", strokeWidth: 0 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-zinc-800 pt-4">
              {geoScoresData.months.filter((m) => m.score !== null).map((m) => (
                <div key={m.month} className="space-y-0.5">
                  <p className="text-xs text-zinc-500">{m.label}</p>
                  <p className="text-lg font-bold text-emerald-400">{m.score}/5</p>
                </div>
              ))}
              {geoScoresData.months.filter((m) => m.score !== null).length === 0 && (
                <p className="text-xs text-zinc-500 col-span-3">No completed probes yet.</p>
              )}
            </div>
            <p className="text-xs text-zinc-600 mt-3">
              Source: <code className="text-zinc-500">docs/geo-probe-log.md</code> — update <code className="text-zinc-500">src/data/geo-scores.json</code> after each monthly probe.
            </p>
          </div>
        </section>

        {/* Experiments */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white border-b border-zinc-800 pb-2">Experiments</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {experimentsData.experiments.map((exp) => (
              <div key={exp.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">{exp.name}</h3>
                    <p className="text-sm text-zinc-500 font-mono mt-1">{exp.id}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${exp.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                    {exp.status.toUpperCase()}
                  </span>
                </div>
                <div className="pt-4 space-y-3">
                  <p className="text-sm text-zinc-400 font-medium">Variants</p>
                  <ul className="space-y-2">
                    {exp.variants.map(v => (
                      <li key={v.id} className="flex justify-between items-center text-sm p-3 bg-zinc-950/50 rounded-md border border-zinc-800">
                        <span className="text-zinc-300">{v.name}</span>
                        <span className="text-zinc-500 font-mono">{(v.weight * 100).toFixed(0)}% traffic</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Reactor Invites */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div>
              <h2 className="text-xl font-semibold text-white">Reactor Invites</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                Human-actioned queue — invite Facebook post reactors to follow the Page via Meta Business Suite.
              </p>
            </div>
            <button
              onClick={runHarvest}
              disabled={reactorLoading}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {reactorLoading ? "Harvesting…" : "Run Harvest Now"}
            </button>
          </div>

          {/* Daily Cap Tracker */}
          {reactorDailyCap && (
            <div className={`rounded-lg border p-4 space-y-2 ${reactorDailyCap.is_warning ? "bg-amber-500/5 border-amber-500/30" : "bg-zinc-900 border-zinc-800"}`}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-white">Daily Invite Cap</span>
                <span className={reactorDailyCap.is_warning ? "text-amber-400 font-semibold" : "text-zinc-400"}>
                  {reactorDailyCap.today_invites_sent.toLocaleString()} / {reactorDailyCap.daily_cap.toLocaleString()} sent today
                  {reactorDailyCap.is_warning && " ⚠️"}
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${reactorDailyCap.is_warning ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${capPct}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400">
                {reactorDailyCap.remaining.toLocaleString()} invites remaining — resets midnight ET
                {reactorDailyCap.is_warning && `. Warning threshold (${reactorDailyCap.warning_threshold.toLocaleString()}) reached.`}
              </p>
            </div>
          )}

          {/* View toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowAllPosts(false)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${!showAllPosts ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"}`}
            >
              Invite-Ready ({reactorQueue.length})
            </button>
            <button
              onClick={() => setShowAllPosts(true)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showAllPosts ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"}`}
            >
              All Harvested ({reactorAllPosts.length})
            </button>
          </div>

          {/* Queue */}
          {reactorLoading && displayPosts.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : displayPosts.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-6 py-10 text-center">
              <p className="text-zinc-400 text-sm">
                {showAllPosts
                  ? "No posts harvested yet. Click \"Run Harvest Now\" to pull reaction data from recent Facebook posts."
                  : "No invite-ready posts right now. Posts become eligible when reaction_delta ≥ 10 or total reactions ≥ 25."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayPosts.map((item) => (
                <div
                  key={item.post_id}
                  className={`bg-zinc-900 border rounded-lg p-4 ${item.invite_status === "invited" ? "border-emerald-800/50" : item.invite_status === "skipped" ? "border-zinc-700 opacity-60" : "border-zinc-800"}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 line-clamp-2">
                        {item.post_snippet || <span className="italic text-zinc-500">(no preview — run harvest to populate)</span>}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                        <span>
                          👍 <strong className="text-zinc-200">{item.total_reactions}</strong> reactions
                          {item.reaction_delta > 0 && (
                            <span className="text-emerald-400 ml-1">(+{item.reaction_delta} new)</span>
                          )}
                        </span>
                        {item.published_at && (
                          <span>Published {new Date(item.published_at).toLocaleDateString()}</span>
                        )}
                        {item.last_harvested_at && (
                          <span>Harvested {new Date(item.last_harvested_at).toLocaleDateString()}</span>
                        )}
                        <span
                          className={
                            item.invite_status === "invited"
                              ? "text-emerald-400 font-medium"
                              : item.invite_status === "skipped"
                              ? "text-zinc-500"
                              : "text-zinc-400"
                          }
                        >
                          {item.invite_status === "never_invited"
                            ? "Not yet invited"
                            : item.invite_status === "invited"
                            ? `Invited (${item.invites_sent_count} total sent)`
                            : "Skipped"}
                        </span>
                      </div>

                      {item.reaction_breakdown && Object.keys(item.reaction_breakdown).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(item.reaction_breakdown).map(([type, count]) => (
                            <span key={type} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
                              {type} {count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <a
                        href="https://business.facebook.com/latest/content_calendar"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors text-center"
                      >
                        Open Planner ↗
                      </a>
                      <button
                        onClick={() => markInvited(item.post_id)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors"
                      >
                        Mark Invited
                      </button>
                      {item.invite_status !== "skipped" && (
                        <button
                          onClick={() => skipPost(item.post_id)}
                          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded-lg transition-colors"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weekly Report */}
          {reactorWeekly && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Weekly Rollup (last 7 days)</h3>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Invites Logged</p>
                  <p className="text-2xl font-bold text-white">{reactorWeekly.total_invites_sent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Posts Actioned</p>
                  <p className="text-2xl font-bold text-white">{reactorWeekly.posts_actioned}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Page Followers</p>
                  <p className="text-2xl font-bold text-white">
                    {reactorWeekly.followers_count != null
                      ? reactorWeekly.followers_count.toLocaleString()
                      : <span className="text-zinc-500 text-base font-normal">—</span>}
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Follower count is a live snapshot. Correlate invite sessions with follower growth week-over-week.
              </p>
            </div>
          )}

          {/* Compliance note */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-zinc-500 space-y-1">
            <p className="font-semibold text-zinc-400">How to send invites (human action required)</p>
            <p>
              Meta provides no Graph API endpoint for sending Page-follow invites. After clicking{" "}
              <strong>Open Planner ↗</strong>, locate the post in Meta Business Suite's Content Calendar, click
              the reaction count, then use "Send Invites" from the UI. Return here and click{" "}
              <strong>Mark Invited</strong> to log the count and track your daily headroom.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
