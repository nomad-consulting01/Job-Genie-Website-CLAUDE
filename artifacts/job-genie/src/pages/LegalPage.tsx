import { Link } from "wouter";
import ReactMarkdown from "react-markdown";
import { SEO } from "@/components/SEO";

const SITE_URL = "https://www.job-genie.ai";

interface LegalPageProps {
  slug: string;
  title: string;
  description: string;
  content: string;
}

export default function LegalPage({ slug, title, description, content }: LegalPageProps) {
  const canonicalUrl = `${SITE_URL}/${slug}`;

  return (
    <>
      <SEO
        title={`${title} | Job Genie`}
        description={description}
        url={canonicalUrl}
        canonicalUrl={canonicalUrl}
        pageType="article"
        slug={slug}
      />

      <div className="min-h-screen bg-white text-gray-900">
        <header className="bg-[#080b14] border-b border-white/10">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight text-white hover:text-teal-300 transition-colors">
              Job Genie
            </Link>
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              ← Back to home
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-12">
          <nav className="text-xs text-gray-500 mb-6 flex items-center gap-2">
            <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
            <span>›</span>
            <span className="text-gray-400">{title}</span>
          </nav>

          <article
            className="prose prose-sm max-w-none
            prose-headings:font-semibold prose-headings:text-gray-900
            prose-h1:text-3xl prose-h1:mb-6 prose-h1:leading-tight
            prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-gray-900
            prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-gray-800
            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-4
            prose-strong:text-gray-900 prose-strong:font-semibold
            prose-ul:text-gray-700 prose-ul:my-4 prose-ul:space-y-2 prose-ul:list-disc prose-ul:pl-6
            prose-ol:text-gray-700 prose-ol:my-4 prose-ol:space-y-2 prose-ol:list-decimal prose-ol:pl-6
            prose-li:my-1 prose-li:leading-relaxed
            prose-a:text-teal-600 prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-teal-500 prose-blockquote:text-gray-500 prose-blockquote:my-6
            prose-hr:border-gray-200 prose-hr:my-8
            prose-code:text-teal-700 prose-code:bg-teal-50 prose-code:px-1 prose-code:rounded"
          >
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        </main>
      </div>
    </>
  );
}
