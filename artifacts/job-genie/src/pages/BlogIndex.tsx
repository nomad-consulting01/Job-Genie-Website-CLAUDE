import { useEffect, useState } from "react";
import { Link } from "wouter";
import { SEO } from "@/components/SEO";
import { BrandNavigation } from "../components/BrandNavigation";
import { BLOG_INDEX_STYLES, SITE_URL } from "@workspace/site-config";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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
    <span className="blog-tag">
      {tag.replace(/_/g, " ")}
    </span>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const inner = (
    <div className="blog-card">
      <div className="blog-meta">
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
            <span className="blog-newsletter-label">Newsletter</span>
          </>
        )}
      </div>
      <h2 className="blog-card-title">
        {post.seoTitle.replace(" | Job Genie", "")}
      </h2>
      {post.metaDescription && (
        <p className="blog-description">{post.metaDescription}</p>
      )}
      <div className="blog-card-foot">
        {post.question.painPointTags.length > 0 && (
          <div className="blog-tags">
            {post.question.painPointTags.slice(0, 3).map((t) => <TagPill key={t} tag={t} />)}
          </div>
        )}
        {post.source === "beehiiv" && (
          <span className="blog-external">↗ opens in beehiiv</span>
        )}
      </div>
    </div>
  );

  if (post.source === "beehiiv" && post.webUrl) {
    return (
      <a href={post.webUrl} target="_blank" rel="noopener noreferrer" className="blog-card-link">
        {inner}
      </a>
    );
  }

  return (
    <Link href={`/blog/${post.slug}`} className="blog-card-link">
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

      <style>{BLOG_INDEX_STYLES}</style>
      <div className="jg-blog">
        <BrandNavigation />

        <main className="blog-main">
          <div className="blog-intro">
            <p className="blog-eyebrow">Job Search Intelligence</p>
            <h1 className="blog-title">
              Real answers to real<br />job-search questions
            </h1>
            <p className="blog-lead">
              Every article is generated from real questions posted to Reddit's job-search communities, answered through Job Genie's AEO framework.
              {beehiivCount > 0 && (
                <> Also includes the latest{" "}
                  <a href="https://jobgenie.beehiiv.com" target="_blank" rel="noopener noreferrer" className="blog-newsletter">
                    Job Genie newsletter
                  </a>{" "}
                  issues.
                </>
              )}
            </p>
          </div>

          {loading && (
            <div className="blog-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="blog-card animate-pulse">
                  <div className="h-3 bg-white/10 rounded w-24 mb-4" />
                  <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-white/8 rounded w-full mb-1" />
                  <div className="h-4 bg-white/8 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="blog-error">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className="blog-empty">
              <p className="blog-empty-icon">✍️</p>
              <p>No posts published yet — check back soon.</p>
            </div>
          )}

          {!loading && posts.length > 0 && (
            <>
              <p className="blog-count">
                {posts.length} article{posts.length !== 1 ? "s" : ""}
                {beehiivCount > 0 && ` · ${beehiivCount} from the newsletter`}
              </p>
              <div className="blog-grid">
                {posts.map((p) => <PostCard key={String(p.id)} post={p} />)}
              </div>
            </>
          )}
        </main>

        <section className="blog-cta-section">
          <div>
            <p>Stop applying into the void. Get your free Application Autopsy.</p>
            <Link
              href="/"
              className="blog-cta"
            >
              Get Your Free Autopsy →
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
