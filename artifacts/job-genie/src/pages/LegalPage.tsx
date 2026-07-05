import { Link } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { SEO } from "@/components/SEO";

const SITE_URL = "https://www.job-genie.ai";

interface LegalPageProps {
  slug: string;
  title: string;
  description: string;
  content: string;
  toc?: string[];
  badgeLabel?: string;
  accentColor?: string;
}

const PILL_COLORS: Record<string, string> = {
  deleted: "#f87171",
  anonymized: "#fbbf24",
  retained: "#94a3b8",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function splitHeading(raw: string): { eyebrow: string | null; title: string } {
  const parts = raw.split("::");
  if (parts.length === 2) {
    return { eyebrow: parts[0].trim(), title: parts[1].trim() };
  }
  return { eyebrow: null, title: raw.trim() };
}

function extractMeta(content: string): { meta: string | null; rest: string } {
  const lines = content.trim().split("\n");
  const first = lines[0]?.trim() ?? "";
  const metaMatch = first.match(/^_(.+)_$/);
  if (metaMatch) {
    return { meta: metaMatch[1], rest: lines.slice(1).join("\n").trim() };
  }
  return { meta: null, rest: content.trim() };
}

function highlightSummary(content: string): string {
  return content.replace(
    /^##\s+(?:Plain English Summary|The short version)(?:::.+)?\s*\n+([\s\S]*?)(?=\n##\s|$)/m,
    (_match, body: string) => {
      const quoted = body
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return `> **The short version**\n>\n${quoted}\n\n`;
    }
  );
}

function extractHeadings(content: string): { id: string; text: string }[] {
  const headingRegex = /^##\s+(.+)$/gm;
  const headings: { id: string; text: string }[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const { title } = splitHeading(match[1]);
    if (/^(plain english summary|the short version)$/i.test(title)) continue;
    headings.push({ id: slugify(title), text: title });
  }
  return headings;
}

export default function LegalPage({
  slug,
  title,
  description,
  content,
  toc,
  badgeLabel = "Legal",
  accentColor = "#818cf8",
}: LegalPageProps) {
  const canonicalUrl = `${SITE_URL}/${slug}`;
  const { meta, rest: body } = extractMeta(content);
  const rest = highlightSummary(body);
  const metaParts = meta ? meta.split("·").map((p) => p.trim()) : [];
  const headings = extractHeadings(body);
  const sidebarItems = toc && toc.length === headings.length
    ? headings.map((h, i) => ({ id: h.id, text: toc[i] }))
    : headings;

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

      <div className="min-h-screen" style={{ background: "var(--nn, #080810)" }}>
        <header className="bg-[#080b14] border-b border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight text-white hover:text-teal-300 transition-colors">
              Job Genie
            </Link>
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              ← Back to home
            </Link>
          </div>
        </header>

        <div
          className="text-center pt-16 pb-10 px-6"
          style={{
            background: `radial-gradient(600px 260px at 50% 0%, ${accentColor}26, transparent 70%)`,
          }}
        >
          <div className="max-w-6xl mx-auto">
            <span
              className="inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-6"
              style={{
                background: `${accentColor}24`,
                border: `1px solid ${accentColor}59`,
                color: accentColor,
              }}
            >
              {badgeLabel}
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-5">{title}</h1>
            <p className="max-w-2xl mx-auto text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              {description}
            </p>

            {metaParts.length > 0 && (
              <div
                className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-[13px]"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {metaParts.map((part, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
                    {part}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />

        <main className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-12">
          {sidebarItems.length > 0 && (
            <aside className="hidden md:block">
              <div className="sticky top-8">
                <div
                  className="text-[11px] font-bold uppercase tracking-wider mb-4"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  On This Page
                </div>
                <nav className="flex flex-col gap-3">
                  {sidebarItems.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className="text-[13px] leading-snug transition-colors hover:text-white"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}

          <article>
            <nav className="text-xs mb-8 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.4)" }}>
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <span>›</span>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>{title}</span>
            </nav>

            <div
              className="prose prose-sm max-w-none prose-invert
              prose-headings:font-semibold
              prose-h1:text-3xl prose-h1:mb-6 prose-h1:leading-tight
              prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:leading-relaxed prose-p:my-4
              prose-p:text-white/70
              prose-strong:text-white prose-strong:font-semibold
              prose-ul:my-4 prose-ul:space-y-2 prose-ul:list-disc prose-ul:pl-6
              prose-ol:my-4 prose-ol:space-y-2 prose-ol:list-decimal prose-ol:pl-6
              prose-li:my-1 prose-li:leading-relaxed prose-li:text-white/70
              prose-a:text-teal-300 prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-0 prose-blockquote:bg-white/[0.04]
              prose-blockquote:border prose-blockquote:border-white/10 prose-blockquote:rounded-xl
              prose-blockquote:not-italic prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:my-6
              prose-blockquote:text-white/70
              prose-hr:border-white/10 prose-hr:my-8
              prose-code:text-teal-300 prose-code:bg-teal-500/10 prose-code:px-1 prose-code:rounded
              prose-table:my-6 prose-table:w-full prose-table:border-collapse
              prose-thead:border-white/10 prose-tr:border-white/10 prose-th:text-white prose-td:text-white/70
              prose-th:text-[11px] prose-th:uppercase prose-th:tracking-wider prose-th:py-3 prose-th:px-4
              prose-td:py-3 prose-td:px-4 prose-td:align-top"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  h2: ({ children, ...props }) => {
                    const { eyebrow, title: headingTitle } = splitHeading(String(children));
                    const id = slugify(headingTitle);
                    return (
                      <>
                        {eyebrow && (
                          <div
                            className="text-[11px] font-bold uppercase tracking-wider mt-10"
                            style={{ color: accentColor }}
                          >
                            {eyebrow}
                          </div>
                        )}
                        <h2 id={id} {...props} className={eyebrow ? "!mt-2" : undefined}>
                          {headingTitle}
                        </h2>
                      </>
                    );
                  },
                  thead: ({ children, ...props }) => (
                    <thead
                      {...props}
                      style={{ background: `${accentColor}1F`, borderBottom: `1px solid ${accentColor}40` }}
                    >
                      {children}
                    </thead>
                  ),
                  td: ({ children, ...props }) => {
                    const text = String(children).trim().toLowerCase();
                    const pillColor = PILL_COLORS[text];
                    if (pillColor) {
                      return (
                        <td {...props}>
                          <span
                            className="inline-block text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full"
                            style={{
                              background: `${pillColor}26`,
                              border: `1px solid ${pillColor}59`,
                              color: pillColor,
                            }}
                          >
                            {children}
                          </span>
                        </td>
                      );
                    }
                    return <td {...props}>{children}</td>;
                  },
                }}
              >
                {rest}
              </ReactMarkdown>
            </div>
          </article>
        </main>
      </div>
    </>
  );
}
