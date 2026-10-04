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
import { getBlogPostBySlug, getPublicDirectResponseForAnswer, listPublishedBlogPosts } from "../corpus/db.js";
import { logger } from "../lib/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { SITE_URL, SITE_NAME, OG_IMAGE } from "@workspace/site-config";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Path to the job-genie Vite build output (available after production build)
const JOB_GENIE_DIST = path.resolve(__dirname, "../../job-genie/dist/public");

/**
 * Remove a post's prerendered static file so the dynamic SSR fallback (which reads
 * fresh approved copy) serves it instead. Called when marketing copy is approved,
 * unapproved, or edited, so crawlers don't keep seeing stale HTML until the next build.
 */
export function invalidatePrerenderedBlogPost(slug: string): void {
  try {
    const staticFile = path.join(JOB_GENIE_DIST, "blog", slug, "index.html");
    if (fs.existsSync(staticFile)) {
      fs.unlinkSync(staticFile);
      logger.info({ slug }, "blog-html: invalidated prerendered file after marketing change");
    }
  } catch (err) {
    logger.warn({ slug, err }, "blog-html: failed to invalidate prerendered file");
  }
}

/** Serialises an object as JSON-LD, escaping `<` so DB content can't break out of the script tag. */
function jsonLdStr(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

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

interface PublicMarketingVariant {
  copy: string;
  hashtags: string[];
  cta: string;
}
interface PublicDirectResponse {
  meta: PublicMarketingVariant | null;
  instagram: PublicMarketingVariant | null;
}

/**
 * Server-rendered, crawlable tabbed Meta/Instagram section for the raw HTML path.
 * Renders both tabpanels with ARIA roles (inactive one hidden). A tiny inline
 * script upgrades it into a keyboard-accessible tab + copy interface for the
 * brief window before the SPA mounts and for no-JS-framework crawlers.
 */
function buildDirectResponseHtml(dr: PublicDirectResponse | null): string {
  if (!dr) return "";
  const channels: { key: "meta" | "instagram"; label: string; v: PublicMarketingVariant }[] = [];
  if (dr.meta) channels.push({ key: "meta", label: "Meta", v: dr.meta });
  if (dr.instagram) channels.push({ key: "instagram", label: "Instagram", v: dr.instagram });
  if (channels.length === 0) return "";

  const NAVY = "#090D19";
  const INDIGO = "#7C83FF";
  const SORA = "'Sora',sans-serif";
  const DM = "'DM Sans',sans-serif";

  const tabs = channels
    .map((c, i) => {
      const selected = i === 0;
      const style = selected
        ? `font-family:${SORA};background:${INDIGO};color:${NAVY};border:1px solid ${INDIGO}`
        : `font-family:${SORA};background:rgba(255,255,255,.05);color:#9ca3af;border:1px solid rgba(255,255,255,.1)`;
      return `<button type="button" role="tab" id="dr-tab-${c.key}" aria-selected="${selected}" aria-controls="dr-panel-${c.key}" tabindex="${selected ? 0 : -1}" data-dr-tab="${c.key}" style="border-radius:8px;padding:8px 16px;font-size:14px;font-weight:600;cursor:pointer;${style}">${esc(c.label)}</button>`;
    })
    .join("");

  const panels = channels
    .map((c, i) => {
      const hidden = i === 0 ? "" : " hidden";
      const hashtags = c.v.hashtags.length
        ? `<p style="font-family:${DM};font-size:14px;font-weight:500;color:${INDIGO};margin:0 0 16px">${esc(c.v.hashtags.join(" "))}</p>`
        : "";
      const cta = c.v.cta
        ? `<p style="font-family:${DM};font-size:14px;font-weight:600;color:#fff;margin:0 0 16px">${esc(c.v.cta)}</p>`
        : "";
      return `<div role="tabpanel" id="dr-panel-${c.key}" aria-labelledby="dr-tab-${c.key}" tabindex="0" data-dr-panel="${c.key}"${hidden}>
        <p style="font-family:${DM};font-size:15px;line-height:1.7;color:#e5e7eb;white-space:pre-wrap;margin:0 0 16px">${esc(c.v.copy)}</p>
        ${hashtags}
        ${cta}
        <button type="button" data-dr-copy="${c.key}" style="font-family:${SORA};display:inline-flex;align-items:center;gap:6px;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;background:rgba(124,131,255,.15);color:${INDIGO};border:1px solid rgba(124,131,255,.35)">Copy</button>
      </div>`;
    })
    .join("");

  const payload = channels.reduce<Record<string, string>>((acc, c) => {
    acc[c.key] = [c.v.copy, c.v.hashtags.join(" "), c.v.cta].filter((s) => s && s.trim()).join("\n\n");
    return acc;
  }, {});

  return `<section aria-label="Ready-to-share social posts" style="margin-top:48px;border-radius:16px;padding:24px;background:${NAVY};border:1px solid rgba(255,255,255,.08)">
      <h2 style="font-family:${SORA};font-size:20px;font-weight:700;color:#fff;margin:0 0 4px">Share this insight</h2>
      <p style="font-family:${DM};font-size:14px;color:#9ca3af;margin:0 0 20px">Copy a ready-to-post version for your channel.</p>
      <div role="tablist" aria-label="Social platform" style="display:flex;gap:8px;margin-bottom:20px">${tabs}</div>
      ${panels}
    </section>
    <script>(function(){
      var text=${JSON.stringify(payload).replace(/</g, "\\u003c")};
      var root=document.currentScript.previousElementSibling;
      if(!root||!root.querySelector)return;
      var tabs=[].slice.call(root.querySelectorAll('[data-dr-tab]'));
      var panels=[].slice.call(root.querySelectorAll('[data-dr-panel]'));
      var NAVY='${NAVY}',INDIGO='${INDIGO}';
      function activate(key){
        tabs.forEach(function(t){
          var on=t.getAttribute('data-dr-tab')===key;
          t.setAttribute('aria-selected',on?'true':'false');
          t.tabIndex=on?0:-1;
          t.style.background=on?INDIGO:'rgba(255,255,255,.05)';
          t.style.color=on?NAVY:'#9ca3af';
          t.style.border=on?'1px solid '+INDIGO:'1px solid rgba(255,255,255,.1)';
        });
        panels.forEach(function(p){ p.hidden=p.getAttribute('data-dr-panel')!==key; });
      }
      tabs.forEach(function(t,i){
        t.addEventListener('click',function(){ activate(t.getAttribute('data-dr-tab')); });
        t.addEventListener('keydown',function(e){
          var n=i;
          if(e.key==='ArrowRight'||e.key==='ArrowDown')n=(i+1)%tabs.length;
          else if(e.key==='ArrowLeft'||e.key==='ArrowUp')n=(i-1+tabs.length)%tabs.length;
          else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;
          e.preventDefault();activate(tabs[n].getAttribute('data-dr-tab'));tabs[n].focus();
        });
      });
      root.querySelectorAll('[data-dr-copy]').forEach(function(b){
        b.addEventListener('click',function(){
          var k=b.getAttribute('data-dr-copy');
          if(navigator.clipboard){navigator.clipboard.writeText(text[k]||'').then(function(){
            var o=b.textContent;b.textContent='Copied \u2713';setTimeout(function(){b.textContent=o;},1500);
          }).catch(function(){});}
        });
      });
    })();</script>`;
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
  featuredImageUrl?: string | null;
  directResponse?: PublicDirectResponse | null;
}): string {
  const canonical = `${SITE_URL}/blog/${opts.slug}`;
  const displayTitle = opts.title.includes("| Job Genie") ? opts.title : `${opts.title} | Job Genie`;

  const articleSchema = jsonLdStr({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${canonical}#article`,
    headline: opts.title.replace(" | Job Genie", ""),
    description: opts.description,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    image: opts.featuredImageUrl ?? OG_IMAGE,
    datePublished: opts.publishedAt ?? undefined,
    dateModified: opts.publishedAt ?? undefined,
    author: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME },
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en-GB",
    about: opts.painPointTags.map((t) => ({ "@type": "Thing", name: t.replace(/_/g, " ") })),
  });

  const breadcrumbSchema = jsonLdStr({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: opts.title.replace(" | Job Genie", ""), item: canonical },
    ],
  });

  // Use the full answerFirstBlock for AEO citability — richer than the truncated description.
  const questionSchema = jsonLdStr({
    "@context": "https://schema.org",
    "@type": "Question",
    name: opts.normalisedQuestion,
    acceptedAnswer: { "@type": "Answer", text: opts.answerFirstBlock || opts.description },
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
  <meta property="og:image" content="${opts.featuredImageUrl ?? OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(displayTitle)}" />
  <meta name="twitter:description" content="${esc(opts.description)}" />
  <meta name="twitter:image" content="${opts.featuredImageUrl ?? OG_IMAGE}" />
  <script type="application/ld+json">${articleSchema}</script>
  <script type="application/ld+json">${breadcrumbSchema}</script>
  <script type="application/ld+json">${questionSchema}</script>
  ${opts.faqJsonLd ? `<script type="application/ld+json">${jsonLdStr(opts.faqJsonLd)}</script>` : ""}
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  ${spaScripts}
  <style>
    .blog-article-content :is(h1, h2, h3, h4, h5, h6) { margin: 2rem 0 1rem; }
    .blog-article-content :is(p, ul, ol) { margin: 0 0 1.5rem; }
  </style>
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
      <div class="blog-article-content" style="font-size:15px;color:#d1d5db;line-height:1.8">
        ${opts.contentHtml}
      </div>
      ${buildDirectResponseHtml(opts.directResponse ?? null)}
    </article>
  </div>
  <script>window.__BLOG_POST_DATA__=${opts.postDataJson};</script>
</body>
</html>`;
}

/** Build a static HTML page for the /blog listing with crawler-visible article list. */
async function buildBlogIndexHtml(posts: Array<{ slug: string; title: string; description: string; publishedAt: string | null }>): Promise<string> {
  const canonical = `${SITE_URL}/blog`;
  const title = "Job Search Advice & Career Insights | Job Genie Blog";
  const description =
    "Expert answers to real job-seeker questions — from Application Silence and ATS myths to hidden job market strategies and recruiter shortlisting.";
  const spaScripts = extractSpaScripts();

  const articleListHtml = posts.length > 0
    ? posts.map((p) => {
        const dateStr = p.publishedAt
          ? new Date(p.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
          : null;
        return `<li style="margin-bottom:24px;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:24px">
          ${dateStr ? `<time style="font-size:12px;color:#6b7280">${esc(dateStr)}</time>` : ""}
          <h2 style="font-size:18px;font-weight:600;color:#fff;margin:6px 0 8px;line-height:1.3">
            <a href="/blog/${esc(p.slug)}" style="color:#fff;text-decoration:none">${esc(p.title.replace(" | Job Genie", ""))}</a>
          </h2>
          ${p.description ? `<p style="font-size:14px;color:#9ca3af;line-height:1.6;margin:0">${esc(p.description)}</p>` : ""}
        </li>`;
      }).join("\n")
    : "<li style='color:#9ca3af'>No posts published yet — check back soon.</li>";

  const collectionSchema = jsonLdStr({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: title,
    description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  });

  return `<!DOCTYPE html>
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
        <a href="/" style="font-size:20px;font-weight:700;color:#fff;text-decoration:none">Job Genie</a>
      </header>
      <main style="max-width:960px;margin:0 auto;padding:64px 24px">
        <p style="font-size:12px;color:#2dd4bf;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 12px">Job Search Intelligence</p>
        <h1 style="font-size:40px;font-weight:700;color:#fff;line-height:1.2;margin:0 0 16px">Real answers to real<br />job-search questions</h1>
        <p style="font-size:18px;color:#9ca3af;margin:0 0 48px;max-width:640px;line-height:1.6">
          Every article is generated from real questions posted to Reddit's job-search communities, answered through Job Genie's AEO framework.
        </p>
        <ul style="list-style:none;padding:0;margin:0">
          ${articleListHtml}
        </ul>
      </main>
    </div>
  </div>
</body>
</html>`;
}

// Serve SEO-optimised HTML for the /blog listing page so crawlers see
// route-specific metadata and the article list instead of the generic SPA shell.
router.get("/", async (_req, res) => {
  try {
    const rows = await listPublishedBlogPosts(50, 0);
    const posts = rows.map(({ asset, question }) => {
      const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
      return {
        slug: String(asset.externalId ?? ""),
        title: String(meta["seoTitle"] ?? question.normalisedQuestion),
        description: String(meta["metaDescription"] ?? ""),
        publishedAt: (asset.scheduledFor ?? asset.publishedAt)?.toISOString() ?? null,
      };
    }).filter((p) => p.slug);

    const html = await buildBlogIndexHtml(posts);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.send(html);
  } catch (err) {
    logger.error({ err }, "blog-html: error serving blog index HTML");
    const indexPath = path.join(JOB_GENIE_DIST, "index.html");
    if (fs.existsSync(indexPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(indexPath);
    } else {
      res.redirect("/");
    }
  }
});

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
    const directResponse = await getPublicDirectResponseForAnswer(answer.id);

    const seoTitle = String(meta["seoTitle"] ?? question.normalisedQuestion);
    const metaDescription = String(meta["metaDescription"] ?? "");
    const readTimeMinutes = (meta["readTimeMinutes"] as number | null) ?? null;
    const faqJsonLd = (meta["faqJsonLd"] as Record<string, unknown> | null) ?? null;
    const featuredImageUrl = (meta["featuredImageUrl"] as string | undefined) ?? null;
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
        featuredImageUrl,
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
      directResponse,
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
      featuredImageUrl,
      postDataJson: JSON.stringify(postData).replace(/</g, "\\u003c"),
      directResponse,
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
