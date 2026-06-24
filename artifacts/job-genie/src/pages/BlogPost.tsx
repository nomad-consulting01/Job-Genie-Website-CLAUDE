import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import { SEO } from "@/components/SEO";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SITE_URL = "https://job-genie.ai";

interface BlogPostData {
  post: {
    id: number;
    slug: string;
    seoTitle: string;
    metaDescription: string;
    readTimeMinutes: number | null;
    faqJsonLd: Record<string, unknown> | null;
    featuredImageUrl: string | null;
    content: string;
    publishedAt: string | null;
  };
  question: {
    normalisedQuestion: string;
    painPointTags: string[];
    sourceUrl: string | null;
  };
  answer: {
    answerFirstBlock: string;
  };
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900/30 text-teal-300 border border-teal-700/30">
      {tag.replace(/_/g, " ")}
    </span>
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`${API_BASE}/api/blog/${slug}`)
      .then((r) => {
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BlogPostData>;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load post"))
      .finally(() => setLoading(false));
  }, [slug]);

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
        <p className="text-white font-semibold">Post not found</p>
        <Link href="/blog" className="text-teal-400 text-sm hover:underline">← Back to blog</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#080b14] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/blog" className="text-teal-400 text-sm hover:underline">← Back to blog</Link>
      </div>
    );
  }

  const { post, question, answer } = data!;
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;
  const extraSchemas = post.faqJsonLd ? [post.faqJsonLd] : [];

  return (
    <>
      <SEO
        title={post.seoTitle}
        description={post.metaDescription}
        url={canonicalUrl}
        canonicalUrl={canonicalUrl}
        pageType="article"
        slug={post.slug}
        aeoQuestion={question.normalisedQuestion}
        schemas={extraSchemas}
        ogImage={post.featuredImageUrl ?? undefined}
      />

      <div className="min-h-screen bg-[#080b14] text-white">
        {/* Header */}
        <header className="border-b border-white/6">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight text-white hover:text-teal-300 transition-colors">
              Job Genie
            </Link>
            <Link href="/blog" className="text-sm text-gray-400 hover:text-white transition-colors">
              ← All posts
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-12">
          {/* Breadcrumb */}
          <nav className="text-xs text-gray-600 mb-8 flex items-center gap-2">
            <Link href="/" className="hover:text-gray-400 transition-colors">Home</Link>
            <span>›</span>
            <Link href="/blog" className="hover:text-gray-400 transition-colors">Blog</Link>
            <span>›</span>
            <span className="text-gray-500 truncate max-w-xs">{post.seoTitle.replace(" | Job Genie", "")}</span>
          </nav>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 flex-wrap">
            {date && <span>{date}</span>}
            {post.readTimeMinutes && (
              <>
                <span>·</span>
                <span>{post.readTimeMinutes} min read</span>
              </>
            )}
            {question.painPointTags.length > 0 && (
              <>
                <span>·</span>
                {question.painPointTags.slice(0, 3).map((t) => <TagPill key={t} tag={t} />)}
              </>
            )}
          </div>

          {/* Answer first block — AEO snippet */}
          {answer.answerFirstBlock && (
            <div className="bg-teal-900/20 border-l-4 border-teal-500 rounded-r-xl px-5 py-4 mb-8">
              <p className="text-xs text-teal-400 font-medium uppercase tracking-wide mb-1">Quick Answer</p>
              <p className="text-sm text-gray-200 leading-relaxed">{answer.answerFirstBlock}</p>
            </div>
          )}

          {/* Main content */}
          <article className="prose prose-invert prose-sm max-w-none
            prose-headings:font-semibold prose-headings:text-white
            prose-h1:text-3xl prose-h1:mb-6 prose-h1:leading-tight
            prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-gray-100
            prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-gray-200
            prose-p:text-gray-300 prose-p:leading-relaxed prose-p:my-4
            prose-strong:text-white prose-strong:font-semibold
            prose-ul:text-gray-300 prose-ul:my-4 prose-ul:space-y-1
            prose-ol:text-gray-300 prose-ol:my-4
            prose-li:my-1 prose-li:leading-relaxed
            prose-a:text-teal-400 prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-teal-600 prose-blockquote:text-gray-400
            prose-hr:border-white/10
            prose-code:text-teal-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </article>

          {/* Source attribution */}
          {question.sourceUrl && (
            <div className="mt-10 pt-6 border-t border-white/8">
              <p className="text-xs text-gray-600">
                Question source:{" "}
                <a href={question.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 underline">
                  {question.sourceUrl.replace(/^https?:\/\//, "").slice(0, 60)}
                </a>
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="mt-12 bg-gradient-to-br from-teal-900/30 to-blue-900/20 border border-teal-700/30 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Stop applying into the void</h3>
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
