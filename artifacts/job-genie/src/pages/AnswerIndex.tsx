import { useEffect, useState } from "react";
import { Link } from "wouter";
import { SEO } from "@/components/SEO";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SITE_URL = "https://job-genie.ai";

interface AnswerCard {
  id: number;
  slug: string;
  title: string;
  answerFirstBlock: string;
  painPointTags: string[];
  sourceUrl: string | null;
  publishedAt: string | null;
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300 border border-blue-700/30">
      {tag.replace(/_/g, " ")}
    </span>
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
          {a.painPointTags.slice(0, 3).map((t) => <TagPill key={t} tag={t} />)}
        </div>
      )}
    </Link>
  );
}

export default function AnswerIndex() {
  const [answers, setAnswers] = useState<AnswerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Job Search Q&A — Job Genie Answers",
    description: "AI-generated answers to real job-search questions from Reddit communities.",
    url: `${SITE_URL}/answers`,
    publisher: { "@type": "Organization", name: "Job Genie", url: SITE_URL },
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
          <div className="mb-10">
            <p className="text-blue-400 text-sm font-medium tracking-wide uppercase mb-3">GEO — AI Search Intelligence</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
              Job search questions,<br />answered directly
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
              Structured answers optimised for AI search engines — Perplexity, ChatGPT, Google AI Overviews.
              Every answer sourced from real job-seeker questions.
            </p>
          </div>

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

          {!loading && !error && answers.length === 0 && (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">🤖</p>
              <p className="text-gray-400">No answers published yet — trigger Loop 4 from the admin panel.</p>
            </div>
          )}

          {!loading && answers.length > 0 && (
            <>
              <p className="text-xs text-gray-600 mb-6">{answers.length} answer{answers.length !== 1 ? "s" : ""} indexed</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {answers.map((a) => <Card key={a.id} a={a} />)}
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
