import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// ── types ─────────────────────────────────────────────────────────────────────

interface LoopStatus {
  schedule: string;
  running: boolean;
  paused: boolean;
  pausedAt?: string;
}

interface SchedulerStatus {
  listingScraper: LoopStatus & { urls?: string[] };
  loop1: LoopStatus;
  loop2: LoopStatus & { channels?: string[] };
  loop3: LoopStatus;
  loop4: LoopStatus;
  reactorInviteHarvester: LoopStatus;
  voiceLoopMetrics: LoopStatus;
  voiceLoopSelfImprove: LoopStatus;
}

interface ProposalAction {
  action: "retire" | "spawn" | "reweight";
  voiceId: string;
  reason: string;
  newWeight?: number;
  newSpec?: Record<string, unknown>;
}

interface Proposal {
  proposalId: string;
  proposedAt: string;
  status: "pending" | "applied" | "dismissed";
  appliedAt?: string;
  appliedBy?: string;
  proposals: ProposalAction[];
  evidence: {
    underperformers: Array<{ voiceId: string; mean: number; impressions: number }>;
    topPerformers: Array<{ voiceId: string; mean: number; impressions: number }>;
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function adminFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("admin_token") ?? "";
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
}

const LOOP_LABELS: Record<string, { label: string; description: string; color: string }> = {
  listingScraper:        { label: "Listing Scraper",        description: "Fetches Reddit questions (2:00 AM)",              color: "bg-slate-500" },
  loop1:                 { label: "Loop 1 — Ingest & Answer", description: "Answers pending questions with Claude (3:00 AM)",  color: "bg-blue-600" },
  loop2:                 { label: "Loop 2 — Asset Generation", description: "Generates multi-channel content assets (4:00 AM)", color: "bg-violet-600" },
  loop3:                 { label: "Loop 3 — Blog Publishing",  description: "Enriches & publishes blog posts (5:00 AM)",        color: "bg-emerald-600" },
  loop4:                 { label: "Loop 4 — Distribution",     description: "Sends newsletter & LinkedIn posts (6:00 AM)",     color: "bg-orange-500" },
  reactorInviteHarvester:{ label: "Reactor Harvester",         description: "Collects Facebook reactions (every 6 h)",         color: "bg-pink-600" },
  voiceLoopMetrics:      { label: "Voice Metrics",             description: "Updates bandit ledger from FB data (8:00 AM)",    color: "bg-cyan-600" },
  voiceLoopSelfImprove:  { label: "Voice Self-Improve",        description: "Generates weekly improvement proposals (Sun 1 AM)", color: "bg-amber-600" },
};

const ACTION_ICON: Record<string, string> = {
  retire:   "🗑️",
  spawn:    "✨",
  reweight: "⚖️",
};

function cronToHuman(cron: string): string {
  const map: Record<string, string> = {
    "0 2 * * *":   "Daily 2:00 AM",
    "0 3 * * *":   "Daily 3:00 AM",
    "0 4 * * *":   "Daily 4:00 AM",
    "0 5 * * *":   "Daily 5:00 AM",
    "0 6 * * *":   "Daily 6:00 AM",
    "0 */6 * * *": "Every 6 hours",
    "0 8 * * *":   "Daily 8:00 AM",
    "0 1 * * 0":   "Sundays 1:00 AM",
  };
  return map[cron] ?? cron;
}

// ── Loop card ─────────────────────────────────────────────────────────────────

function LoopCard({ name, status }: { name: string; status: LoopStatus }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const meta = LOOP_LABELS[name] ?? { label: name, description: "", color: "bg-slate-500" };

  const toggle = useMutation({
    mutationFn: async (action: "pause" | "resume") => {
      const r = await adminFetch(`/api/admin/loop-control/${name}/${action}`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (_, action) => {
      toast({ title: `${meta.label} ${action === "pause" ? "paused" : "resumed"}` });
      qc.invalidateQueries({ queryKey: ["loop-control-status"] });
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const isPaused  = status.paused;
  const isRunning = status.running;

  return (
    <Card className={`border-l-4 ${isPaused ? "border-l-amber-400 opacity-70" : "border-l-emerald-500"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{meta.label}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{meta.description}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isRunning && (
              <Badge className="bg-blue-600 text-white text-[10px] animate-pulse">Running</Badge>
            )}
            {isPaused ? (
              <Badge className="bg-amber-500 text-white text-[10px]">Paused</Badge>
            ) : (
              <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground mb-3">
          <span className="font-medium">Schedule:</span> {cronToHuman(status.schedule)}
          {isPaused && status.pausedAt && (
            <span className="ml-2 text-amber-600">
              · Paused {new Date(status.pausedAt).toLocaleString()}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant={isPaused ? "default" : "outline"}
          className={`w-full text-xs h-7 ${isPaused ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-amber-400 text-amber-700 hover:bg-amber-50"}`}
          disabled={toggle.isPending || isRunning}
          onClick={() => toggle.mutate(isPaused ? "resume" : "pause")}
        >
          {toggle.isPending ? "…" : isPaused ? "▶ Resume" : "⏸ Pause"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Proposal card ─────────────────────────────────────────────────────────────

function ProposalCard({ proposal, onRefresh }: { proposal: Proposal; onRefresh: () => void }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(proposal.proposals.map((_, i) => i))
  );

  const toggle = (idx: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  const applySelected = useMutation({
    mutationFn: async () => {
      const r = await adminFetch(
        `/api/admin/loop-control/proposals/${proposal.proposalId}/apply-selected`,
        {
          method: "POST",
          body: JSON.stringify({ selectedIndices: [...selected], appliedBy: "admin" }),
        }
      );
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Selected tasks applied" });
      onRefresh();
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const applyAll = useMutation({
    mutationFn: async () => {
      const r = await adminFetch(
        `/api/admin/loop-control/proposals/${proposal.proposalId}/apply`,
        { method: "POST", body: JSON.stringify({ appliedBy: "admin" }) }
      );
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { toast({ title: "All tasks applied" }); onRefresh(); },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      const r = await adminFetch(
        `/api/admin/loop-control/proposals/${proposal.proposalId}/dismiss`,
        { method: "POST" }
      );
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { toast({ title: "Proposal dismissed" }); onRefresh(); },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const statusColor =
    proposal.status === "applied"   ? "border-l-emerald-500" :
    proposal.status === "dismissed" ? "border-l-slate-400 opacity-60" :
    "border-l-amber-400";

  return (
    <Card className={`border-l-4 ${statusColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">
              Proposal — {new Date(proposal.proposedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </CardTitle>
            <CardDescription className="text-xs font-mono mt-0.5">{proposal.proposalId}</CardDescription>
          </div>
          <Badge
            className={`text-[10px] shrink-0 ${
              proposal.status === "applied"   ? "bg-emerald-600 text-white" :
              proposal.status === "dismissed" ? "bg-slate-400 text-white" :
              "bg-amber-500 text-white"
            }`}
          >
            {proposal.status}
          </Badge>
        </div>

        {/* Evidence summary */}
        {(proposal.evidence.underperformers.length > 0 || proposal.evidence.topPerformers.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {proposal.evidence.underperformers.length > 0 && (
              <div className="rounded bg-red-50 border border-red-200 p-2">
                <p className="font-semibold text-red-700 mb-1">⬇ Underperformers</p>
                {proposal.evidence.underperformers.map((u) => (
                  <p key={u.voiceId} className="text-red-600 truncate">
                    {u.voiceId} — mean {u.mean.toFixed(3)} / {u.impressions.toLocaleString()} impressions
                  </p>
                ))}
              </div>
            )}
            {proposal.evidence.topPerformers.length > 0 && (
              <div className="rounded bg-emerald-50 border border-emerald-200 p-2">
                <p className="font-semibold text-emerald-700 mb-1">⬆ Top Performers</p>
                {proposal.evidence.topPerformers.map((t) => (
                  <p key={t.voiceId} className="text-emerald-700 truncate">
                    {t.voiceId} — mean {t.mean.toFixed(3)} / {t.impressions.toLocaleString()} impressions
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Checklist of tasks */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tasks — select which to complete
          </p>
          {proposal.proposals.map((action, idx) => (
            <label
              key={idx}
              className={`flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                proposal.status !== "pending"
                  ? "opacity-50 cursor-default"
                  : selected.has(idx)
                  ? "bg-blue-50 border-blue-300"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              }`}
            >
              {proposal.status === "pending" && (
                <Checkbox
                  checked={selected.has(idx)}
                  onCheckedChange={() => toggle(idx)}
                  className="mt-0.5 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span>{ACTION_ICON[action.action] ?? "•"}</span>
                  <span className="text-xs font-semibold capitalize">{action.action}</span>
                  <span className="text-xs text-muted-foreground font-mono truncate">{action.voiceId}</span>
                  {action.newWeight !== undefined && (
                    <Badge variant="outline" className="text-[10px] ml-1">
                      weight → {action.newWeight}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.reason}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Applied info */}
        {proposal.status === "applied" && proposal.appliedAt && (
          <p className="text-xs text-muted-foreground">
            Applied {new Date(proposal.appliedAt).toLocaleString()}
            {proposal.appliedBy ? ` by ${proposal.appliedBy}` : ""}
          </p>
        )}

        {/* Actions */}
        {proposal.status === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
              disabled={selected.size === 0 || applySelected.isPending || applyAll.isPending || dismiss.isPending}
              onClick={() => applySelected.mutate()}
            >
              {applySelected.isPending ? "Applying…" : `Apply ${selected.size} selected task${selected.size !== 1 ? "s" : ""}`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 border-emerald-400 text-emerald-700 hover:bg-emerald-50"
              disabled={applySelected.isPending || applyAll.isPending || dismiss.isPending}
              onClick={() => applyAll.mutate()}
            >
              {applyAll.isPending ? "…" : "Apply all"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8 text-slate-500 hover:text-red-600"
              disabled={applySelected.isPending || applyAll.isPending || dismiss.isPending}
              onClick={() => dismiss.mutate()}
            >
              {dismiss.isPending ? "…" : "Dismiss"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminLoopControl() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [token, setToken] = useState(() => localStorage.getItem("admin_token") ?? "");
  const [tokenInput, setTokenInput] = useState("");

  function saveToken(t: string) {
    const trimmed = t.trim();
    localStorage.setItem("admin_token", trimmed);
    setToken(trimmed);
    qc.invalidateQueries({ queryKey: ["loop-control-status"] });
    qc.invalidateQueries({ queryKey: ["loop-control-proposals"] });
  }

  const statusQ = useQuery<SchedulerStatus>({
    queryKey: ["loop-control-status", token],
    queryFn: async () => {
      const r = await adminFetch("/api/admin/loop-control/status");
      if (!r.ok) throw new Error("Failed to fetch scheduler status");
      return r.json();
    },
    refetchInterval: 10_000,
    enabled: !!token,
  });

  const proposalsQ = useQuery<{ proposals: Proposal[] }>({
    queryKey: ["loop-control-proposals", token],
    queryFn: async () => {
      const r = await adminFetch("/api/admin/loop-control/proposals");
      if (!r.ok) throw new Error("Failed to fetch proposals");
      return r.json();
    },
    refetchInterval: 15_000,
    enabled: !!token,
  });

  const runSelfImprove = useMutation({
    mutationFn: async () => {
      const r = await adminFetch("/api/admin/loop-control/self-improve/run", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Self-improve started", description: "Proposal will appear below when complete." });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["loop-control-proposals"] }), 5000);
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const refreshProposals = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["loop-control-proposals"] });
  }, [qc]);

  const pauseAll = useMutation({
    mutationFn: async () => {
      await Promise.all(
        Object.keys(LOOP_LABELS).map((name) =>
          adminFetch(`/api/admin/loop-control/${name}/pause`, { method: "POST" })
        )
      );
    },
    onSuccess: () => {
      toast({ title: "All loops paused" });
      qc.invalidateQueries({ queryKey: ["loop-control-status"] });
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const resumeAll = useMutation({
    mutationFn: async () => {
      await Promise.all(
        Object.keys(LOOP_LABELS).map((name) =>
          adminFetch(`/api/admin/loop-control/${name}/resume`, { method: "POST" })
        )
      );
    },
    onSuccess: () => {
      toast({ title: "All loops resumed" });
      qc.invalidateQueries({ queryKey: ["loop-control-status"] });
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const status = statusQ.data;
  const proposals = proposalsQ.data?.proposals ?? [];
  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const historyProposals = proposals.filter((p) => p.status !== "pending");

  const anyPaused = status
    ? Object.values(status).some((v) => typeof v === "object" && "paused" in v && v.paused)
    : false;
  const allPaused = status
    ? Object.values(status).every((v) => typeof v === "object" && "paused" in v && v.paused)
    : false;

  // ── Token gate ───────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
          <h1 className="text-lg font-bold text-slate-900 mb-1">Loop Control</h1>
          <p className="text-sm text-muted-foreground mb-6">Enter your admin token to continue.</p>
          <input
            type="password"
            placeholder="Admin token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveToken(tokenInput)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-slate-500"
            autoFocus
          />
          <Button className="w-full" onClick={() => saveToken(tokenInput)}>
            Access Admin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link href="/admin" className="hover:underline">Admin</Link>
              <span>›</span>
              <span>Loop Control</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Loop Control</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pause or resume any scheduled loop · Review and cherry-pick self-improvement tasks
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
              disabled={allPaused || pauseAll.isPending}
              onClick={() => pauseAll.mutate()}
            >
              {pauseAll.isPending ? "…" : "⏸ Pause all"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50"
              disabled={!anyPaused || resumeAll.isPending}
              onClick={() => resumeAll.mutate()}
            >
              {resumeAll.isPending ? "…" : "▶ Resume all"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* Loop status grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">Scheduled Loops</h2>
            {statusQ.isFetching && (
              <span className="text-xs text-muted-foreground animate-pulse">Refreshing…</span>
            )}
          </div>
          {statusQ.isError ? (
            <p className="text-sm text-red-600">Failed to load scheduler status. Check admin token.</p>
          ) : !status ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.keys(LOOP_LABELS).map((k) => (
                <Card key={k} className="animate-pulse h-32 bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(Object.entries(LOOP_LABELS) as [string, (typeof LOOP_LABELS)[string]][]).map(([key]) => {
                const loopStatus = (status as unknown as Record<string, LoopStatus>)[key];
                if (!loopStatus) return null;
                return <LoopCard key={key} name={key} status={loopStatus} />;
              })}
            </div>
          )}
        </section>

        {/* Self-improve section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Self-Improvement Proposals</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generated weekly by the Voice Loop · Select which tasks to apply after resuming
              </p>
            </div>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
              disabled={runSelfImprove.isPending}
              onClick={() => runSelfImprove.mutate()}
            >
              {runSelfImprove.isPending ? "Running…" : "▶ Run self-improve now"}
            </Button>
          </div>

          {proposalsQ.isError && (
            <p className="text-sm text-red-600">Failed to load proposals.</p>
          )}

          {/* Pending proposals */}
          {pendingProposals.length > 0 ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                {pendingProposals.length} pending — awaiting your review
              </p>
              {pendingProposals.map((p) => (
                <ProposalCard key={p.proposalId} proposal={p} onRefresh={refreshProposals} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
              <p className="text-slate-500 text-sm">No pending proposals.</p>
              <p className="text-xs text-muted-foreground mt-1">
                The Voice Self-Improve loop runs automatically every Sunday at 1 AM, or trigger it manually above.
              </p>
            </div>
          )}

          {/* History */}
          {historyProposals.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                History
              </p>
              {historyProposals.slice(0, 10).map((p) => (
                <ProposalCard key={p.proposalId} proposal={p} onRefresh={refreshProposals} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
