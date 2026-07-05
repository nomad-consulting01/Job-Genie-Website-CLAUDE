import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import { SEO } from "@/components/SEO";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SITE_URL = "https://www.job-genie.ai";

interface RelatedAnswer {
  slug: string;
  title: string;
  answerFirstBlock: string;
  painPointTags: string[] | null;
}

interface AnswerData {
  answer: {
    id: number;
    slug: string;
    title: string;
    answerMd: string;
    answerFirstBlock: string;
    sourceUrl: string | null;
    publishedAt: string | null;
  };
  question: {
    normalisedQuestion: string;
    painPointTags: string[];
    sourceUrl: string | null;
  };
  related: RelatedAnswer[];
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300 border border-blue-700/30">
      {tag.replace(/_/g, " ")}
    </span>
  );
}

function extractHeadings(md: string): string[] {
  return (md.match(/^## (.+)$/gm) ?? []).map((h) => h.replace(/^## /, "").trim());
}

function readingTime(md: string): number {
  const words = md.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function slugifyHeading(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AnswerPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<AnswerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`${API_BASE}/api/answers/${slug}`)
      .then((r) => {
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AnswerData>;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  const headings = useMemo(() => (data ? extractHeadings(data.answer.answerMd) : []), [data]);
  const readTime = useMemo(() => (data ? readingTime(data.answer.answerMd) : 0), [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b14] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (error === "not_found" || (!loading && !data)) {
    return (
      <div className="min-h-screen bg-[#080b14] flex flex-col items-center justify-center gap-4">
        <p className="text-4xl">🕳️</p>
        <p className="text-white font-semibold">Answer not found</p>
        <Link href="/answers" className="text-blue-400 text-sm hover:underline">← Back to answers</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#080b14] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/answers" className="text-blue-400 text-sm hover:underline">← Back to answers</Link>
      </div>
    );
  }

  const { answer, question, related } = data!;
  const canonicalUrl = `${SITE_URL}/answers/${answer.slug}`;
  const publishedIso = answer.publishedAt ? new Date(answer.publishedAt).toISOString() : new Date().toISOString();
  const isHowTo = /^how (do|to|can|should)/i.test(question.normalisedQuestion);

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Job Genie",
    url: SITE_URL,
    logo: `${SITE_URL}/apple-touch-icon.png`,
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: question.normalisedQuestion,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer.answerFirstBlock,
          url: canonicalUrl,
        },
      },
      ...related.slice(0, 3).map((r) => ({
        "@type": "Question",
        name: r.title,
        acceptedAnswer: {
          "@type": "Answer",
          text: r.answerFirstBlock,
          url: `${SITE_URL}/answers/${r.slug}`,
        },
      })),
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonicalUrl}#article`,
    headline: answer.title,
    description: answer.answerFirstBlock.slice(0, 160),
    url: canonicalUrl,
    datePublished: publishedIso,
    dateModified: publishedIso,
    image: `${SITE_URL}/og-image.png`,
    author: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Job Genie",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Job Genie",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    keywords: (question.painPointTags ?? []).join(", "),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Answers", item: `${SITE_URL}/answers` },
      { "@type": "ListItem", position: 3, name: answer.title, item: canonicalUrl },
    ],
  };

  const speakableSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": canonicalUrl,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["#quick-answer", "#question-heading"],
    },
    url: canonicalUrl,
  };

  const howToSchema = isHowTo && headings.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: question.normalisedQuestion,
        description: answer.answerFirstBlock,
        step: headings.map((h, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: h,
          url: `${canonicalUrl}#${slugifyHeading(h)}`,
        })),
      }
    : null;

  const schemas = [
    organizationSchema,
    faqSchema,
    articleSchema,
    breadcrumbSchema,
    speakableSchema,
    ...(howToSchema ? [howToSchema] : []),
  ];

  return (
    <>
      <SEO
        title={`${answer.title} | Job Genie`}
        description={answer.answerFirstBlock.slice(0, 158)}
        url={canonicalUrl}
        canonicalUrl={canonicalUrl}
        pageType="article"
        slug={answer.slug}
        aeoQuestion={question.normalisedQuestion}
        schemas={schemas}
      />

      <div className="min-h-screen bg-[#080b14] text-white">
        <header className="border-b border-white/6">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight text-white hover:text-blue-300 transition-colors">
              Job Genie
            </Link>
            <Link href="/answers" className="text-sm text-gray-400 hover:text-white transition-colors">← All answers</Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-12">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="text-xs text-gray-600 mb-8 flex items-center gap-2 flex-wrap">
            <Link href="/" className="hover:text-gray-400">Home</Link>
            <span aria-hidden="true">›</span>
            <Link href="/answers" className="hover:text-gray-400">Answers</Link>
            <span aria-hidden="true">›</span>
            <span className="text-gray-500 truncate max-w-xs">{answer.title}</span>
          </nav>

          {/* Tags + meta */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {question.painPointTags.map((t) => <TagPill key={t} tag={t} />)}
            <span className="text-xs text-gray-600 ml-1">· {readTime} min read</span>
            {answer.publishedAt && (
              <time dateTime={publishedIso} className="text-xs text-gray-600">
                · {new Date(answer.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </time>
            )}
          </div>

          {/* Question heading — speakable target */}
          <h1 id="question-heading" className="text-2xl md:text-3xl font-bold text-white leading-snug mb-6">
            {question.normalisedQuestion}
          </h1>

          {/* Quick Answer — speakable + AEO snippet */}
          <div id="quick-answer" className="bg-blue-900/20 border-l-4 border-blue-500 rounded-r-xl px-5 py-4 mb-8">
            <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-1">Direct Answer</p>
            <p className="text-sm text-gray-200 leading-relaxed">{answer.answerFirstBlock}</p>
          </div>

          {/* Table of Contents — shown when 3+ H2s exist */}
          {headings.length >= 3 && (
            <nav aria-label="Table of contents" className="bg-white/4 border border-white/8 rounded-xl px-5 py-4 mb-10">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">On this page</p>
              <ol className="space-y-1.5 list-none">
                {headings.map((h) => (
                  <li key={h}>
                    <a href={`#${slugifyHeading(h)}`} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      {h}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* Full answer — H2s get anchor IDs for ToC and HowTo schema */}
          <article className="prose prose-invert prose-sm max-w-none
            prose-headings:font-semibold prose-headings:text-white
            prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-gray-100
            prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-gray-200
            prose-p:text-gray-300 prose-p:leading-relaxed prose-p:my-4
            prose-strong:text-white prose-strong:font-semibold
            prose-ul:text-gray-300 prose-ul:my-4
            prose-ol:text-gray-300 prose-ol:my-4
            prose-li:my-1 prose-li:leading-relaxed
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-blue-600 prose-blockquote:text-gray-400
            prose-hr:border-white/10
            prose-code:text-blue-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown
              components={{
                h2: ({ children }) => {
                  const text = typeof children === "string" ? children : String(children);
                  return <h2 id={slugifyHeading(text)}>{children}</h2>;
                },
              }}
            >
              {answer.answerMd}
            </ReactMarkdown>
          </article>

          {/* Source attribution */}
          {question.sourceUrl && (
            <div className="mt-10 pt-6 border-t border-white/8">
              <p className="text-xs text-gray-600">
                Question sourced from real job-seeker discussion:{" "}
                <a href={question.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 underline">
                  {question.sourceUrl.replace(/^https?:\/\//, "").slice(0, 70)}
                </a>
              </p>
            </div>
          )}

          {/* Related Questions — internal linking by shared pain-point tags */}
          {related.length > 0 && (
            <aside className="mt-12" aria-label="Related questions">
              <h2 className="text-base font-semibold text-gray-300 mb-4">Related questions</h2>
              <div className="space-y-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/answers/${r.slug}`}
                    className="group block bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 rounded-xl px-4 py-3 transition-all"
                  >
                    <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors leading-snug mb-0.5">
                      {r.title}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-1">{r.answerFirstBlock}</p>
                  </Link>
                ))}
              </div>
            </aside>
          )}

          {/* CTA */}
          <div className="mt-12 bg-gradient-to-br from-blue-900/30 to-teal-900/20 border border-blue-700/30 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">See exactly why your applications go unanswered</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-md mx-auto">
              Get your free Application Autopsy — Application Silence Score, Recruiter-Fit Gap, and your closest specialist-recruiter matches.
            </p>
            <Link href="/" className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-[#080b14] font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
              Get Your Free Autopsy →
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
