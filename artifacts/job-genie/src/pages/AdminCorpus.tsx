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

type Tab = "overview" | "questions" | "answers" | "content" | "blog" | "geo" | "runs" | "voice";

interface VoiceVariantAsset {
  id: number;
  answerId: number;
  channel: string;
  variant: string;
  status: string;
  publishedAt: string | null;
  payloadJson: {
    variantId?: string;
    voiceId?: string;
    voiceLabel?: string;
    bodyText?: string;
    hookType?: string;
    predictedScore?: number | null;
    blogPostSlug?: string;
    blogPostAssetId?: number;
    approver?: string;
    approvedAt?: string;
    rejectReason?: string;
    guardrail?: { passed: boolean; failReasons: string[] };
    editedAt?: string;
    facebookPostId?: string;
    publishedAt?: string;
  } | null;
}

interface VoiceVariantRow {
  asset: VoiceVariantAsset;
  answer: { id: number; answerFirstBlock: string; answerMd: string };
  question: { id: number; normalisedQuestion: string };
}

interface BanditArm {
  voiceId: string;
  topic: string;
  persona: string;
  format: string;
  alpha: number;
  beta: number;
  mean: number;
  impressions: number;
  status: "under_test" | "active";
  lastUpdatedAt: string;
}

interface VoiceLibraryResponse {
  voiceLibrary: {
    version: string;
    updatedAt: string;
    samplingPolicy: {
      exploitWeight: number;
      exploreWeight: number;
      minImpressionsGate: number;
      compositeWeights?: Record<string, number>;
    };
    voices: Array<{
      id: string;
      label: string;
      description: string;
      active: boolean;
      samplingWeight: number;
      beta?: { alpha: number; beta: number };
    }>;
  };
  ledger: {
    _schema: string;
    lastUpdatedAt: string | null;
    samplingPolicy: { exploitWeight: number; exploreWeight: number } | null;
    arms: Record<string, BanditArm>;
  };
}

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

interface MarketingVariant {
  assetId: number;
  status: string;
  copy: string;
  hashtags: string[];
  cta: string;
  content: string;
}

interface BlogMarketing {
  blogPostId: number;
  answerId: number;
  slug: string | null;
  question: string;
  meta: MarketingVariant | null;
  instagram: MarketingVariant | null;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="text-[11px] text-gray-400 border border-white/10 px-2 py-0.5 rounded hover:bg-white/10 transition-colors whitespace-nowrap"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function BlogMarketingCard({
  post,
  marketing,
  generating,
  onGenerate,
  onSave,
  onApprove,
}: {
  post: { id: number; slug: string; seoTitle: string; readTimeMinutes: number | null; publishedAt: string | null };
  marketing: BlogMarketing | undefined;
  generating: boolean;
  onGenerate: (answerId: number, force: boolean) => void;
  onSave: (assetId: number, fields: { copy: string; hashtags: string; cta: string }) => Promise<void>;
  onApprove: (assetId: number, approved: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subTab, setSubTab] = useState<"meta" | "instagram">("meta");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ copy: "", hashtags: "", cta: "" });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const v = marketing ? (subTab === "meta" ? marketing.meta : marketing.instagram) : null;
  const hasCopy = !!(marketing && (marketing.meta || marketing.instagram));
  const anyApproved = !!(
    marketing &&
    (marketing.meta?.status === "approved" || marketing.instagram?.status === "approved")
  );
  const approved = v?.status === "approved";

  const switchTab = (t: "meta" | "instagram") => {
    setSubTab(t);
    setEditing(false);
  };
  const startEdit = () => {
    if (!v) return;
    setDraft({ copy: v.copy, hashtags: v.hashtags.join(" "), cta: v.cta });
    setEditing(true);
  };
  const save = async () => {
    if (!v) return;
    setSaving(true);
    try {
      await onSave(v.assetId, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  const toggleApproval = async () => {
    if (!v) return;
    setApproving(true);
    try {
      await onApprove(v.assetId, !approved);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{post.seoTitle}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">/blog/{post.slug}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
            {post.readTimeMinutes && <span>{post.readTimeMinutes} min read</span>}
            {post.publishedAt && <span>{new Date(post.publishedAt).toLocaleDateString()}</span>}
            {hasCopy && <span className="text-amber-400">⚡ Meta + Instagram copy</span>}
            {anyApproved && <span className="text-emerald-400">● Live on post</span>}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => setExpanded((x) => !x)}
            disabled={!marketing}
            className="text-xs bg-amber-900/30 text-amber-300 border border-amber-700/40 px-3 py-1 rounded-lg hover:bg-amber-900/50 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {expanded ? "Hide copy" : "Meta / Instagram"}
          </button>
          <a
            href={`/blog/${post.slug}`}
            target="_blank"
            className="text-xs bg-teal-900/30 text-teal-300 border border-teal-700/40 px-3 py-1 rounded-lg hover:bg-teal-900/50 transition-colors whitespace-nowrap"
          >
            View post →
          </a>
        </div>
      </div>

      {expanded && marketing && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              onClick={() => switchTab("meta")}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                subTab === "meta"
                  ? "bg-blue-900/40 text-blue-200 border-blue-600/50"
                  : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
              }`}
            >
              📘 Meta Ads
            </button>
            <button
              onClick={() => switchTab("instagram")}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                subTab === "instagram"
                  ? "bg-pink-900/40 text-pink-200 border-pink-600/50"
                  : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
              }`}
            >
              📸 Instagram
            </button>
            {v && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                  approved
                    ? "bg-emerald-900/30 text-emerald-300 border-emerald-700/40"
                    : "bg-amber-900/30 text-amber-300 border-amber-700/40"
                }`}
              >
                {approved ? "Approved" : "Draft"}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {hasCopy && (
                <button
                  onClick={() => onGenerate(marketing.answerId, true)}
                  disabled={generating}
                  className="text-xs text-gray-400 border border-white/10 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
                >
                  {generating ? "Regenerating…" : "↻ Regenerate"}
                </button>
              )}
            </div>
          </div>

          {v ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {!editing ? (
                  <>
                    <button
                      onClick={startEdit}
                      className="text-xs bg-white/5 text-gray-200 border border-white/10 px-3 py-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      ✎ Edit
                    </button>
                    <button
                      onClick={toggleApproval}
                      disabled={approving}
                      className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors disabled:opacity-40 ${
                        approved
                          ? "bg-white/5 text-amber-300 border border-amber-700/40 hover:bg-white/10"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      {approving ? "Saving…" : approved ? "Unapprove" : "✓ Approve for public"}
                    </button>
                    <CopyButton text={v.content} label="Copy all" />
                  </>
                ) : (
                  <>
                    <button
                      onClick={save}
                      disabled={saving}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg font-semibold disabled:opacity-40"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      disabled={saving}
                      className="text-xs bg-white/5 text-gray-300 border border-white/10 px-3 py-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <span className="text-[11px] text-gray-500">Saving resets this to Draft — approve again to publish.</span>
                  </>
                )}
              </div>

              {editing ? (
                <div className="space-y-3 bg-black/30 rounded-lg p-4 border border-white/5">
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wide text-gray-500">Copy</span>
                    <textarea
                      value={draft.copy}
                      onChange={(e) => setDraft((d) => ({ ...d, copy: e.target.value }))}
                      rows={8}
                      className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-gray-200 font-mono resize-y focus:outline-none focus:border-amber-600/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wide text-gray-500">Hashtags (space or comma separated)</span>
                    <input
                      value={draft.hashtags}
                      onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))}
                      className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-600/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wide text-gray-500">CTA</span>
                    <input
                      value={draft.cta}
                      onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))}
                      className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-600/50"
                    />
                  </label>
                </div>
              ) : (
                <div className="bg-black/30 rounded-lg p-4 border border-white/5 max-h-96 overflow-y-auto space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">Copy</span>
                      <CopyButton text={v.copy} />
                    </div>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{v.copy || "—"}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">Hashtags</span>
                      <CopyButton text={v.hashtags.join(" ")} />
                    </div>
                    <p className="text-xs text-sky-300 whitespace-pre-wrap leading-relaxed font-mono">
                      {v.hashtags.length ? v.hashtags.join(" ") : "—"}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">CTA</span>
                      <CopyButton text={v.cta} />
                    </div>
                    <p className="text-xs text-amber-300 whitespace-pre-wrap leading-relaxed font-mono">{v.cta || "—"}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 bg-black/20 rounded-lg border border-white/5">
              <p className="text-sm text-gray-400 mb-3">
                No {subTab === "meta" ? "Meta Ads" : "Instagram"} copy generated yet.
              </p>
              <button
                onClick={() => onGenerate(marketing.answerId, false)}
                disabled={generating}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                {generating ? "Generating…" : "⚡ Generate Meta + Instagram copy"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  const [loop4Status, setLoop4Status] = useState<string | null>(null);
  const [blogPosts, setBlogPosts] = useState<Array<{ id: number; slug: string; seoTitle: string; readTimeMinutes: number | null; publishedAt: string | null }>>([]);
  const [answerPages, setAnswerPages] = useState<Array<{ id: number; slug: string; title: string; painPointTags: string[]; publishedAt: string | null }>>([]);
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

  // Voice Variants tab state
  const [voiceVariants, setVoiceVariants] = useState<VoiceVariantRow[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceApproving, setVoiceApproving] = useState<Record<number, boolean>>({});
  const [voiceApprover, setVoiceApprover] = useState<string>("");
  const [voiceActionStatus, setVoiceActionStatus] = useState<Record<number, string>>({});
  const [voiceDryRunning, setVoiceDryRunning] = useState(false);
  const [voiceDryRunStatus, setVoiceDryRunStatus] = useState<string | null>(null);
  // Station ⑦ self-improve proposals
  interface SelfImproveProposal {
    proposalId: string;
    proposedAt: string;
    evidence: {
      underperformers: Array<{ voiceId: string; armKey: string; mean: number; impressions: number }>;
      topPerformers: Array<{ voiceId: string; armKey: string; mean: number; impressions: number }>;
    };
    proposals: Array<{ action: "retire" | "spawn" | "reweight"; voiceId: string; reason: string; newWeight?: number }>;
    status: "pending" | "applied" | "dismissed";
    appliedAt?: string;
    dismissedAt?: string;
    appliedBy?: string;
  }
  const [selfImproveProposals, setSelfImproveProposals] = useState<SelfImproveProposal[]>([]);
  const [proposalActionStatus, setProposalActionStatus] = useState<Record<string, string>>({});
  const [editingVariant, setEditingVariant] = useState<number | null>(null);
  const [editBodyText, setEditBodyText] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [selectedBlogPostId, setSelectedBlogPostId] = useState<string>("");
  const [voiceGenerating, setVoiceGenerating] = useState(false);
  const [voiceGenerateStatus, setVoiceGenerateStatus] = useState<string | null>(null);
  const [voiceForce, setVoiceForce] = useState(false);
  const [linkFbPostId, setLinkFbPostId] = useState<Record<number, string>>({});
  const [linkFbLinking, setLinkFbLinking] = useState<Record<number, boolean>>({});
  const [voiceMetricsRunning, setVoiceMetricsRunning] = useState(false);
  const [voiceMetricsStatus, setVoiceMetricsStatus] = useState<string | null>(null);
  const [voiceLibraryData, setVoiceLibraryData] = useState<VoiceLibraryResponse | null>(null);

  // Blog marketing (Meta Ads + Instagram) state
  const [blogMarketing, setBlogMarketing] = useState<Record<string, BlogMarketing>>({});
  const [generatingAnswerId, setGeneratingAnswerId] = useState<number | null>(null);
  const [marketingGenAll, setMarketingGenAll] = useState(false);
  const [marketingGenStatus, setMarketingGenStatus] = useState<string | null>(null);

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

  const fetchAnswerPages = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/answers?limit=100`);
    if (r.ok) { const d = await r.json() as { answers: typeof answerPages }; setAnswerPages(d.answers); }
  }, []);

  const fetchBlogMarketing = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/admin/corpus/blog-marketing`, { headers: authHeaders() });
    if (r.ok) {
      const d = await r.json() as { items: BlogMarketing[] };
      const map: Record<string, BlogMarketing> = {};
      for (const it of d.items) map[String(it.blogPostId)] = it;
      setBlogMarketing(map);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([fetchStats(), fetchQuestions(), fetchAnswers(), fetchRuns(), fetchLoop2Assets(), fetchBlogPosts(), fetchAnswerPages(), fetchBlogMarketing()]).finally(() => setLoading(false));
  }, [token, fetchStats, fetchQuestions, fetchAnswers, fetchRuns, fetchLoop2Assets, fetchBlogPosts, fetchAnswerPages, fetchBlogMarketing]);

  const generateMarketing = async (answerId: number, force: boolean) => {
    setGeneratingAnswerId(answerId);
    try {
      await fetch(`${API_BASE}/api/admin/corpus/blog-marketing/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ answerId, force }),
      });
      await fetchBlogMarketing();
    } finally {
      setGeneratingAnswerId(null);
    }
  };

  const saveMarketing = async (assetId: number, fields: { copy: string; hashtags: string; cta: string }) => {
    await fetch(`${API_BASE}/api/admin/corpus/blog-marketing/${assetId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(fields),
    });
    await fetchBlogMarketing();
  };

  const setMarketingApproval = async (assetId: number, approved: boolean) => {
    await fetch(`${API_BASE}/api/admin/corpus/blog-marketing/${assetId}/approval`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ approved }),
    });
    await fetchBlogMarketing();
  };

  const fetchVoiceVariants = useCallback(async () => {
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants`, { headers: authHeaders() });
      if (!r.ok) { setVoiceError("Failed to load voice variants"); return; }
      const d = await r.json() as { variants: VoiceVariantRow[] };
      setVoiceVariants(d.variants ?? []);
    } catch {
      setVoiceError("Network error loading voice variants");
    } finally {
      setVoiceLoading(false);
    }
  }, []);

  const fetchProposals = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants/self-improve`, { headers: authHeaders() });
      if (!r.ok) return;
      const d = await r.json() as { proposals: SelfImproveProposal[] };
      setSelfImproveProposals(d.proposals ?? []);
    } catch { /* non-blocking */ }
  }, []);

  const fetchVoiceLibrary = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants/voice-library`, { headers: authHeaders() });
      if (!r.ok) return;
      const d = await r.json() as VoiceLibraryResponse;
      setVoiceLibraryData(d);
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    if (tab === "voice" && token) {
      void fetchVoiceVariants();
      void fetchProposals();
      void fetchVoiceLibrary();
    }
  }, [tab, token, fetchVoiceVariants, fetchProposals, fetchVoiceLibrary]);

  const saveVariantEdit = async (assetId: number) => {
    if (!editBodyText.trim()) { alert("Body text cannot be empty"); return; }
    setEditSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants/${assetId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ bodyText: editBodyText.trim() }),
      });
      const d = await r.json() as { error?: string };
      if (!r.ok) { alert(`Error saving: ${d.error ?? "Unknown"}`); return; }
      setEditingVariant(null);
      setEditBodyText("");
      await fetchVoiceVariants();
    } catch {
      alert("Network error saving edit");
    } finally {
      setEditSaving(false);
    }
  };

  const applyProposal = async (proposalId: string) => {
    if (!voiceApprover.trim()) { alert("Enter your name in the Approver field first"); return; }
    if (!confirm("Apply this self-improve proposal? This will modify the voice library.")) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants/self-improve/${proposalId}/apply`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ appliedBy: voiceApprover.trim() }),
      });
      const d = await r.json() as { error?: string };
      setProposalActionStatus((p) => ({ ...p, [proposalId]: r.ok ? "✅ Applied" : `Error: ${d.error ?? "Unknown"}` }));
      if (r.ok) await fetchProposals();
    } catch {
      setProposalActionStatus((p) => ({ ...p, [proposalId]: "Error applying" }));
    }
  };

  const dismissProposal = async (proposalId: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants/self-improve/${proposalId}/dismiss`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await r.json() as { error?: string };
      setProposalActionStatus((p) => ({ ...p, [proposalId]: r.ok ? "🚫 Dismissed" : `Error: ${d.error ?? "Unknown"}` }));
      if (r.ok) await fetchProposals();
    } catch {
      setProposalActionStatus((p) => ({ ...p, [proposalId]: "Error dismissing" }));
    }
  };

  const approveVoiceVariant = async (assetId: number) => {
    if (!voiceApprover.trim()) { alert("Enter your name in the Approver field first"); return; }
    setVoiceApproving((p) => ({ ...p, [assetId]: true }));
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants/${assetId}/approve`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ approver: voiceApprover.trim() }),
      });
      const d = await r.json() as { error?: string };
      if (!r.ok) { setVoiceActionStatus((p) => ({ ...p, [assetId]: `Error: ${d.error ?? "Unknown"}` })); return; }
      setVoiceActionStatus((p) => ({ ...p, [assetId]: "✅ Approved" }));
      await fetchVoiceVariants();
    } finally {
      setVoiceApproving((p) => ({ ...p, [assetId]: false }));
    }
  };

  const rejectVoiceVariant = async (assetId: number, reason: string) => {
    try {
      await fetch(`${API_BASE}/api/admin/voice-variants/${assetId}/reject`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reason }),
      });
      setVoiceActionStatus((p) => ({ ...p, [assetId]: "🚫 Rejected" }));
      await fetchVoiceVariants();
    } catch {
      setVoiceActionStatus((p) => ({ ...p, [assetId]: "Error rejecting" }));
    }
  };

  const publishVoiceVariant = async (assetId: number) => {
    if (!confirm("Publish this variant to Facebook? This cannot be undone.")) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants/${assetId}/publish`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await r.json() as { error?: string; facebookPostId?: string };
      if (!r.ok) { setVoiceActionStatus((p) => ({ ...p, [assetId]: `Error: ${d.error ?? "Unknown"}` })); return; }
      setVoiceActionStatus((p) => ({ ...p, [assetId]: d.facebookPostId ? `✅ Published (FB: ${d.facebookPostId})` : "✅ Published (internal)" }));
      await fetchVoiceVariants();
    } catch {
      setVoiceActionStatus((p) => ({ ...p, [assetId]: "Error publishing" }));
    }
  };

  const triggerVoiceLoopDryRun = async () => {
    setVoiceDryRunning(true);
    setVoiceDryRunStatus("Dry-run started — exercising all 7 stations without publishing…");
    try {
      await fetch(`${API_BASE}/api/admin/loops/voice-loop/dry-run`, { method: "POST", headers: authHeaders() });
      setVoiceDryRunStatus("Dry-run running in background — check server logs for full report.");
    } catch {
      setVoiceDryRunStatus("Error triggering dry-run");
    } finally {
      setVoiceDryRunning(false);
    }
  };

  const linkFbPost = async (assetId: number) => {
    const fbId = (linkFbPostId[assetId] ?? "").trim();
    if (!fbId) { alert("Paste the Facebook post ID first"); return; }
    setLinkFbLinking((p) => ({ ...p, [assetId]: true }));
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants/${assetId}/link-fb-post`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ fbPostId: fbId }),
      });
      const d = await r.json() as { error?: string; facebookPostId?: string };
      if (!r.ok) { setVoiceActionStatus((p) => ({ ...p, [assetId]: `Error linking: ${d.error ?? "Unknown"}` })); return; }
      setVoiceActionStatus((p) => ({ ...p, [assetId]: `✅ FB post ID linked: ${d.facebookPostId}` }));
      setLinkFbPostId((p) => ({ ...p, [assetId]: "" }));
      await fetchVoiceVariants();
    } catch {
      setVoiceActionStatus((p) => ({ ...p, [assetId]: "Network error linking FB post ID" }));
    } finally {
      setLinkFbLinking((p) => ({ ...p, [assetId]: false }));
    }
  };

  const triggerVoiceMetricsPipeline = async () => {
    setVoiceMetricsRunning(true);
    setVoiceMetricsStatus("Running Stations ①②③ (FB metrics → attribution → ledger)…");
    try {
      const r = await fetch(`${API_BASE}/api/admin/loops/voice-loop/metrics/run`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await r.json() as { message?: string; error?: string };
      if (!r.ok) { setVoiceMetricsStatus(`Error: ${d.error ?? r.statusText}`); return; }
      setVoiceMetricsStatus(`✅ ${d.message ?? "Metrics pipeline started"} — refreshing ledger in 5 s…`);
      /** Pipeline runs in the background server-side; wait briefly then refresh so
       *  the Bandit Ledger panel reflects the updated arm state. */
      setTimeout(() => {
        void fetchVoiceLibrary().then(() => {
          setVoiceMetricsStatus(`✅ Metrics pipeline complete — ledger refreshed.`);
        });
      }, 5000);
    } catch {
      setVoiceMetricsStatus("Network error triggering metrics pipeline");
    } finally {
      setVoiceMetricsRunning(false);
    }
  };

  const generateVoiceVariantsForPost = async (assetId: string, force: boolean) => {
    if (!assetId) return;
    setVoiceGenerating(true);
    setVoiceGenerateStatus(force ? "Force-regenerating 5 voice variants — this takes ~30 seconds…" : "Generating 5 voice variants — this takes ~30 seconds…");
    try {
      const r = await fetch(`${API_BASE}/api/admin/voice-variants/blog-post/${assetId}/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ force }),
      });
      const data = await r.json().catch(() => ({})) as { error?: string; message?: string; generated?: number; stored?: number; autoRejected?: number };
      if (!r.ok) {
        setVoiceGenerateStatus(`Error: ${data.error ?? r.statusText}`);
      } else if (data.message && !data.generated) {
        setVoiceGenerateStatus(`ℹ️ ${data.message}`);
      } else {
        const summary = `✅ Generated ${data.generated ?? 0} variants (${data.stored ?? 0} stored, ${data.autoRejected ?? 0} auto-rejected). Refreshing list…`;
        setVoiceGenerateStatus(summary);
        await fetchVoiceVariants();
        setVoiceGenerateStatus(summary.replace("Refreshing list…", "Review and approve variants below."));
      }
    } catch (e) {
      setVoiceGenerateStatus(`Error: ${String(e)}`);
    } finally {
      setVoiceGenerating(false);
    }
  };

  const generateAllMarketing = async () => {
    setMarketingGenAll(true);
    let totalGenerated = 0;
    let totalFailed = 0;
    const maxIterations = 40;
    try {
      // Process in small server-side batches, looping until nothing is missing.
      // Keeps each request short so it can't hit proxy/browser timeouts.
      for (let i = 0; i < maxIterations; i++) {
        const r = await fetch(`${API_BASE}/api/admin/corpus/blog-marketing/generate`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ limit: 3 }),
        });
        if (!r.ok) {
          setMarketingGenStatus("Generation failed — check the admin token and try again.");
          return;
        }
        const d = await r.json() as { requested: number; generated: number; failed: number; remaining: number };
        totalGenerated += d.generated;
        totalFailed += d.failed;
        await fetchBlogMarketing();
        if (d.remaining <= 0) {
          setMarketingGenStatus(`Done — generated copy for ${totalGenerated} post${totalGenerated !== 1 ? "s" : ""}${totalFailed ? `, ${totalFailed} failed` : ""}.`);
          return;
        }
        // No-progress guard: if a batch produced nothing, the remaining posts are
        // failing repeatedly — stop rather than burning Claude calls in a loop.
        if (d.generated === 0) {
          setMarketingGenStatus(`Stopped — ${d.remaining} post${d.remaining !== 1 ? "s" : ""} could not be generated (check server logs).${totalGenerated ? ` Generated ${totalGenerated} before stopping.` : ""}`);
          return;
        }
        setMarketingGenStatus(`Generating… ${totalGenerated} done, ${d.remaining} remaining.`);
      }
      // Hit the iteration cap without finishing.
      setMarketingGenStatus(`Stopped after ${maxIterations} batches — generated ${totalGenerated}. Click "Generate for all" again to continue.`);
    } finally {
      setMarketingGenAll(false);
    }
  };

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

  const triggerLoop4 = async () => {
    setLoop4Status("triggering…");
    const r = await fetch(`${API_BASE}/api/admin/loops/loop4/run`, { method: "POST", headers: authHeaders() });
    if (r.ok) {
      setLoop4Status("running — GEO pages, Reddit, Email, LinkedIn in progress…");
      setTimeout(async () => { await fetchRuns(); await fetchAnswerPages(); }, 5000);
    } else {
      const d = await r.json() as { error?: string };
      setLoop4Status(`Error: ${d.error ?? "unknown"}`);
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
  const loop4Runs = runs.filter((r) => r.loop === "loop4");

  const pendingVoiceCount = voiceVariants.filter((v) => v.asset.status === "draft").length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "questions", label: `Questions (${questions.length})` },
    { id: "answers", label: `Answers (${answers.length})` },
    { id: "content", label: `Content (${questionIds2.length} q)` },
    { id: "blog", label: `Blog (${blogPosts.length})` },
    { id: "geo", label: `GEO Answers (${answerPages.length})` },
    { id: "runs", label: `Loop Runs (${runs.length})` },
    { id: "voice", label: `🎙️ Voice Variants${pendingVoiceCount > 0 ? ` (${pendingVoiceCount} pending)` : ""}` },
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
                <span className="text-gray-600">→</span>
                <span className="bg-blue-900/20 text-blue-300 border border-blue-700/30 px-3 py-1 rounded-full">🕕 6AM — Loop 4 (Distribution)</span>
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

            {/* Loop 4 */}
            <div className="bg-white/5 border border-blue-700/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold text-white">Loop 4 — Distribution Engine</h2>
                <span className="text-xs bg-blue-900/30 text-blue-300 border border-blue-700/40 px-2 py-0.5 rounded-full">NEW</span>
              </div>
              <p className="text-sm text-gray-400 mb-2">
                Distributes assets across 4 channels simultaneously. Runs at <strong className="text-gray-200">6 AM</strong> daily.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: "🌐 GEO Pages", desc: "web_aeo → /answers/:slug", color: "text-blue-300" },
                  { label: "🤖 Reddit", desc: "Reply to source threads", color: "text-orange-300" },
                  { label: "📧 Email", desc: "Newsletter via Resend", color: "text-green-300" },
                  { label: "💼 LinkedIn", desc: "Queue for posting", color: "text-sky-300" },
                ].map(({ label, desc, color }) => (
                  <div key={label} className="bg-white/5 rounded-lg p-2.5 border border-white/8">
                    <p className={`text-xs font-semibold ${color} mb-0.5`}>{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                ))}
              </div>
              {loop4Runs[0] && (
                <p className="text-xs text-gray-500 mb-4">
                  Last run: {new Date(loop4Runs[0].startedAt).toLocaleString()} · <StatusBadge status={loop4Runs[0].status} /> · {loop4Runs[0].itemsProcessed} items · {answerPages.length} GEO pages live
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={triggerLoop4} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                  ▶ Trigger Loop 4 Now
                </button>
                <span className="text-xs text-gray-600">Reddit/Email skip gracefully if credentials not set</span>
              </div>
              {loop4Status && <p className="mt-3 text-sm text-blue-300">{loop4Status}</p>}
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

        {/* GEO ANSWERS — Loop 4 published answer pages */}
        {tab === "geo" && (
          <div className="space-y-4">
            {answerPages.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-4">🤖</p>
                <p className="text-gray-400 mb-6">No GEO answer pages yet — trigger Loop 4 to publish them.</p>
                <button onClick={triggerLoop4} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                  ▶ Trigger Loop 4 Now
                </button>
                {loop4Status && <p className="mt-3 text-sm text-blue-300">{loop4Status}</p>}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">{answerPages.length} GEO answer page{answerPages.length !== 1 ? "s" : ""} indexed</p>
                  <a href="/answers" target="_blank" className="text-xs text-blue-400 hover:underline">View /answers index →</a>
                </div>
                {answerPages.map((a) => (
                  <div key={a.id} className="bg-white/5 border border-white/8 rounded-xl p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">/answers/{a.slug}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {(a.painPointTags ?? []).slice(0, 3).map((t: string) => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-300 border border-blue-700/30">{t.replace(/_/g, " ")}</span>
                        ))}
                      </div>
                    </div>
                    <a href={`/answers/${a.slug}`} target="_blank" className="flex-shrink-0 text-xs bg-blue-900/30 text-blue-300 border border-blue-700/40 px-3 py-1 rounded-lg hover:bg-blue-900/50 transition-colors whitespace-nowrap">
                      View →
                    </a>
                  </div>
                ))}
              </>
            )}
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
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-sm text-gray-400">{blogPosts.length} post{blogPosts.length !== 1 ? "s" : ""} published</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={generateAllMarketing}
                      disabled={marketingGenAll}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                    >
                      {marketingGenAll ? "Generating…" : "⚡ Generate Meta + Instagram for all"}
                    </button>
                    <a href="/blog" target="_blank" className="text-xs text-teal-400 hover:underline">View public blog →</a>
                  </div>
                </div>
                {marketingGenStatus && <p className="text-xs text-amber-300">{marketingGenStatus}</p>}
                {blogPosts.map((p) => (
                  <BlogMarketingCard
                    key={p.id}
                    post={p}
                    marketing={blogMarketing[String(p.id)]}
                    generating={
                      marketingGenAll ||
                      (blogMarketing[String(p.id)]?.answerId != null &&
                        generatingAnswerId === blogMarketing[String(p.id)]!.answerId)
                    }
                    onGenerate={generateMarketing}
                    onSave={saveMarketing}
                    onApprove={setMarketingApproval}
                  />
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
                        r.loop === "loop4" ? "bg-blue-900/30 text-blue-300" : r.loop === "loop3" ? "bg-teal-900/30 text-teal-300" : r.loop === "loop2" ? "bg-amber-900/30 text-amber-300" : r.loop === "loop1" ? "bg-purple-900/30 text-purple-300" : "bg-orange-900/30 text-orange-300"
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

        {/* VOICE VARIANTS — Station ⑤ */}
        {tab === "voice" && (
          <div className="space-y-6">
            {/* Header + controls */}
            <div className="bg-white/5 border border-purple-700/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h2 className="text-lg font-semibold text-white">🎙️ Voice Optimization Loop</h2>
                <span className="text-xs bg-purple-900/30 text-purple-300 border border-purple-700/40 px-2 py-0.5 rounded-full">Thompson Sampling</span>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Generates 5 voice variants per blog post (Sabri Suby, Empathetic Peer, Data Analyst, Contrarian, Story Narrative).
                Multi-armed bandit learns which voice maximizes FB engagement. Publishing requires human approval.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Total Variants", value: voiceVariants.length, color: "text-white" },
                  { label: "Pending Approval", value: voiceVariants.filter((v) => v.asset.status === "draft").length, color: "text-yellow-300" },
                  { label: "Approved", value: voiceVariants.filter((v) => v.asset.status === "approved").length, color: "text-green-300" },
                  { label: "Published", value: voiceVariants.filter((v) => v.asset.status === "published").length, color: "text-purple-300" },
                ].map((s) => (
                  <div key={s.label} className="bg-black/20 rounded-lg p-3 border border-white/8 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Generate Variants for a specific post */}
              {(() => {
                const variantCountByPostId: Record<number, number> = {};
                for (const v of voiceVariants) {
                  const pid = v.asset.payloadJson?.blogPostAssetId;
                  if (pid != null) variantCountByPostId[pid] = (variantCountByPostId[pid] ?? 0) + 1;
                }
                return (
                  <div className="flex flex-wrap gap-2 items-center mb-2">
                    <select
                      value={selectedBlogPostId}
                      onChange={(e) => setSelectedBlogPostId(e.target.value)}
                      className="flex-1 min-w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                    >
                      <option value="">— Select a blog post —</option>
                      {blogPosts.map((p) => {
                        const count = variantCountByPostId[p.id] ?? 0;
                        const label = p.seoTitle || p.slug;
                        return (
                          <option key={p.id} value={String(p.id)}>
                            {count > 0 ? `✓ ${count} variants — ${label}` : label}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      onClick={() => generateVoiceVariantsForPost(selectedBlogPostId, voiceForce)}
                      disabled={!selectedBlogPostId || voiceGenerating}
                      className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-40 whitespace-nowrap"
                    >
                      {voiceGenerating ? "Generating…" : "🎙️ Generate 5 Variants"}
                    </button>
                  </div>
                );
              })()}
              <label className="flex items-center gap-2 mb-3 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={voiceForce}
                  onChange={(e) => setVoiceForce(e.target.checked)}
                  className="w-4 h-4 accent-purple-500"
                />
                <span className="text-xs text-gray-400">Force regenerate — delete existing variants and re-run</span>
              </label>
              {voiceGenerateStatus && (
                <p className="mb-3 text-xs text-purple-300 bg-purple-900/10 rounded-lg p-2 border border-purple-700/20">{voiceGenerateStatus}</p>
              )}
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={triggerVoiceLoopDryRun}
                  disabled={voiceDryRunning}
                  className="text-sm bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {voiceDryRunning ? "Running dry-run…" : "▶ Trigger Dry-Run (no publish)"}
                </button>
                <button
                  onClick={triggerVoiceMetricsPipeline}
                  disabled={voiceMetricsRunning}
                  className="text-sm bg-teal-900/30 hover:bg-teal-900/50 text-teal-300 border border-teal-700/30 px-4 py-2 rounded-lg disabled:opacity-50"
                  title="Runs Stations ①②③: FB metrics ingest → attribution join → bandit ledger update"
                >
                  {voiceMetricsRunning ? "Running pipeline…" : "⚡ Run Metrics Pipeline (①②③)"}
                </button>
                <button
                  onClick={() => { void fetchVoiceVariants(); void fetchVoiceLibrary(); }}
                  className="text-sm bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-4 py-2 rounded-lg"
                >
                  ↺ Refresh
                </button>
              </div>
              {voiceDryRunStatus && <p className="mt-3 text-xs text-purple-300 bg-purple-900/10 rounded-lg p-2 border border-purple-700/20">{voiceDryRunStatus}</p>}
              {voiceMetricsStatus && <p className="mt-2 text-xs text-teal-300 bg-teal-900/10 rounded-lg p-2 border border-teal-700/20">{voiceMetricsStatus}</p>}
            </div>

            {/* Approver input — sticky */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-48">
                <label className="text-xs text-gray-400 block mb-1">Approver name (required to approve variants)</label>
                <input
                  value={voiceApprover}
                  onChange={(e) => setVoiceApprover(e.target.value)}
                  placeholder="Your name…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>
              <p className="text-xs text-gray-500 max-w-xs">Publishing is gated on approval — your name is recorded as the approver on every variant you approve.</p>
            </div>

            {/* Voice Performance Leaderboard */}
            {voiceLibraryData && (() => {
              const lib = voiceLibraryData.voiceLibrary;
              const ledger = voiceLibraryData.ledger;
              const policy = ledger.samplingPolicy ?? lib.samplingPolicy;
              const minImpressions = lib.samplingPolicy.minImpressionsGate;

              /* Aggregate all ledger arms by voiceId (arms are keyed as voiceId:topic:persona:format) */
              const aggregated: Record<string, { alpha: number; beta: number; impressions: number; mean: number; armCount: number }> = {};
              for (const arm of Object.values(ledger.arms)) {
                const vid = arm.voiceId;
                if (!aggregated[vid]) {
                  aggregated[vid] = { alpha: 0, beta: 0, impressions: 0, mean: 0, armCount: 0 };
                }
                aggregated[vid].alpha += arm.alpha;
                aggregated[vid].beta += arm.beta;
                aggregated[vid].impressions += arm.impressions;
                aggregated[vid].armCount++;
              }
              /* Recompute mean from aggregated alpha/beta */
              for (const agg of Object.values(aggregated)) {
                agg.mean = agg.alpha / (agg.alpha + agg.beta);
              }

              const rows = lib.voices.map((voice) => {
                const agg = aggregated[voice.id];
                const priorAlpha = voice.beta?.alpha ?? 1;
                const priorBeta = voice.beta?.beta ?? 1;
                const alpha = agg ? agg.alpha : priorAlpha;
                const beta = agg ? agg.beta : priorBeta;
                const impressions = agg ? agg.impressions : 0;
                const mean = agg ? agg.mean : (priorAlpha / (priorAlpha + priorBeta));
                return { voice, alpha, beta, impressions, mean };
              });

              const hasRealData = rows.some((r) => r.impressions > 0);
              const sorted = [...rows].sort((a, b) => b.mean - a.mean);
              const topMean = (hasRealData ? sorted.find((r) => r.impressions >= minImpressions)?.mean : undefined) ?? sorted[0]?.mean ?? 0.5;

              /* Status classification — four tiers */
              const getStatus = (r: typeof rows[0]) => {
                if (!r.voice.active) return "retired";
                if (r.impressions < minImpressions) return "under test";
                if (r.mean >= topMean * 0.9) return "top performer";
                if (r.mean < 0.45) return "below threshold";
                return "active";
              };

              const statusStyle = (status: string) => {
                if (status === "top performer")    return { dot: "bg-green-400",  badge: "text-green-300 bg-green-900/20 border-green-700/30",   row: "border-l-green-600 bg-green-900/5" };
                if (status === "under test")       return { dot: "bg-yellow-400", badge: "text-yellow-300 bg-yellow-900/20 border-yellow-700/30", row: "border-l-yellow-600 bg-yellow-900/5" };
                if (status === "below threshold")  return { dot: "bg-red-400",    badge: "text-red-300 bg-red-900/20 border-red-700/30",         row: "border-l-red-600 bg-red-900/5" };
                if (status === "retired")          return { dot: "bg-gray-500",   badge: "text-gray-400 bg-gray-800/40 border-gray-700/30",      row: "border-l-gray-700 bg-gray-900/5 opacity-60" };
                return { dot: "bg-blue-400", badge: "text-blue-300 bg-blue-900/20 border-blue-700/30", row: "border-l-blue-600 bg-white/2" };
              };

              const barColor = (status: string) => {
                if (status === "top performer")   return "bg-green-500";
                if (status === "under test")      return "bg-yellow-500";
                if (status === "below threshold") return "bg-red-500";
                if (status === "retired")         return "bg-gray-600";
                return "bg-blue-500";
              };

              return (
                <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-white">🏆 Voice Performance Leaderboard</h3>
                      {ledger.lastUpdatedAt ? (
                        <span className="text-xs text-gray-500">Updated {new Date(ledger.lastUpdatedAt).toLocaleString()}</span>
                      ) : (
                        <span className="text-xs text-gray-600 italic">No ledger data yet — run the Metrics Pipeline (①②③) to seed the bandit</span>
                      )}
                    </div>
                    {/* Sampling policy pills */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Sampling policy:</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-300 border border-purple-700/30 font-mono">
                        {Math.round((policy?.exploitWeight ?? 0.75) * 100)}% exploit
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300 border border-blue-700/30 font-mono">
                        {Math.round((policy?.exploreWeight ?? 0.25) * 100)}% explore
                      </span>
                      <span className="text-gray-600">gate: {minImpressions.toLocaleString()} impr.</span>
                    </div>
                  </div>

                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-4 px-5 py-2 text-xs text-gray-500 border-b border-white/5 bg-black/10">
                    <span>Voice</span>
                    <span className="text-right w-16">Mean score</span>
                    <span className="text-right w-10">α</span>
                    <span className="text-right w-10">β</span>
                    <span className="text-right w-20">Impressions</span>
                    <span className="text-right w-28">Status</span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-white/5">
                    {sorted.map((r, rank) => {
                      const status = getStatus(r);
                      const style = statusStyle(status);
                      const barWidth = Math.min(100, topMean > 0 ? (r.mean / topMean) * 100 : 0);
                      return (
                        <div key={r.voice.id} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-4 px-5 py-3 items-center border-l-2 ${style.row} transition-colors`}>
                          {/* Name + score bar */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-mono text-gray-600 w-4 flex-shrink-0">{rank + 1}.</span>
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                              <span className="text-sm font-medium text-white truncate">{r.voice.label}</span>
                              {rank === 0 && hasRealData && r.impressions >= minImpressions && (
                                <span className="text-xs">👑</span>
                              )}
                            </div>
                            {/* Proportional score bar */}
                            <div className="ml-6 h-1 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barColor(status)}`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>

                          {/* Mean score */}
                          <span className={`text-right w-16 text-sm font-mono font-semibold tabular-nums ${r.impressions > 0 ? "text-white" : "text-gray-600"}`}>
                            {r.mean.toFixed(3)}
                          </span>

                          {/* Alpha */}
                          <span className={`text-right w-10 text-xs font-mono tabular-nums ${r.impressions > 0 ? "text-gray-400" : "text-gray-700"}`}>
                            {r.alpha.toFixed(1)}
                          </span>

                          {/* Beta */}
                          <span className={`text-right w-10 text-xs font-mono tabular-nums ${r.impressions > 0 ? "text-gray-400" : "text-gray-700"}`}>
                            {r.beta.toFixed(1)}
                          </span>

                          {/* Impressions */}
                          <span className="text-right w-20 text-xs font-mono text-gray-400 tabular-nums">
                            {r.impressions > 0 ? r.impressions.toLocaleString() : "—"}
                            {r.impressions > 0 && r.impressions < minImpressions && (
                              <span className="text-yellow-600 ml-1" title={`${minImpressions - r.impressions} more impressions needed to exit exploration`}>
                                ↑{(minImpressions - r.impressions).toLocaleString()}
                              </span>
                            )}
                          </span>

                          {/* Status badge */}
                          <span className="text-right w-28">
                            <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${style.badge}`}>
                              {status}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="px-5 py-3 border-t border-white/5 bg-black/10 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1.5 align-middle" />Top performer — within 10% of leading mean &amp; ≥{minImpressions.toLocaleString()} impressions</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1.5 align-middle" />Under test — fewer than {minImpressions.toLocaleString()} impressions</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1.5 align-middle" />Active — graduated, not leading</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1.5 align-middle" />Below threshold — mean &lt; 0.45, losing to the bandit baseline</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1.5 align-middle" />Retired — disabled in voice library</span>
                  </div>
                </div>
              );
            })()}

            {/* Bandit Ledger — raw arm-level view */}
            {voiceLibraryData && (() => {
              const lib = voiceLibraryData.voiceLibrary;
              const ledger = voiceLibraryData.ledger;
              const armEntries = Object.entries(ledger.arms);

              if (armEntries.length === 0) return null;

              const voiceLabelMap: Record<string, string> = {};
              for (const v of lib.voices) voiceLabelMap[v.id] = v.label;

              const sorted = [...armEntries].sort(([, a], [, b]) => b.mean - a.mean);

              const getArmStatus = (arm: BanditArm) => {
                const voice = lib.voices.find((v) => v.id === arm.voiceId);
                if (voice && !voice.active) return "retired";
                if (arm.status === "under_test" || arm.impressions < lib.samplingPolicy.minImpressionsGate) return "under_test";
                return arm.status === "active" ? "active" : "under_test";
              };

              const armStatusStyle = (s: string) => {
                if (s === "active")     return { dot: "bg-blue-400",   badge: "text-blue-300 bg-blue-900/20 border-blue-700/30" };
                if (s === "retired")    return { dot: "bg-gray-500",   badge: "text-gray-400 bg-gray-800/40 border-gray-700/30" };
                return                         { dot: "bg-yellow-400", badge: "text-yellow-300 bg-yellow-900/20 border-yellow-700/30" };
              };

              const isPrior = (arm: BanditArm) => arm.impressions === 0;

              return (
                <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">📊 Bandit Ledger</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Every arm the bandit is tracking — voice × topic × persona × format. Refreshes with ⚡ Run Metrics Pipeline.</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{armEntries.length} arms</span>
                      <span>·</span>
                      <span>{armEntries.filter(([, a]) => a.impressions > 0).length} with data</span>
                      <span>·</span>
                      <span>{armEntries.filter(([, a]) => a.impressions === 0).length} at Beta(1,1) prior</span>
                    </div>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[2fr_1fr_auto_auto_auto_auto_auto] gap-x-3 px-5 py-2 text-xs text-gray-500 border-b border-white/5 bg-black/10">
                    <span>Arm key</span>
                    <span>Voice</span>
                    <span className="text-right w-16">Mean</span>
                    <span className="text-right w-10">α</span>
                    <span className="text-right w-10">β</span>
                    <span className="text-right w-20">Impressions</span>
                    <span className="text-right w-24">Status</span>
                  </div>

                  <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                    {sorted.map(([key, arm]) => {
                      const status = getArmStatus(arm);
                      const style = armStatusStyle(status);
                      const prior = isPrior(arm);
                      const parts = key.split(":");
                      const armShortKey = parts.length >= 4
                        ? `${parts[1] ?? "—"}  ·  ${parts[2] ?? "—"}  ·  ${parts[3] ?? "—"}`
                        : key;
                      return (
                        <div
                          key={key}
                          className={`grid grid-cols-[2fr_1fr_auto_auto_auto_auto_auto] gap-x-3 px-5 py-2.5 items-center ${prior ? "opacity-40" : ""} hover:bg-white/2 transition-colors`}
                          title={key}
                        >
                          {/* Arm key */}
                          <span className="text-xs font-mono text-gray-400 truncate min-w-0">{armShortKey}</span>

                          {/* Voice label */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                            <span className="text-xs text-white truncate">{voiceLabelMap[arm.voiceId] ?? arm.voiceId}</span>
                          </div>

                          {/* Mean */}
                          <span className={`text-right w-16 text-xs font-mono font-semibold tabular-nums ${prior ? "text-gray-600" : "text-white"}`}>
                            {arm.mean.toFixed(3)}
                          </span>

                          {/* Alpha */}
                          <span className={`text-right w-10 text-xs font-mono tabular-nums ${prior ? "text-gray-700" : "text-gray-400"}`}>
                            {arm.alpha.toFixed(1)}
                          </span>

                          {/* Beta */}
                          <span className={`text-right w-10 text-xs font-mono tabular-nums ${prior ? "text-gray-700" : "text-gray-400"}`}>
                            {arm.beta.toFixed(1)}
                          </span>

                          {/* Impressions */}
                          <span className="text-right w-20 text-xs font-mono text-gray-400 tabular-nums">
                            {arm.impressions > 0 ? arm.impressions.toLocaleString() : "—"}
                          </span>

                          {/* Status badge */}
                          <span className="text-right w-24">
                            {prior ? (
                              <span className="text-xs text-gray-600 italic">prior</span>
                            ) : (
                              <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${style.badge}`}>
                                {status === "under_test" ? "under test" : status}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-5 py-3 border-t border-white/5 bg-black/10 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1.5 align-middle" />Active — graduated past impressions gate</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1.5 align-middle" />Under test — below impressions gate</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1.5 align-middle" />Retired — voice disabled</span>
                    <span className="text-gray-600">Faded rows are Beta(1,1) priors — no data yet</span>
                  </div>
                </div>
              );
            })()}

            {/* Error */}
            {voiceError && <p className="text-red-400 text-sm bg-red-900/10 rounded-lg p-3 border border-red-700/20">{voiceError}</p>}
            {voiceLoading && <p className="text-gray-400 text-sm">Loading voice variants…</p>}

            {/* Empty state */}
            {!voiceLoading && voiceVariants.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-4">🎙️</p>
                <p className="text-lg font-medium text-gray-400 mb-2">No voice variants yet</p>
                <p className="text-sm text-gray-500 mb-6">Pick a blog post above and click <strong className="text-gray-300">Generate Variants</strong> to produce 5 voice-tested drafts for human review.</p>
                {blogPosts.length === 0 && (
                  <p className="text-xs text-amber-400 bg-amber-900/10 border border-amber-700/20 rounded-lg px-4 py-2 inline-block">
                    No blog posts found — trigger Loop 3 first to generate posts.
                  </p>
                )}
              </div>
            )}

            {/* Station ⑦ — Self-Improve Proposals */}
            {selfImproveProposals.filter((p) => p.status === "pending").length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                  ⚡ Weekly Self-Improve Proposals
                  <span className="text-xs font-normal text-amber-400/70 bg-amber-900/20 border border-amber-700/30 px-2 py-0.5 rounded-full">
                    {selfImproveProposals.filter((p) => p.status === "pending").length} pending
                  </span>
                </h3>
                {selfImproveProposals.filter((p) => p.status === "pending").map((proposal) => (
                  <div key={proposal.proposalId} className="bg-amber-900/10 border border-amber-700/30 rounded-xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs font-semibold text-amber-300 mb-1">Proposed {new Date(proposal.proposedAt).toLocaleString()}</p>
                        <div className="flex gap-3 text-xs text-gray-400">
                          <span>Under-performers: {proposal.evidence.underperformers.length}</span>
                          <span>Top performers: {proposal.evidence.topPerformers.length}</span>
                        </div>
                      </div>
                      {proposalActionStatus[proposal.proposalId] && (
                        <span className="text-xs text-teal-300 bg-teal-900/10 border border-teal-700/20 px-3 py-1 rounded-lg">{proposalActionStatus[proposal.proposalId]}</span>
                      )}
                    </div>
                    <ul className="space-y-1 mb-4">
                      {proposal.proposals.map((p, i) => (
                        <li key={i} className="text-xs text-gray-300 bg-black/20 rounded-lg px-3 py-2">
                          <span className={`font-semibold mr-2 ${p.action === "retire" ? "text-red-400" : p.action === "spawn" ? "text-green-400" : "text-blue-400"}`}>
                            {p.action.toUpperCase()}
                          </span>
                          <span className="text-white">{p.voiceId}</span>
                          {p.newWeight !== undefined && <span className="text-gray-400 ml-2">→ weight {p.newWeight.toFixed(2)}</span>}
                          <span className="text-gray-400 ml-2">— {p.reason}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button
                        onClick={() => applyProposal(proposal.proposalId)}
                        className="text-xs bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 rounded-lg font-semibold"
                      >
                        ✅ Apply Changes
                      </button>
                      <button
                        onClick={() => dismissProposal(proposal.proposalId)}
                        className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-3 py-1.5 rounded-lg"
                      >
                        🚫 Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Variant cards */}
            {voiceVariants.map((row) => {
              const p = row.asset.payloadJson ?? {};
              const assetId = row.asset.id;
              const statusColor = {
                draft: "border-yellow-700/40 bg-yellow-900/10",
                approved: "border-green-700/40 bg-green-900/10",
                rejected: "border-red-700/40 bg-red-900/10",
                published: "border-purple-700/40 bg-purple-900/10",
              }[row.asset.status] ?? "border-white/8 bg-white/3";

              return (
                <div key={assetId} className={`border rounded-xl overflow-hidden ${statusColor}`}>
                  {/* Card header */}
                  <div className="px-5 py-4 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-white">{p.voiceLabel ?? p.voiceId ?? "Unknown Voice"}</span>
                        <StatusBadge status={row.asset.status} />
                        {p.guardrail && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${p.guardrail.passed ? "bg-green-900/20 text-green-400 border-green-700/30" : "bg-red-900/20 text-red-400 border-red-700/30"}`}>
                            {p.guardrail.passed ? "✅ Guardrails OK" : "🚫 Guardrail Failed"}
                          </span>
                        )}
                        {p.predictedScore !== null && p.predictedScore !== undefined && (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-900/20 text-blue-300 border-blue-700/30">
                            Predicted: {p.predictedScore.toFixed(3)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Q: {row.question.normalisedQuestion.slice(0, 100)}{row.question.normalisedQuestion.length > 100 ? "…" : ""}
                        {p.hookType && ` · Hook: ${p.hookType}`}
                        {p.blogPostSlug && ` · Slug: ${p.blogPostSlug}`}
                      </p>
                      {p.approver && <p className="text-xs text-green-400 mt-0.5">Approved by {p.approver} · {p.approvedAt ? new Date(p.approvedAt).toLocaleString() : ""}</p>}
                      {p.rejectReason && <p className="text-xs text-red-400 mt-0.5">Rejected: {p.rejectReason}</p>}
                    </div>
                    {voiceActionStatus[assetId] && (
                      <span className="text-xs text-teal-300 bg-teal-900/10 border border-teal-700/20 px-3 py-1 rounded-lg">{voiceActionStatus[assetId]}</span>
                    )}
                  </div>

                  {/* Body text / inline editor */}
                  <div className="px-5 py-4">
                    {p.guardrail && !p.guardrail.passed && (
                      <div className="mb-3 p-3 bg-red-900/10 border border-red-700/20 rounded-lg">
                        <p className="text-xs font-semibold text-red-400 mb-1">Guardrail failures:</p>
                        {p.guardrail.failReasons.map((r: string, i: number) => <p key={i} className="text-xs text-red-300">• {r}</p>)}
                      </div>
                    )}
                    {editingVariant === assetId ? (
                      <div className="space-y-2">
                        <textarea
                          value={editBodyText}
                          onChange={(e) => setEditBodyText(e.target.value)}
                          rows={8}
                          className="w-full bg-white/5 border border-blue-500/40 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-400 resize-y"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveVariantEdit(assetId)}
                            disabled={editSaving}
                            className="text-xs bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                          >
                            {editSaving ? "Saving…" : "💾 Save edits"}
                          </button>
                          <button
                            onClick={() => { setEditingVariant(null); setEditBodyText(""); }}
                            className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-3 py-1.5 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto">
                        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{p.bodyText ?? "No body text"}</p>
                      </div>
                    )}
                    {p.editedAt && <p className="text-xs text-blue-400/60 mt-1">Edited {new Date(p.editedAt).toLocaleString()}</p>}
                  </div>

                  {/* Published variant — FB post ID status + linking UI */}
                  {row.asset.status === "published" && (
                    <div className="px-5 py-3 border-t border-white/8">
                      {p?.facebookPostId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-green-400">
                            ✅ FB post linked:&nbsp;
                            <a
                              href={`https://www.facebook.com/${p.facebookPostId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-green-300 font-mono"
                            >
                              {p.facebookPostId}
                            </a>
                          </span>
                          <span className="text-xs text-gray-500">— Station ① will ingest metrics on next pipeline run</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-amber-400 font-medium">
                            ⚠ No Facebook post ID linked — bandit cannot learn from this variant yet.
                          </p>
                          <p className="text-xs text-gray-500">
                            Paste the real Facebook post ID below (e.g.&nbsp;<span className="font-mono text-gray-400">123456789_987654321</span>).
                            Find it in Facebook Page Insights or from the post URL.
                          </p>
                          <div className="flex flex-wrap gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Facebook post_id (e.g. 123456789_987654321)"
                              value={linkFbPostId[assetId] ?? ""}
                              onChange={(e) => setLinkFbPostId((prev) => ({ ...prev, [assetId]: e.target.value }))}
                              className="flex-1 min-w-48 bg-white/5 border border-amber-700/40 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                            />
                            <button
                              onClick={() => void linkFbPost(assetId)}
                              disabled={linkFbLinking[assetId] || !(linkFbPostId[assetId] ?? "").trim()}
                              className="text-xs bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 whitespace-nowrap"
                            >
                              {linkFbLinking[assetId] ? "Linking…" : "🔗 Link FB Post ID"}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500">
                            After linking, click <strong className="text-teal-300">⚡ Run Metrics Pipeline (①②③)</strong> above to update the bandit ledger immediately.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {row.asset.status !== "rejected" && row.asset.status !== "published" && (
                    <div className="px-5 py-3 border-t border-white/8 flex flex-wrap gap-2">
                      {row.asset.status === "draft" && p.guardrail?.passed !== false && (
                        <button
                          onClick={() => approveVoiceVariant(assetId)}
                          disabled={voiceApproving[assetId]}
                          className="text-xs bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                        >
                          {voiceApproving[assetId] ? "Approving…" : "✅ Approve"}
                        </button>
                      )}
                      {row.asset.status === "draft" && p.guardrail?.passed === false && (
                        <button
                          onClick={() => {
                            if (!confirm(`This variant failed guardrails:\n\n${(p.guardrail?.failReasons ?? []).join("\n")}\n\nApprove and publish anyway?`)) return;
                            approveVoiceVariant(assetId);
                          }}
                          disabled={voiceApproving[assetId]}
                          className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                        >
                          {voiceApproving[assetId] ? "Approving…" : "⚠️ Override & Approve"}
                        </button>
                      )}
                      {row.asset.status === "approved" && (
                        <button
                          onClick={() => publishVoiceVariant(assetId)}
                          className="text-xs bg-purple-700 hover:bg-purple-800 text-white px-3 py-1.5 rounded-lg font-semibold"
                        >
                          🚀 Publish to Facebook
                        </button>
                      )}
                      {editingVariant !== assetId && (
                        <button
                          onClick={() => { setEditingVariant(assetId); setEditBodyText(String(p.bodyText ?? "")); }}
                          className="text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 border border-blue-700/30 px-3 py-1.5 rounded-lg"
                        >
                          ✏️ Edit
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const reason = prompt("Reject reason (optional):");
                          void rejectVoiceVariant(assetId, reason ?? "Rejected by admin");
                        }}
                        className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-700/30 px-3 py-1.5 rounded-lg"
                      >
                        🚫 Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
