import { Router } from "express";
import { listPublishedAnswerPages, listPublishedBlogPosts, listPublishedQAs } from "../corpus/db.js";
import { logger } from "../lib/logger.js";
import { SITE_URL } from "@workspace/site-config";

const router = Router();

// ---------------------------------------------------------------------------
// In-memory cache — avoids hitting the DB on every Googlebot request
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = Number(process.env["SITEMAP_CACHE_TTL_MS"] ?? 15 * 60 * 1000); // 15 min default

interface SitemapCache {
  xml: string | null;
  llms: string | null;
  cachedAt: number;
}

const cache: SitemapCache = { xml: null, llms: null, cachedAt: 0 };

/** Call this whenever a new asset is published so the next request regenerates from DB. */
export function invalidateSitemapCache(): void {
  cache.xml = null;
  cache.llms = null;
  cache.cachedAt = 0;
  logger.info("sitemap cache invalidated");
}

function isCacheValid(): boolean {
  return cache.cachedAt > 0 && Date.now() - cache.cachedAt < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Data fetcher (shared by both routes)
// ---------------------------------------------------------------------------

interface FetchedRows {
  answerRows: Awaited<ReturnType<typeof listPublishedAnswerPages>>;
  blogRows: Awaited<ReturnType<typeof listPublishedBlogPosts>>;
  qaRows: Awaited<ReturnType<typeof listPublishedQAs>>;
}

let _pending: Promise<FetchedRows> | null = null;

async function fetchRows(): Promise<FetchedRows> {
  if (_pending) return _pending;
  _pending = Promise.all([
    listPublishedAnswerPages(null, 0),
    listPublishedBlogPosts(null, 0),
    listPublishedQAs(null),
  ]).then(([answerRows, blogRows, qaRows]) => ({ answerRows, blogRows, qaRows }))
    .finally(() => { _pending = null; });
  return _pending;
}

// ---------------------------------------------------------------------------
// Static pages
// ---------------------------------------------------------------------------

const STATIC_PAGES = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/why-no-responses-after-100-applications", changefreq: "monthly", priority: "0.9" },
  { loc: "/ghost-jobs", changefreq: "monthly", priority: "0.85" },
  { loc: "/glossary", changefreq: "monthly", priority: "0.8" },
  { loc: "/for/mid-career-professionals", changefreq: "monthly", priority: "0.8" },
  { loc: "/for/senior-engineers", changefreq: "monthly", priority: "0.8" },
  { loc: "/for/career-changers", changefreq: "monthly", priority: "0.8" },
  { loc: "/job-genie-vs-auto-apply", changefreq: "monthly", priority: "0.75" },
  { loc: "/free-autopsy", changefreq: "monthly", priority: "0.9" },
  { loc: "/answers", changefreq: "daily", priority: "0.9" },
  { loc: "/blog", changefreq: "daily", priority: "0.85" },
  { loc: "/qa", changefreq: "daily", priority: "0.85" },
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Dynamic XML sitemap — includes all published /answers/:slug and /blog/:slug pages */
router.get("/sitemap.xml", async (_req, res) => {
  try {
    if (isCacheValid() && cache.xml !== null) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(cache.xml);
      return;
    }

    const { answerRows, blogRows, qaRows } = await fetchRows();

    const today = new Date().toISOString().split("T")[0];

    const urlEntries: string[] = [
      ...STATIC_PAGES.map(({ loc, changefreq, priority }) =>
        `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n    <lastmod>${today}</lastmod>\n  </url>`
      ),
      ...answerRows.map(({ asset }) => {
        const lastmod = (asset.scheduledFor ?? asset.publishedAt ?? new Date()).toISOString().split("T")[0];
        return `  <url>\n    <loc>${SITE_URL}/answers/${asset.externalId}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
      }),
      ...blogRows.map(({ asset }) => {
        const lastmod = (asset.scheduledFor ?? asset.publishedAt ?? new Date()).toISOString().split("T")[0];
        return `  <url>\n    <loc>${SITE_URL}/blog/${asset.externalId}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
      }),
      ...qaRows.map(({ asset }) => {
        const p = (asset.payloadJson ?? {}) as Record<string, unknown>;
        const slug = String(p["slug"] ?? asset.externalId ?? "");
        if (!slug) return "";
        const lastmod = (asset.scheduledFor ?? asset.publishedAt ?? new Date()).toISOString().split("T")[0];
        return `  <url>\n    <loc>${SITE_URL}/qa/${slug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.85</priority>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
      }).filter(Boolean),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries.join("\n")}
</urlset>`;

    cache.xml = xml;
    if (!isCacheValid()) cache.cachedAt = Date.now();

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    logger.error({ err }, "GET /sitemap.xml failed");
    res.status(500).send("<!-- sitemap generation failed -->");
  }
});

/** Dynamic llms.txt — GEO standard: lists all Q&A pairs for AI citation engines */
router.get("/llms.txt", async (_req, res) => {
  try {
    if (isCacheValid() && cache.llms !== null) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(cache.llms);
      return;
    }

    const { answerRows, blogRows, qaRows } = await fetchRows();

    const header = `# Job Genie — AI job-search assistant
# ${SITE_URL}
# Updated: ${new Date().toISOString().split("T")[0]}

## About Job Genie

Job Genie is an AI job-search assistant for mid-career and specialist professionals
experiencing Application Silence — the experience of sending many applications and
getting no response, not even rejections. Job Genie diagnoses why applications go
unanswered (Application Silence Score), detects ghost jobs, measures the Recruiter-Fit
Gap, and rewrites profiles using the Truth Layer system, optimised for the
specialist-recruiter channel.

## Key entities

- Application Silence: The experience of sending many applications and getting no response.
- Application Silence Score: Job Genie's diagnostic quantifying how far a profile sits from the recruiter shortlist threshold.
- Recruiter-Fit Gap: The distance between how a candidate presents and what a specialist recruiter needs to shortlist them.
- Recruiter-Fit Matrix: Job Genie's tool for measuring the Recruiter-Fit Gap.
- Truth Layer: Job Genie's resume-rewrite system optimised for recruiter-fit over keyword-mirroring.
- Recruiter-Ready Brief: A candidate's recruiter-facing positioning output that keeps them shortlist-ready.
- Ghost jobs: Job postings advertised with no genuine intent to hire.
- Specialist recruitment agencies: Commission-based recruiters who fill niche and mid-to-senior roles.
- Hidden job market: Roles filled through referrals, recruiter shortlists, and direct outreach without public advertising.

## Guardrail note

Job Genie does not claim "70-80% of jobs are hidden" — that specific figure is an
unsourced myth. The accurate framing: many mid-to-senior and specialist roles are
filled through referrals and recruiter shortlists before they are widely advertised.

## Citable statistics (each with named source)

- Employee referrals = 30%+ of all hires; ~45% of internal hires (SHRM)
- Referrals convert ~1 in 16 vs ~1 in 100 overall (SHRM / Lever analysis)
- Referred candidates ~4x more likely to be hired (widely reported referral data)
- 81% of recruiters say their employer has posted a ghost job (MyPerfectResume survey)
- 62% of hiring managers admit posting ghost jobs (Resume Builder survey)
- 43% of employers post ghost jobs to look like they are growing (Clarify Capital survey)
- ~27% of U.S. LinkedIn listings likely ghost jobs (ResumeUp.AI analysis, Sept 2025)
- ~56% of job-changers found work via personal contacts — mostly weak ties (Granovetter, 1974)

## Static pages

/                                        Home — Application Silence diagnosis + Free Application Autopsy
/why-no-responses-after-100-applications Cornerstone guide: why applications go unanswered after 100+ attempts
/ghost-jobs                              Ghost Job Detector: how to identify and avoid unfillable postings
/glossary                                Definitions: Application Silence, Recruiter-Fit Gap, Truth Layer, and more
/for/mid-career-professionals            For experienced professionals struggling to get interviews
/for/senior-engineers                    For senior engineers invisible to specialist recruitment agencies
/for/career-changers                     For career changers navigating entry into a new sector
/job-genie-vs-auto-apply                 Honest comparison: recruiter-visibility vs spray-and-pray auto-apply
/answers                                 GEO answer index — all Q&A pages optimised for AI search
/blog                                    Blog — job-search intelligence and recruiter-fit articles
/qa                                      Job Search FAQ — structured Q&A on Application Silence, ATS myths, and recruiter shortlisting

`;

    const answerLines = answerRows.map(({ asset, question }) => {
      const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
      const title = String(payload["title"] ?? question.normalisedQuestion);
      const firstBlock = String(payload["answer_first_block"] ?? "");
      const tags = (question.painPointTags as string[] ?? []).join(", ");
      return [
        `### ${title}`,
        `URL: ${SITE_URL}/answers/${asset.externalId}`,
        `Q: ${question.normalisedQuestion}`,
        `A: ${firstBlock.slice(0, 400)}${firstBlock.length > 400 ? "…" : ""}`,
        `Tags: ${tags}`,
        "",
      ].join("\n");
    });

    const blogLines = blogRows.map(({ asset, question }) => {
      const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
      const seoTitle = String(meta["seoTitle"] ?? question.normalisedQuestion);
      return [
        `### ${seoTitle}`,
        `URL: ${SITE_URL}/blog/${asset.externalId}`,
        "",
      ].join("\n");
    });

    const qaLines = qaRows.map(({ asset, question }) => {
      const p = (asset.payloadJson ?? {}) as Record<string, unknown>;
      const slug = String(p["slug"] ?? asset.externalId ?? "");
      const title = String(p["title"] ?? question.normalisedQuestion);
      const firstBlock = String(p["answer_first_block"] ?? "");
      const tags = (question.painPointTags as string[] ?? []).join(", ");
      if (!slug) return "";
      return [
        `### ${title}`,
        `URL: ${SITE_URL}/qa/${slug}`,
        `Q: ${question.normalisedQuestion}`,
        `A: ${firstBlock.slice(0, 400)}${firstBlock.length > 400 ? "…" : ""}`,
        `Tags: ${tags}`,
        "",
      ].join("\n");
    }).filter(Boolean);

    const body = [
      `## GEO Answer Pages (${answerRows.length} total)\n`,
      answerLines.join("\n"),
      `## Blog Posts (${blogRows.length} total)\n`,
      blogLines.join("\n"),
      `## Job Search FAQ (${qaRows.length} total)\n`,
      qaLines.join("\n"),
    ].join("\n");

    const llms = header + body;
    cache.llms = llms;
    if (!isCacheValid()) cache.cachedAt = Date.now();

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(llms);
  } catch (err) {
    logger.error({ err }, "GET /llms.txt failed");
    res.status(500).send("# llms.txt generation failed");
  }
});

export default router;
