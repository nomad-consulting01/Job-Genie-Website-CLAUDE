import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Helmet } from "react-helmet-async";

interface QAData {
  slug: string;
  title: string;
  answer_first_block: string;
  answer_md: string;
  pain_point_tags: string[];
  published_at: string | null;
  quality_score: number | null;
}

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function renderMd(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-white mt-8 mb-3">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-200 mt-6 mb-2">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, '</p><p class="mb-4 text-gray-300">')
    .replace(/\n/g, "<br />");
}

export default function QAPage() {
  const [, params] = useRoute("/qa/:slug");
  const slug = params?.slug ?? "";

  const [data, setData] = useState<QAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    fetch(`${API_BASE}/api/qa/${slug}`, {
      headers: { Accept: "application/json" },
    })
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        setData(await r.json() as QAData);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const SITE_URL = "https://job-genie.ai";
  const canonical = `${SITE_URL}/qa/${slug}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold text-white">Question not found</h1>
        <p className="text-gray-400">This Q&amp;A hasn't been published yet.</p>
        <Link href="/" className="text-purple-400 hover:underline">← Back to Job Genie</Link>
      </div>
    );
  }

  const faqSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: data.title,
        acceptedAnswer: { "@type": "Answer", text: data.answer_first_block },
      },
    ],
  });

  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Job Search FAQ", item: `${SITE_URL}/qa` },
      { "@type": "ListItem", position: 3, name: data.title, item: canonical },
    ],
  });

  const ogDesc = data.answer_first_block.slice(0, 160);

  return (
    <>
      <Helmet>
        <title>{data.title} | Job Genie</title>
        <meta name="description" content={ogDesc} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={`${data.title} | Job Genie`} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="Job Genie" />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${data.title} | Job Genie`} />
        <meta name="twitter:description" content={ogDesc} />
        <script type="application/ld+json">{faqSchema}</script>
        <script type="application/ld+json">{breadcrumbSchema}</script>
      </Helmet>

      <div className="min-h-screen bg-[#0a0a1a] text-gray-100">
        {/* Nav */}
        <header className="border-b border-white/8 px-6 py-4">
          <Link href="/" className="font-bold text-lg text-white hover:opacity-80">
            Job <span className="text-purple-400">Genie</span>
          </Link>
        </header>

        <main className="max-w-3xl mx-auto px-5 py-10 pb-20">
          <Link href="/" className="text-sm text-purple-400 hover:underline mb-6 inline-block">
            ← Back to Job Genie
          </Link>

          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-6">
            {data.title}
          </h1>

          {/* Answer-first block — AEO featured snippet target */}
          <div className="bg-gradient-to-br from-purple-900/20 to-teal-900/10 border-l-4 border-purple-500 rounded-r-xl px-6 py-5 mb-8 text-gray-200 text-lg italic leading-relaxed">
            {data.answer_first_block}
          </div>

          {/* Full answer body */}
          <div
            className="prose-custom text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: `<p class="mb-4 text-gray-300">${renderMd(data.answer_md)}</p>`,
            }}
          />

          {/* Pain point tags */}
          {data.pain_point_tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {data.pain_point_tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-purple-900/20 text-purple-300 border border-purple-700/30 rounded-full px-3 py-1 text-xs"
                >
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-12 rounded-2xl p-8 text-center bg-gradient-to-br from-purple-600/20 to-teal-500/10 border border-purple-700/30">
            <h2 className="text-xl font-bold text-white mb-3">
              Find out exactly what's blocking your interviews
            </h2>
            <p className="text-gray-300 mb-6 text-sm max-w-md mx-auto">
              Job Genie's free Application Autopsy diagnoses your Application Silence Score,
              ghost-job exposure, and Recruiter-Fit Gap in under 2 minutes.
            </p>
            <a
              href="https://modular-pipeline.replit.app/?upload=true"
              className="inline-block bg-gradient-to-r from-purple-500 to-teal-400 text-white font-bold px-8 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              Get My Free Autopsy →
            </a>
          </div>
        </main>
      </div>
    </>
  );
}
