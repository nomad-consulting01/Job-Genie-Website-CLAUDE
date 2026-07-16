/**
 * Server-side HTML routes for GEO answer pages.
 *
 * GET /answers       — crawlable answers index with route-specific SEO and article list.
 * GET /answers/:slug — per-answer canonical HTML with full content for non-JS crawlers.
 *
 * Mirrors the blog-html.ts pattern:
 *   1. Check for a prerendered static file first (fastest path).
 *   2. Fall back to dynamic DB-driven SSR for answers added after the last build.
 */
import { Router } from "express";
import { listPublishedAnswerPages, getAnswerPageBySlug } from "../corpus/db.js";
import { logger } from "../lib/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { SITE_URL, SITE_NAME, OG_IMAGE } from "@workspace/site-config";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOB_GENIE_DIST = path.resolve(__dirname, "../../job-genie/dist/public");

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
        const level = Math.min(headingMatch[1]!.length + 1, 6);
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

// ─── Answers index ─────────────────────────────────────────────────────────────

router.get("/", async (_req, res) => {
  const canonical = `${SITE_URL}/answers`;
  const title = "Job Search Q&A — Expert Answers | Job Genie";
  const description =
    "Structured answers to real job-seeker questions — Application Silence, ATS myths, hidden job market strategies, recruiter shortlisting, and more.";

  try {
    const rows = await listPublishedAnswerPages(100, 0);
    const answers = rows.map(({ asset, answer, question }) => {
      const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
      return {
        slug: String(asset.externalId ?? ""),
        title: String(payload["title"] ?? question.normalisedQuestion),
        answerFirstBlock: answer.answerFirstBlock ?? "",
        painPointTags: question.painPointTags,
      };
    }).filter((a) => a.slug);

    const spaScripts = extractSpaScripts();

    const collectionSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      hasPart: answers.slice(0, 10).map((a) => ({
        "@type": "QAPage",
        name: a.title,
        url: `${SITE_URL}/answers/${a.slug}`,
      })),
    });

    const listHtml = answers.length > 0
      ? answers.map((a) => `<li style="margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:16px">
          <h2 style="font-size:16px;font-weight:600;margin:0 0 6px">
            <a href="/answers/${esc(a.slug)}" style="color:#93c5fd;text-decoration:none">${esc(a.title)}</a>
          </h2>
          <p style="font-size:13px;color:#9ca3af;margin:0;line-height:1.5">${esc(a.answerFirstBlock.slice(0, 150))}…</p>
        </li>`).join("\n")
      : "<li style='color:#9ca3af'>No answers published yet — check back soon.</li>";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:site_name" content="${esc(SITE_NAME)}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <script type="application/ld+json">${collectionSchema}</script>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  ${spaScripts}
</head>
<body>
  <div id="root">
    <div style="min-height:100vh;background:#080b14;color:#fff;font-family:system-ui,sans-serif">
      <header style="border-bottom:1px solid rgba(255,255,255,.06);padding:16px 24px">
        <a href="/" style="font-size:20px;font-weight:700;color:#fff;text-decoration:none">${esc(SITE_NAME)}</a>
      </header>
      <main style="max-width:960px;margin:0 auto;padding:64px 24px">
        <p style="font-size:12px;color:#60a5fa;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 12px">GEO — AI Search Intelligence</p>
        <h1 style="font-size:40px;font-weight:700;color:#fff;line-height:1.2;margin:0 0 16px">Job search questions,<br />answered directly</h1>
        <p style="font-size:18px;color:#9ca3af;margin:0 0 48px;max-width:640px;line-height:1.6">
          Structured answers optimised for AI search engines — Perplexity, ChatGPT, Google AI Overviews. Every answer sourced from real job-seeker questions.
        </p>
        <p style="font-size:12px;color:#4b5563;margin:0 0 24px">${answers.length} answer${answers.length !== 1 ? "s" : ""} indexed</p>
        <ul style="list-style:none;padding:0;margin:0">
          ${listHtml}
        </ul>
      </main>
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.send(html);
  } catch (err) {
    logger.error({ err }, "answers-html: error serving answers index HTML");
    res.status(500).send("Internal server error");
  }
});

// ─── Answer detail ──────────────────────────────────────────────────────────

router.get("/:slug", async (req, res) => {
  const accept = req.headers["accept"] ?? "";
  if (!accept.includes("text/html") && !accept.includes("*/*")) {
    res.status(406).json({ error: "Not acceptable" });
    return;
  }

  const slug = req.params["slug"] ?? "";

  try {
    // Check if a prerendered static file exists — serve that directly (fastest path)
    const staticFile = path.join(JOB_GENIE_DIST, "answers", slug, "index.html");
    if (fs.existsSync(staticFile)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(staticFile);
      return;
    }

    // Dynamic SSR fallback
    const row = await getAnswerPageBySlug(slug);
    if (!row) {
      res.status(404).send("Not found");
      return;
    }

    const { asset, answer, question } = row;
    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;

    const title = String(payload["title"] ?? question.normalisedQuestion);
    const answerMd = String(payload["answer_md"] ?? answer.answerMd ?? "");
    const answerFirstBlock = answer.answerFirstBlock ?? "";
    const publishedAt = (asset.scheduledFor ?? asset.publishedAt)?.toISOString() ?? null;

    const canonical = `${SITE_URL}/answers/${slug}`;
    const displayTitle = title.includes("| Job Genie") ? title : `${title} | Job Genie`;
    const description = answerFirstBlock.slice(0, 158);

    const dateStr = publishedAt
      ? new Date(publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : null;

    const isHowTo = /^how (do|to|can|should)/i.test(question.normalisedQuestion);
    const headings = (answerMd.match(/^## (.+)$/gm) ?? []).map((h) => h.replace(/^## /, "").trim());

    const faqSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: question.normalisedQuestion,
          acceptedAnswer: { "@type": "Answer", text: answerFirstBlock, url: canonical },
        },
      ],
    });

    const articleSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${canonical}#article`,
      headline: title,
      description,
      url: canonical,
      datePublished: publishedAt ?? undefined,
      dateModified: publishedAt ?? undefined,
      author: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME },
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-GB",
    });

    const breadcrumbSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Answers", item: `${SITE_URL}/answers` },
        { "@type": "ListItem", position: 3, name: title, item: canonical },
      ],
    });

    const howToSchema = isHowTo && headings.length > 0
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: question.normalisedQuestion,
          description: answerFirstBlock,
          step: headings.map((h, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: h,
            url: `${canonical}#${h.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          })),
        })
      : null;

    const spaScripts = extractSpaScripts();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(displayTitle)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:title" content="${esc(displayTitle)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:site_name" content="${esc(SITE_NAME)}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(displayTitle)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <script type="application/ld+json">${faqSchema}</script>
  <script type="application/ld+json">${articleSchema}</script>
  <script type="application/ld+json">${breadcrumbSchema}</script>
  ${howToSchema ? `<script type="application/ld+json">${howToSchema}</script>` : ""}
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  ${spaScripts}
</head>
<body>
  <div id="root" data-ssr="true">
    <article style="max-width:720px;margin:0 auto;padding:48px 24px;font-family:system-ui,sans-serif;color:#e5e7eb;background:#080b14;min-height:100vh">
      <nav style="font-size:12px;color:#6b7280;margin-bottom:32px">
        <a href="/" style="color:#6b7280;text-decoration:none">Home</a>
        &rsaquo; <a href="/answers" style="color:#6b7280;text-decoration:none">Answers</a>
        &rsaquo; <span>${esc(title)}</span>
      </nav>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;align-items:center">
        ${question.painPointTags.map((t) => `<span style="font-size:11px;padding:3px 8px;border-radius:999px;background:rgba(37,99,235,.2);color:#93c5fd;border:1px solid rgba(37,99,235,.3)">${esc(t.replace(/_/g, " "))}</span>`).join("")}
        ${dateStr ? `<time style="font-size:12px;color:#6b7280" datetime="${publishedAt ?? ""}">${esc(dateStr)}</time>` : ""}
      </div>
      <h1 style="font-size:1.75rem;font-weight:700;color:#fff;margin:0 0 24px;line-height:1.3">${esc(question.normalisedQuestion)}</h1>
      <div style="background:rgba(37,99,235,.1);border-left:4px solid #3b82f6;border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:32px">
        <p style="font-size:11px;color:#60a5fa;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px">Direct Answer</p>
        <p style="font-size:14px;color:#e5e7eb;line-height:1.7;margin:0">${esc(answerFirstBlock)}</p>
      </div>
      <div style="font-size:15px;color:#d1d5db;line-height:1.8">
        ${mdToHtml(answerMd)}
      </div>
      <div style="margin-top:48px;background:linear-gradient(135deg,rgba(37,99,235,.15),rgba(20,184,166,.1));border:1px solid rgba(37,99,235,.3);border-radius:16px;padding:32px;text-align:center">
        <h3 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px">See exactly why your applications go unanswered</h3>
        <p style="font-size:14px;color:#9ca3af;margin:0 0 24px;line-height:1.6">Get your free Application Autopsy — Application Silence Score, Recruiter-Fit Gap, and your closest specialist-recruiter matches.</p>
        <a href="/" style="display:inline-flex;align-items:center;gap:8px;background:#14b8a6;color:#080b14;font-weight:600;padding:12px 24px;border-radius:12px;text-decoration:none;font-size:14px">Get Your Free Autopsy →</a>
      </div>
    </article>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.send(html);

    logger.info({ slug }, "answers-html: served dynamic SSR for answer page");
  } catch (err) {
    logger.error({ slug, err }, "answers-html: error serving answer page HTML");
    res.status(500).send("Internal server error");
  }
});

export default router;
