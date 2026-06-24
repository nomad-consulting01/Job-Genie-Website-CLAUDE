/**
 * Server-side HTML route for blog posts.
 *
 * Returns a fully-formed HTML document for GET /blog/:slug with:
 *   1. Per-post canonical, title, meta description, OG/Twitter tags
 *   2. Article body rendered as plain HTML (visible to non-JS crawlers)
 *   3. BlogPosting + BreadcrumbList + Question JSON-LD schemas
 *
 * This acts as the live fallback for posts that were not yet prerendered
 * at the last build.  The Vite SPA loads on top for interactive users.
 */
import { Router } from "express";
import { getBlogPostBySlug } from "../corpus/db.js";
import { logger } from "../lib/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const SITE_URL = "https://job-genie.ai";
const SITE_NAME = "Job Genie";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Path to the job-genie Vite build output (available after production build)
const JOB_GENIE_DIST = path.resolve(__dirname, "../../../../job-genie/dist/public");

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Minimal markdown → HTML for crawler-visible content. */
function mdToHtml(md: string): string {
  return md
    .split(/\n{2,}/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      const headingMatch = block.match(/^(#{1,4})\s+(.*)/s);
      if (headingMatch) {
        const level = Math.min(headingMatch[1]!.length + 1, 6); // h2–h6 (h1 is the title)
        const text = (headingMatch[2] ?? "").replace(/\*\*(.+?)\*\*/g, "$1");
        return `<h${level}>${esc(text)}</h${level}>`;
      }
      if (/^[-*]\s/.test(block)) {
        const items = block
          .split("\n")
          .filter((l) => /^[-*]\s/.test(l))
          .map((l) => `<li>${esc(l.replace(/^[-*]\s+/, ""))}</li>`);
        return `<ul>${items.join("")}</ul>`;
      }
      if (/^\d+\.\s/.test(block)) {
        const items = block
          .split("\n")
          .filter((l) => /^\d+\.\s/.test(l))
          .map((l) => `<li>${esc(l.replace(/^\d+\.\s+/, ""))}</li>`);
        return `<ol>${items.join("")}</ol>`;
      }
      const html = esc(block)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/\n/g, " ");
      return `<p>${html}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Extract the <script type="module"> and <link rel="modulepreload"> tags from the built index.html */
function extractSpaScripts(): string {
  const indexPath = path.join(JOB_GENIE_DIST, "index.html");
  if (!fs.existsSync(indexPath)) return "";
  try {
    const html = fs.readFileSync(indexPath, "utf-8");
    const scripts: string[] = [];
    const linkRe = /<link[^>]*modulepreload[^>]*>/gi;
    const scriptRe = /<script[^>]*type="module"[^>]*>[\s\S]*?<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) scripts.push(m[0]!);
    while ((m = scriptRe.exec(html)) !== null) scripts.push(m[0]!);
    return scripts.join("\n  ");
  } catch {
    return "";
  }
}

function buildBlogPostHtml(opts: {
  slug: string;
  title: string;
  description: string;
  publishedAt: string | null;
  readTimeMinutes: number | null;
  answerFirstBlock: string;
  contentHtml: string;
  normalisedQuestion: string;
  painPointTags: string[];
  faqJsonLd: Record<string, unknown> | null;
  postDataJson: string;
}): string {
  const canonical = `${SITE_URL}/blog/${opts.slug}`;
  const displayTitle = opts.title.includes("| Job Genie") ? opts.title : `${opts.title} | Job Genie`;

  const articleSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${canonical}#article`,
    headline: opts.title.replace(" | Job Genie", ""),
    description: opts.description,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    datePublished: opts.publishedAt ?? undefined,
    author: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME },
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en-GB",
    about: opts.painPointTags.map((t) => ({ "@type": "Thing", name: t.replace(/_/g, " ") })),
  });

  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: opts.title.replace(" | Job Genie", ""), item: canonical },
    ],
  });

  const questionSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Question",
    name: opts.normalisedQuestion,
    acceptedAnswer: { "@type": "Answer", text: opts.description },
  });

  const dateStr = opts.publishedAt
    ? new Date(opts.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const spaScripts = extractSpaScripts();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(displayTitle)}</title>
  <meta name="description" content="${esc(opts.description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:title" content="${esc(displayTitle)}" />
  <meta property="og:description" content="${esc(opts.description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:site_name" content="${esc(SITE_NAME)}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(displayTitle)}" />
  <meta name="twitter:description" content="${esc(opts.description)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <script type="application/ld+json">${articleSchema}</script>
  <script type="application/ld+json">${breadcrumbSchema}</script>
  <script type="application/ld+json">${questionSchema}</script>
  ${opts.faqJsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.faqJsonLd)}</script>` : ""}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  ${spaScripts}
</head>
<body>
  <div id="root" data-ssr="true">
    <article style="max-width:720px;margin:0 auto;padding:48px 24px;font-family:system-ui,sans-serif;color:#e5e7eb;background:#080b14;min-height:100vh">
      <nav style="font-size:12px;color:#6b7280;margin-bottom:32px">
        <a href="/" style="color:#6b7280;text-decoration:none">Home</a>
        &rsaquo; <a href="/blog" style="color:#6b7280;text-decoration:none">Blog</a>
        &rsaquo; <span>${esc(opts.title.replace(" | Job Genie", ""))}</span>
      </nav>
      ${dateStr ? `<time style="font-size:12px;color:#6b7280" datetime="${opts.publishedAt ?? ""}">${esc(dateStr)}</time>` : ""}
      ${opts.readTimeMinutes ? `<span style="font-size:12px;color:#6b7280"> · ${opts.readTimeMinutes} min read</span>` : ""}
      <h1 style="font-size:2rem;font-weight:700;color:#fff;margin:16px 0 24px;line-height:1.2">${esc(opts.title.replace(" | Job Genie", ""))}</h1>
      ${opts.answerFirstBlock
        ? `<section style="background:rgba(20,184,166,.1);border-left:4px solid #14b8a6;border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:32px">
        <p style="font-size:11px;color:#2dd4bf;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px">Quick Answer</p>
        <p style="font-size:14px;color:#e5e7eb;line-height:1.7;margin:0">${esc(opts.answerFirstBlock)}</p>
      </section>`
        : ""}
      <div style="font-size:15px;color:#d1d5db;line-height:1.8">
        ${opts.contentHtml}
      </div>
    </article>
  </div>
  <script>window.__BLOG_POST_DATA__=${opts.postDataJson};</script>
</body>
</html>`;
}

router.get("/:slug", async (req, res) => {
  // Only handle text/html requests (crawlers + direct browser visits)
  const accept = req.headers["accept"] ?? "";
  if (!accept.includes("text/html") && !accept.includes("*/*")) {
    res.status(406).json({ error: "Not acceptable" });
    return;
  }

  const slug = req.params["slug"] ?? "";

  try {
    // Check if a prerendered static file exists — serve that directly (fastest path)
    const staticFile = path.join(JOB_GENIE_DIST, "blog", slug, "index.html");
    if (fs.existsSync(staticFile)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(staticFile);
      return;
    }

    // Dynamic SSR fallback for posts added after the last build
    const row = await getBlogPostBySlug(slug);
    if (!row) {
      res.status(404).send("Not found");
      return;
    }

    const { asset, answer, question } = row;
    const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;

    const seoTitle = String(meta["seoTitle"] ?? question.normalisedQuestion);
    const metaDescription = String(meta["metaDescription"] ?? "");
    const readTimeMinutes = (meta["readTimeMinutes"] as number | null) ?? null;
    const faqJsonLd = (meta["faqJsonLd"] as Record<string, unknown> | null) ?? null;
    const content = String(payload["content"] ?? "");
    const publishedAt = (asset.scheduledFor ?? asset.publishedAt)?.toISOString() ?? null;

    const postData = {
      post: {
        id: asset.id,
        slug: String(asset.externalId ?? slug),
        seoTitle,
        metaDescription,
        readTimeMinutes,
        faqJsonLd,
        content,
        publishedAt,
      },
      question: {
        normalisedQuestion: question.normalisedQuestion,
        painPointTags: question.painPointTags,
        sourceUrl: question.sourceUrl,
      },
      answer: {
        id: answer.id,
        answerFirstBlock: answer.answerFirstBlock,
      },
    };

    const html = buildBlogPostHtml({
      slug,
      title: seoTitle,
      description: metaDescription,
      publishedAt,
      readTimeMinutes,
      answerFirstBlock: answer.answerFirstBlock ?? "",
      contentHtml: mdToHtml(content),
      normalisedQuestion: question.normalisedQuestion,
      painPointTags: question.painPointTags,
      faqJsonLd,
      postDataJson: JSON.stringify(postData),
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.send(html);

    logger.info({ slug }, "blog-html: served dynamic SSR for new post");
  } catch (err) {
    logger.error({ slug, err }, "blog-html: error serving blog post HTML");
    res.status(500).send("Internal server error");
  }
});

export default router;
