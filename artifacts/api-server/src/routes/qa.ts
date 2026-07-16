import { Router } from "express";
import { getContentAssetBySlug, listPublishedQAs } from "../corpus/db.js";
import { logger } from "../lib/logger.js";
import { SITE_URL } from "@workspace/site-config";

const router = Router();

function buildQAHtml(payload: {
  slug: string;
  title: string;
  answer_first_block: string;
  answer_md: string;
  pain_point_tags: string[];
}): string {
  const canonical = `${SITE_URL}/qa/${payload.slug}`;
  const ogDesc = payload.answer_first_block.slice(0, 160);

  const faqSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: payload.title,
        acceptedAnswer: {
          "@type": "Answer",
          text: payload.answer_first_block,
        },
      },
    ],
  });

  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Job Search FAQ", item: `${SITE_URL}/qa` },
      { "@type": "ListItem", position: 3, name: payload.title, item: canonical },
    ],
  });

  const mdHtml = payload.answer_md
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");

  const tags = payload.pain_point_tags
    .map((t) => `<span class="tag">${t.replace(/_/g, " ")}</span>`)
    .join(" ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(payload.title)} | Job Genie</title>
  <meta name="description" content="${escHtml(ogDesc)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escHtml(canonical)}" />
  <meta property="og:title" content="${escHtml(payload.title)} | Job Genie" />
  <meta property="og:description" content="${escHtml(ogDesc)}" />
  <meta property="og:url" content="${escHtml(canonical)}" />
  <meta property="og:site_name" content="Job Genie" />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(payload.title)} | Job Genie" />
  <meta name="twitter:description" content="${escHtml(ogDesc)}" />
  <script type="application/ld+json">${faqSchema}</script>
  <script type="application/ld+json">${breadcrumbSchema}</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a1a;color:#e8e8f0;line-height:1.7}
    .wrap{max-width:780px;margin:0 auto;padding:2rem 1.5rem 4rem}
    .back{display:inline-block;margin-bottom:2rem;color:#7c6dfa;text-decoration:none;font-size:.9rem}
    .back:hover{text-decoration:underline}
    h1{font-size:clamp(1.6rem,4vw,2.2rem);font-weight:700;line-height:1.25;margin-bottom:1.5rem;color:#fff}
    .answer-first{background:linear-gradient(135deg,rgba(124,109,250,.12),rgba(0,212,170,.08));border-left:4px solid #7c6dfa;border-radius:0 8px 8px 0;padding:1.25rem 1.5rem;margin-bottom:2rem;font-size:1.1rem;color:#d0cfe8;font-style:italic}
    .body{color:#c0bfd8}
    .body h2{font-size:1.2rem;font-weight:600;color:#e8e8f0;margin:2rem 0 .75rem}
    .body h3{font-size:1rem;font-weight:600;color:#d0cfe8;margin:1.5rem 0 .5rem}
    .body p{margin-bottom:1rem}
    .body strong{color:#fff}
    .tags{margin-top:2rem;display:flex;flex-wrap:wrap;gap:.5rem}
    .tag{background:rgba(124,109,250,.15);color:#9e91fb;border:1px solid rgba(124,109,250,.25);border-radius:20px;padding:.2rem .7rem;font-size:.8rem}
    .cta{margin-top:3rem;background:linear-gradient(135deg,#7c6dfa,#00d4aa);border-radius:12px;padding:2rem;text-align:center}
    .cta h2{color:#fff;margin-bottom:.75rem;font-size:1.3rem}
    .cta p{color:rgba(255,255,255,.8);margin-bottom:1.25rem;font-size:.95rem}
    .cta a{display:inline-block;background:#fff;color:#0a0a1a;font-weight:700;padding:.85rem 2rem;border-radius:8px;text-decoration:none;font-size:1rem}
    .cta a:hover{opacity:.9}
    header{border-bottom:1px solid rgba(255,255,255,.08);padding:1rem 1.5rem;margin-bottom:1.5rem}
    .logo{font-weight:700;font-size:1.2rem;color:#fff;text-decoration:none}
    .logo span{color:#7c6dfa}
  </style>
</head>
<body>
  <header>
    <a class="logo" href="${SITE_URL}">Job <span>Genie</span></a>
  </header>
  <div class="wrap">
    <a class="back" href="${SITE_URL}">← Back to Job Genie</a>
    <h1>${escHtml(payload.title)}</h1>
    <div class="answer-first">${escHtml(payload.answer_first_block)}</div>
    <div class="body"><p>${mdHtml}</p></div>
    ${tags ? `<div class="tags">${tags}</div>` : ""}
    <div class="cta">
      <h2>Find out exactly what's blocking your interviews</h2>
      <p>Job Genie's free Application Autopsy diagnoses your Application Silence Score, ghost-job exposure, and Recruiter-Fit Gap in under 2 minutes.</p>
      <a href="https://modular-pipeline.replit.app/?upload=true">Get My Free Autopsy →</a>
    </div>
  </div>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

router.get("/", async (req, res) => {
  const accept = req.headers["accept"] ?? "";
  if (!accept.includes("text/html") && !accept.includes("*/*")) {
    res.status(406).json({ error: "Not acceptable" });
    return;
  }
  try {
    const items = await listPublishedQAs(100);
    const canonical = `${SITE_URL}/qa`;
    const title = "Job Search FAQ — Expert Answers | Job Genie";
    const description =
      "Structured Q&A answers to real job-seeker questions about Application Silence, ATS myths, the hidden job market, and recruiter shortlisting.";
    const listHtml = items.length > 0
      ? items.map((r) => {
          const p = r.asset.payloadJson as { slug?: string; title?: string; answer_first_block?: string } | null;
          const slug = p?.slug ?? "";
          const t = p?.title ?? r.question.normalisedQuestion;
          const blurb = p?.answer_first_block ?? "";
          if (!slug) return "";
          return `<li class="item">
              <h2><a href="/qa/${escHtml(slug)}">${escHtml(t)}</a></h2>
              ${blurb ? `<p>${escHtml(blurb.slice(0, 150))}…</p>` : ""}
            </li>`;
        }).filter(Boolean).join("\n")
      : "<li>No Q&A published yet.</li>";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escHtml(canonical)}" />
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  <meta property="og:url" content="${escHtml(canonical)}" />
  <meta property="og:site_name" content="Job Genie" />
  <meta property="og:type" content="website" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a1a;color:#e8e8f0;line-height:1.7}
    header{border-bottom:1px solid rgba(255,255,255,.08);padding:1rem 1.5rem;margin-bottom:1.5rem}
    .logo{font-weight:700;font-size:1.2rem;color:#fff;text-decoration:none}
    .logo span{color:#7c6dfa}
    main{max-width:780px;margin:0 auto;padding:2rem 1.5rem 4rem}
    h1{font-size:2rem;font-weight:700;color:#fff;margin-bottom:1rem}
    .desc{color:#9ca3af;margin-bottom:2rem}
    ul{list-style:none;padding:0}
    .item{margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(255,255,255,.06)}
    .item h2{font-size:1rem;font-weight:600;margin-bottom:.4rem}
    .item h2 a{color:#9e91fb;text-decoration:none}
    .item h2 a:hover{text-decoration:underline}
    .item p{font-size:.875rem;color:#9ca3af}
  </style>
</head>
<body>
  <header>
    <a class="logo" href="${SITE_URL}">Job <span>Genie</span></a>
  </header>
  <main>
    <h1>Job Search Q&amp;A</h1>
    <p class="desc">${escHtml(description)}</p>
    <ul>${listHtml}</ul>
  </main>
</body>
</html>`);
  } catch (err) {
    logger.error({ err }, "GET /qa failed");
    res.status(500).send("Internal server error");
  }
});

router.get("/list", async (_req, res) => {
  try {
    const items = await listPublishedQAs(100);
    res.json({
      items: items.map((r) => ({
        id: r.asset.id,
        slug: (r.asset.payloadJson as { slug?: string })?.slug ?? "",
        title: r.question.normalisedQuestion,
        answer_first_block: r.answer.answerFirstBlock,
        pain_point_tags: r.question.painPointTags,
        published_at: r.asset.publishedAt,
        quality_score: r.answer.qualityScore,
      })),
    });
  } catch (err) {
    logger.error({ err }, "GET /qa/list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const accept = req.headers["accept"] ?? "";
    const row = await getContentAssetBySlug(slug ?? "");
    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    const payload = row.asset.payloadJson as {
      slug: string;
      title: string;
      answer_first_block: string;
      answer_md: string;
      pain_point_tags: string[];
    };

    // Default to HTML unless the client explicitly requests JSON, or the
    // request came in via the /api/qa/* mount (programmatic API consumers).
    const wantsJson =
      accept.includes("application/json") || req.baseUrl.startsWith("/api/");

    if (!wantsJson) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(buildQAHtml(payload));
    } else {
      res.json({
        slug: payload.slug,
        title: payload.title,
        answer_first_block: payload.answer_first_block,
        answer_md: payload.answer_md,
        pain_point_tags: payload.pain_point_tags,
        published_at: row.asset.publishedAt,
        quality_score: row.answer.qualityScore,
      });
    }
  } catch (err) {
    logger.error({ err }, "GET /qa/:slug failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
