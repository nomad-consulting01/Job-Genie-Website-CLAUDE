import { useEffect, useState } from "react";
import { Link } from "wouter";
import { SEO } from "@/components/SEO";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SITE_URL = "https://www.job-genie.ai";

interface BlogPost {
  id: string | number;
  slug: string;
  seoTitle: string;
  metaDescription: string;
  readTimeMinutes: number | null;
  publishedAt: string | null;
  source: "internal" | "beehiiv";
  webUrl: string | null;
  question: {
    id: number | null;
    normalisedQuestion: string;
    painPointTags: string[];
  };
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900/30 text-teal-300 border border-teal-700/30">
      {tag.replace(/_/g, " ")}
    </span>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const inner = (
    <div className="group bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 rounded-2xl p-6 transition-all duration-200 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
        {date && <span>{date}</span>}
        {post.readTimeMinutes && (
          <>
            <span>·</span>
            <span>{post.readTimeMinutes} min read</span>
          </>
        )}
        {post.source === "beehiiv" && (
          <>
            <span>·</span>
            <span className="text-amber-500/80 font-medium">Newsletter</span>
          </>
        )}
      </div>
      <h2 className="text-lg font-semibold text-white group-hover:text-teal-300 transition-colors leading-snug mb-2 flex-1">
        {post.seoTitle.replace(" | Job Genie", "")}
      </h2>
      {post.metaDescription && (
        <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 mb-4">{post.metaDescription}</p>
      )}
      <div className="flex items-center justify-between mt-auto">
        {post.question.painPointTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.question.painPointTags.slice(0, 3).map((t) => <TagPill key={t} tag={t} />)}
          </div>
        )}
        {post.source === "beehiiv" && (
          <span className="text-xs text-gray-600 ml-auto">↗ opens in beehiiv</span>
        )}
      </div>
    </div>
  );

  if (post.source === "beehiiv" && post.webUrl) {
    return (
      <a href={post.webUrl} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }

  return (
    <Link href={`/blog/${post.slug}`} className="block">
      {inner}
    </Link>
  );
}

export default function BlogIndex() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beehiivCount, setBeehiivCount] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/blog?limit=50`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ posts: BlogPost[]; beehiivCount?: number }>;
      })
      .then((d) => {
        setPosts(d.posts);
        setBeehiivCount(d.beehiivCount ?? 0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load posts"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SEO
        title="Job Search Advice & Career Insights | Job Genie Blog"
        description="Expert answers to real job-seeker questions — from Application Silence and ATS myths to hidden job market strategies and recruiter shortlisting."
        url={`${SITE_URL}/blog`}
        canonicalUrl={`${SITE_URL}/blog`}
        pageType="article"
      />

      <div className="min-h-screen bg-[#080b14] text-white">
        <header className="border-b border-white/6">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight text-white hover:text-teal-300 transition-colors">
              Job Genie
            </Link>
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">← Back to home</Link>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-16">
          <div className="mb-12">
            <p className="text-teal-400 text-sm font-medium tracking-wide uppercase mb-3">Job Search Intelligence</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
              Real answers to real<br />job-search questions
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
              Every article is generated from real questions posted to Reddit's job-search communities, answered through Job Genie's AEO framework.
              {beehiivCount > 0 && (
                <> Also includes the latest{" "}
                  <a href="https://jobgenie.beehiiv.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                    Job Genie newsletter
                  </a>{" "}
                  issues.
                </>
              )}
            </p>
          </div>

          {loading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white/3 border border-white/8 rounded-2xl p-6 animate-pulse">
                  <div className="h-3 bg-white/10 rounded w-24 mb-4" />
                  <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-white/8 rounded w-full mb-1" />
                  <div className="h-4 bg-white/8 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-6 text-center">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">✍️</p>
              <p className="text-gray-400">No posts published yet — check back soon.</p>
            </div>
          )}

          {!loading && posts.length > 0 && (
            <>
              <p className="text-xs text-gray-600 mb-6">
                {posts.length} article{posts.length !== 1 ? "s" : ""}
                {beehiivCount > 0 && ` · ${beehiivCount} from the newsletter`}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {posts.map((p) => <PostCard key={String(p.id)} post={p} />)}
              </div>
            </>
          )}
        </main>

        <section className="border-t border-white/6 mt-16">
          <div className="max-w-5xl mx-auto px-6 py-12 text-center">
            <p className="text-gray-400 text-sm mb-4">Stop applying into the void. Get your free Application Autopsy.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-[#080b14] font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Get Your Free Autopsy →
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
