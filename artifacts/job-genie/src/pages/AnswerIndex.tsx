import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { SEO } from "@/components/SEO";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SITE_URL = "https://www.job-genie.ai";

interface AnswerCard {
  id: number;
  slug: string;
  title: string;
  answerFirstBlock: string;
  painPointTags: string[];
  sourceUrl: string | null;
  publishedAt: string | null;
}

const TAG_LABELS: Record<string, string> = {
  career_advice: "Career Advice",
  job_board_futility: "Job Boards",
  hidden_job_market: "Hidden Market",
  application_silence: "Application Silence",
  resume_screening: "Resume & CV",
  interview_ghosting: "Ghosting",
  recruiter_outreach: "Recruiter Outreach",
  ghost_jobs: "Ghost Jobs",
  age_discrimination: "Age & Bias",
  salary_negotiation: "Salary",
};

function TagPill({ tag, active, onClick }: { tag: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-blue-600/40 text-blue-200 border-blue-500/60"
          : "bg-blue-900/20 text-blue-400 border-blue-800/40 hover:bg-blue-900/40"
      }`}
    >
      {TAG_LABELS[tag] ?? tag.replace(/_/g, " ")}
    </button>
  );
}

function Card({ a }: { a: AnswerCard }) {
  return (
    <Link href={`/answers/${a.slug}`} className="group block bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 rounded-2xl p-5 transition-all duration-200">
      <h2 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors leading-snug mb-2">
        {a.title}
      </h2>
      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-3">{a.answerFirstBlock}</p>
      {a.painPointTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {a.painPointTags.slice(0, 3).map((t) => (
            <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-blue-900/20 text-blue-400 border border-blue-800/30">
              {TAG_LABELS[t] ?? t.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export default function AnswerIndex() {
  const [answers, setAnswers] = useState<AnswerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/answers?limit=100`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ answers: AnswerCard[] }>;
      })
      .then((d) => setAnswers(d.answers))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  // Count answers per tag — only tags that appear in the data
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of answers) {
      for (const t of a.painPointTags) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .filter(([, c]) => c >= 2);
  }, [answers]);

  const filtered = useMemo(
    () => (activeTag ? answers.filter((a) => a.painPointTags.includes(activeTag)) : answers),
    [answers, activeTag]
  );

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Job Search Q&A — Job Genie Answers",
    description: "AI-generated answers to real job-search questions from Reddit communities, optimised for AI search engines.",
    url: `${SITE_URL}/answers`,
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Job Genie",
      url: SITE_URL,
    },
    hasPart: answers.slice(0, 10).map((a) => ({
      "@type": "QAPage",
      name: a.title,
      url: `${SITE_URL}/answers/${a.slug}`,
    })),
  };

  return (
    <>
      <SEO
        title="Job Search Q&A — Expert Answers | Job Genie"
        description="Structured answers to real job-seeker questions — Application Silence, ATS myths, hidden job market strategies, recruiter shortlisting, and more."
        url={`${SITE_URL}/answers`}
        canonicalUrl={`${SITE_URL}/answers`}
        pageType="article"
        schemas={[schema]}
      />

      <div className="min-h-screen bg-[#080b14] text-white">
        <header className="border-b border-white/6">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight text-white hover:text-blue-300 transition-colors">
              Job Genie
            </Link>
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">← Back to home</Link>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-16">
          <div className="mb-8">
            <p className="text-blue-400 text-sm font-medium tracking-wide uppercase mb-3">GEO — AI Search Intelligence</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
              Job search questions,<br />answered directly
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
              Structured answers optimised for AI search engines — Perplexity, ChatGPT,
              Google AI Overviews. Every answer sourced from real job-seeker questions.
            </p>
          </div>

          {/* Topic filter */}
          {!loading && tagCounts.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              <button
                onClick={() => setActiveTag(null)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  !activeTag
                    ? "bg-white/15 text-white border-white/20"
                    : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                }`}
              >
                All ({answers.length})
              </button>
              {tagCounts.map(([tag, count]) => (
                <TagPill
                  key={tag}
                  tag={tag}
                  active={activeTag === tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                />
              ))}
            </div>
          )}

          {loading && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="bg-white/3 border border-white/8 rounded-2xl p-5 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/8 rounded w-full mb-1" />
                  <div className="h-3 bg-white/8 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-6 text-center">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">🤖</p>
              <p className="text-gray-400">No answers found{activeTag ? " for this topic" : ""}.</p>
              {activeTag && (
                <button onClick={() => setActiveTag(null)} className="mt-3 text-blue-400 text-sm hover:underline">
                  Clear filter
                </button>
              )}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <>
              <p className="text-xs text-gray-600 mb-4">
                {filtered.length} answer{filtered.length !== 1 ? "s" : ""}
                {activeTag ? ` in "${TAG_LABELS[activeTag] ?? activeTag.replace(/_/g, " ")}"` : " indexed"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((a) => <Card key={a.id} a={a} />)}
              </div>
            </>
          )}
        </main>

        <section className="border-t border-white/6 mt-16">
          <div className="max-w-5xl mx-auto px-6 py-12 text-center">
            <p className="text-gray-400 text-sm mb-4">Stop applying into the void. Get your free Application Autopsy.</p>
            <Link href="/" className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-[#080b14] font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
              Get Your Free Autopsy →
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
