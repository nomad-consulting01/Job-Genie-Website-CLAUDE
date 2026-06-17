#!/usr/bin/env node
/**
 * Job Genie SEO/AEO Audit Script
 * Usage:  pnpm run seo:audit
 *
 * Crawls the prerendered HTML files in dist/public/ (produced by
 * `pnpm --filter @workspace/job-genie build`) and validates every page against
 * AEO/GEO compliance requirements.
 *
 * Exit code 0 — all checks PASS (or only WARN)
 * Exit code 1 — one or more FAIL
 *
 * If dist/public/ is absent, run the build first:
 *   pnpm --filter @workspace/job-genie build
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, resolve, relative, extname } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const JOB_GENIE = join(ROOT, "artifacts/job-genie");
const DIST = join(JOB_GENIE, "dist/public");
const PUBLIC = join(JOB_GENIE, "public");
const SITEMAP = join(PUBLIC, "sitemap.xml");
const SITE_URL = "https://job-genie.ai";

// ── Colours ──────────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  grey:   "\x1b[90m",
};

// ── Result store ─────────────────────────────────────────────────────────────
const results = [];

function pass(check, file, detail = "") { results.push({ status: "PASS", check, file, detail }); }
function fail(check, file, detail = "") { results.push({ status: "FAIL", check, file, detail }); }
function warn(check, file, detail = "") { results.push({ status: "WARN", check, file, detail }); }

function rel(p) { return relative(ROOT, p); }

function read(p) {
  try { return readFileSync(p, "utf8"); } catch { return null; }
}

// ── Line number helper ────────────────────────────────────────────────────────
/**
 * Given file content and a character index, return the 1-based line number.
 * Used to emit "Line N" info in FAIL/WARN messages.
 */
function lineOf(content, charIndex) {
  return content.slice(0, charIndex).split("\n").length;
}

/**
 * Build a label string: "file:line" for use in detail messages.
 */
function loc(filePath, content, charIndex) {
  return `${rel(filePath)}:${lineOf(content, charIndex)}`;
}

// ── Sitemap parser ────────────────────────────────────────────────────────────
function parseSitemapPaths(sitemapContent) {
  const paths = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(sitemapContent)) !== null) {
    const url = m[1].trim();
    const p = url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) || "/" : url;
    paths.push(p || "/");
  }
  return paths;
}

// ── dist/ HTML discovery ──────────────────────────────────────────────────────
function findRenderedPages(dir, baseDir = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findRenderedPages(full, baseDir, out);
    } else if (entry === "index.html") {
      const routePath =
        full === join(baseDir, "index.html")
          ? "/"
          : "/" + relative(baseDir, full).replace(/\/index\.html$/, "");
      out.push({ filePath: full, routePath });
    }
  }
  return out;
}

// ── HTML text extraction ──────────────────────────────────────────────────────
/**
 * Extract text content from a specific CSS class section in HTML.
 * Returns { text, startIndex } for citation checks.
 */
function extractSection(html, className) {
  const classPattern = new RegExp(`class="${className}[^"]*"`, "g");
  const sections = [];
  let m;
  while ((m = classPattern.exec(html)) !== null) {
    // Find the opening tag
    const tagStart = html.lastIndexOf("<", m.index);
    if (tagStart === -1) continue;
    // Extract up to ~3000 chars of content
    const snippet = html.slice(tagStart, tagStart + 3000);
    // Strip tags to get plain text
    const text = snippet.replace(/<script[\s\S]*?<\/script>/gi, "")
                        .replace(/<style[\s\S]*?<\/style>/gi, "")
                        .replace(/<[^>]+>/g, " ")
                        .replace(/\s+/g, " ")
                        .trim();
    sections.push({ text, startIndex: m.index });
  }
  return sections;
}

/**
 * Extract all FAQ answer text from FAQPage JSON-LD schema.
 * Returns array of { text, startIndex }.
 */
function extractFaqAnswerText(html) {
  const faqBlocks = [];
  const ldRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let ldMatch;
  while ((ldMatch = ldRe.exec(html)) !== null) {
    let schema;
    try { schema = JSON.parse(ldMatch[1].trim()); } catch { continue; }
    if (schema["@type"] !== "FAQPage" || !Array.isArray(schema.mainEntity)) continue;
    for (const q of schema.mainEntity) {
      const answer = q?.acceptedAnswer?.text ?? "";
      if (answer) faqBlocks.push({ text: answer, startIndex: ldMatch.index });
    }
  }
  return faqBlocks;
}

// ── Banned-stat detection ─────────────────────────────────────────────────────
/**
 * Banned claims:
 *   1. "70–80%" / "70-80%" — the unsourced hidden-job-market inflation
 *   2. Standalone "80%" used in the hidden-job-market context:
 *      i.e. "80%" within 300 chars of hidden-job-market language
 *
 * Exception: allowed only inside the specific FAQ #13 debunking answer,
 * identified by the presence of explicit debunk phrases within ±400 chars.
 *
 * Reports file + line number for every violation.
 */
function checkBannedStat(html, filePath) {
  const label = rel(filePath);

  // Debunk phrases that make the context safe
  const DEBUNK_PHRASES = [
    "not credibly",
    "unsupported inflation",
    "essentially a myth",
    "that specific figure",
    "is it true that 70",
    "claim that 70",
    "unsupported",
    "the myth",
    "never been supported",
    "false claim",
  ];

  // Hidden job market language — triggers standalone "80%" check
  const HIDDEN_JOB_PHRASES = [
    "jobs are hidden",
    "hidden job market",
    "best roles",
    "filled.*board",
    "never.*posted",
    "unadvertised",
  ];

  function isDebunk(ctx) {
    const lower = ctx.toLowerCase();
    return DEBUNK_PHRASES.some((p) => lower.includes(p));
  }

  function isHiddenJobContext(ctx) {
    const lower = ctx.toLowerCase();
    return HIDDEN_JOB_PHRASES.some((p) => {
      if (p.includes(".*")) return new RegExp(p, "i").test(lower);
      return lower.includes(p);
    });
  }

  let anyFail = false;

  // Check 1: 70–80% / 70-80%
  const p1 = /70[–\-]80%/g;
  let m;
  while ((m = p1.exec(html)) !== null) {
    const ctx = html.slice(Math.max(0, m.index - 400), m.index + 400);
    if (!isDebunk(ctx)) {
      const line = lineOf(html, m.index);
      fail(
        "No banned 70–80% fact-claim",
        label,
        `Line ${line}: found outside debunk context — "${ctx.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,100)}"`
      );
      anyFail = true;
    }
    p1.lastIndex = m.index + 1;
  }

  // Check 2: standalone "80%" in hidden-job-market context
  const p2 = /\b80%/g;
  while ((m = p2.exec(html)) !== null) {
    const ctx = html.slice(Math.max(0, m.index - 300), m.index + 300);
    if (isHiddenJobContext(ctx) && !isDebunk(ctx)) {
      const line = lineOf(html, m.index);
      fail(
        "No banned 80% hidden-job-market fact-claim",
        label,
        `Line ${line}: "80%" in hidden-job-market context outside debunk answer — "${ctx.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,100)}"`
      );
      anyFail = true;
    }
    p2.lastIndex = m.index + 1;
  }

  if (!anyFail) {
    pass("No banned stat claims (70–80% / 80% hidden-job-market)", label);
  }
}

// ── Stat citation check ───────────────────────────────────────────────────────
/**
 * Checks that quantified stats (X%) in prose content areas have an inline
 * source citation (parenthetical "Source Name" within 200 chars).
 *
 * Applied to: direct-answer section, llm-summary section, FAQ answers.
 * These are the authoritative prose areas crawled by AI and search engines.
 *
 * Citation pattern: "(Source Name)" — parenthetical with capitalized source.
 * e.g. "(SHRM)", "(Resume Builder)", "(ResumeUp.AI)", "(Lever)", "(MyPerfectResume)"
 *
 * Emits WARN (not FAIL) — citation gaps are important but not build-blockers.
 */
function checkStatCitations(html, filePath) {
  const label = rel(filePath);

  // Citation pattern: parenthetical with a capitalized identifier
  const CITATION_RE = /\([A-Z][A-Za-z0-9\s\.\-]{2,40}\)/;

  // Stat pattern: specific numeric percentage (skip round multiples of 10 if
  // they appear as UI labels, require >10 to skip obvious CSS/ratio values)
  const STAT_RE = /(\d+[\.\d]*)%/g;

  // Collect prose sections to check
  const directAnswerSections = extractSection(html, "direct-answer");
  const llmSummarySections   = extractSection(html, "llm-summary");
  const faqAnswers            = extractFaqAnswerText(html);

  const sections = [
    ...directAnswerSections.map(s => ({ ...s, area: "direct-answer" })),
    ...llmSummarySections.map(s => ({ ...s, area: "llm-summary" })),
    ...faqAnswers.map(s => ({ ...s, area: "faq-answer" })),
  ];

  if (sections.length === 0) return;

  const violations = [];

  for (const { text, startIndex, area } of sections) {
    let sm;
    STAT_RE.lastIndex = 0;
    while ((sm = STAT_RE.exec(text)) !== null) {
      const statValue = parseFloat(sm[1]);
      // Skip obviously non-research values: 100% (complete), 0%, CSS-like decimals
      if (statValue === 100 || statValue === 0 || statValue < 15) continue;
      // Check ±200 chars around the stat for a citation
      const window = text.slice(Math.max(0, sm.index - 50), sm.index + 200);
      if (!CITATION_RE.test(window)) {
        const line = lineOf(html, startIndex);
        const snippet = text.slice(Math.max(0, sm.index - 30), sm.index + 80).trim();
        violations.push({ stat: sm[0], area, line, snippet });
      }
    }
  }

  if (violations.length === 0) {
    pass("Prose stats have inline citations (direct-answer, llm-summary, FAQ)", label);
  } else {
    for (const v of violations) {
      warn(
        `Stat needs inline citation [${v.area}]`,
        label,
        `Line ~${v.line}: "${v.stat}" — add "(Source Name)" nearby. Context: "${v.snippet.slice(0,100)}"`
      );
    }
  }
}

// ── Per-page HTML auditor ─────────────────────────────────────────────────────
function auditPage(html, routePath, filePath, knownRoutes) {
  const label = `${rel(filePath)} (${routePath})`;
  const file = filePath;

  // 1. <title>
  const titleM = html.match(/<title>[^<]+<\/title>/);
  if (titleM) {
    pass("Has <title>", label);
  } else {
    fail("Has <title>", label, `Line ${lineOf(html, 0)}: <title> tag missing or empty`);
  }

  // 2. meta description
  const metaDescM = html.match(/<meta[^>]*name="description"[^>]*content="[^"]+"[^>]*>/);
  if (metaDescM) {
    pass("Has meta description", label);
  } else {
    fail("Has meta description", label, "meta[name=description] missing or has empty content");
  }

  // 3. canonical link
  const canonM = html.match(/<link[^>]*rel="canonical"[^>]*>/);
  if (canonM) {
    pass("Has canonical link", label);
  } else {
    fail("Has canonical link", label, "link[rel=canonical] missing");
  }

  // 4. H1 count — must be exactly 1
  const h1Matches = [...html.matchAll(/<h1[\s>]/g)];
  if (h1Matches.length === 1) {
    pass("Exactly one H1", label);
  } else if (h1Matches.length === 0) {
    fail("Exactly one H1", label, "No H1 found in page");
  } else {
    const lines = h1Matches.map(m => lineOf(html, m.index)).join(", ");
    fail("Exactly one H1", label, `${h1Matches.length} H1 tags at lines ${lines} — must be exactly 1`);
  }

  // 5. JSON-LD — all blocks must be valid JSON
  const ldBlocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  if (ldBlocks.length === 0) {
    fail("Has JSON-LD schema", label, "No application/ld+json blocks found");
  } else {
    let allValid = true;
    ldBlocks.forEach((m, i) => {
      try {
        JSON.parse(m[1].trim());
      } catch (e) {
        const line = lineOf(html, m.index);
        fail(`JSON-LD block ${i + 1} is valid JSON`, label, `Line ${line}: ${String(e).slice(0, 120)}`);
        allValid = false;
      }
    });
    if (allValid) pass(`Has ${ldBlocks.length} valid JSON-LD block(s)`, label);
  }

  // 6. direct-answer section
  const daMatch = html.match(/class="direct-answer/);
  if (daMatch) {
    pass('Has <section class="direct-answer">', label);
  } else {
    fail(
      'Has <section class="direct-answer">',
      label,
      'Missing required AEO direct-answer block — add <section className="direct-answer">'
    );
  }

  // 7. llm-summary section
  const lsMatch = html.match(/class="llm-summary/);
  if (lsMatch) {
    pass('Has <section class="llm-summary">', label);
  } else {
    fail(
      'Has <section class="llm-summary">',
      label,
      'Missing llm-summary block — add <section className="llm-summary">'
    );
  }

  // 8. FAQ block — FAQPage schema or visible FAQ markup
  if (/"@type"\s*:\s*"FAQPage"|data-testid="faq|aria-label="FAQ|id="faq/.test(html)) {
    pass("Has FAQ block", label);
  } else {
    fail("Has FAQ block", label, "No FAQPage schema or FAQ section found");
  }

  // 9. Images missing alt text
  const imgNoAlt = [...html.matchAll(/<img(?![^>]*\balt=)[^>]*>/g)];
  if (imgNoAlt.length === 0) {
    pass("All images have alt text", label);
  } else {
    for (const m of imgNoAlt) {
      fail(
        "Image missing alt text",
        label,
        `Line ${lineOf(html, m.index)}: ${m[0].slice(0, 80)}`
      );
    }
  }

  // 10. Internal link integrity
  const internalHrefs = [...html.matchAll(/href="(\/[^"#?][^"]*|\/)"[^>]*>/g)];
  const uniquePaths = new Map();
  for (const m of internalHrefs) {
    let p = m[1].split("?")[0].split("#")[0];
    p = p === "/" ? "/" : p.replace(/\/$/, "");
    if (!uniquePaths.has(p)) uniquePaths.set(p, m.index);
  }
  for (const [href, charIndex] of uniquePaths) {
    if (href.startsWith("/qa/"))     continue; // dynamic corpus routes
    if (href.startsWith("/admin"))   continue; // admin routes
    if (extname(href))               continue; // asset files
    if (knownRoutes.has(href)) {
      pass(`Internal link valid: ${href}`, label);
    } else {
      fail(
        `Broken internal link: ${href}`,
        label,
        `Line ${lineOf(html, charIndex)}: href="${href}" not found in sitemap`
      );
    }
  }

  // 11. Banned stat
  checkBannedStat(html, file);

  // 12. Stat citations in prose sections
  checkStatCitations(html, file);
}

// ── Global checks ─────────────────────────────────────────────────────────────

function auditSitemap(sitemapContent) {
  const requiredPaths = [
    "/",
    "/why-no-responses-after-100-applications",
    "/ghost-jobs",
    "/glossary",
    "/for/mid-career-professionals",
    "/for/senior-engineers",
    "/for/career-changers",
    "/job-genie-vs-auto-apply",
  ];
  for (const p of requiredPaths) {
    if (sitemapContent.includes(`${SITE_URL}${p === "/" ? "/" : p}<`)) {
      pass(`sitemap.xml contains: ${p}`, rel(SITEMAP));
    } else {
      fail(`sitemap.xml contains: ${p}`, rel(SITEMAP), `URL "${SITE_URL}${p}" missing from sitemap`);
    }
  }
}

function auditDistCoverage(sitemapPaths, renderedRoutes) {
  const renderedSet = new Set(renderedRoutes.map((r) => r.routePath));
  for (const p of sitemapPaths) {
    if (renderedSet.has(p)) {
      pass(`dist/public has prerendered HTML for: ${p}`, rel(DIST));
    } else {
      fail(
        `dist/public has prerendered HTML for: ${p}`,
        rel(DIST),
        `No dist/public${p}/index.html found — run: pnpm --filter @workspace/job-genie build`
      );
    }
  }
}

function auditLlmsTxt() {
  const file = join(PUBLIC, "llms.txt");
  const content = read(file);
  if (!content) { fail("llms.txt exists", rel(file)); return; }
  pass("llms.txt exists", rel(file));

  if (/Job Genie/i.test(content)) {
    pass("llms.txt mentions Job Genie entity", rel(file));
  } else {
    fail("llms.txt mentions Job Genie entity", rel(file));
  }

  const guardrailM = content.match(/70.80%|does not claim|guardrail/i);
  if (guardrailM) {
    pass("llms.txt has banned-claim guardrail note", rel(file));
  } else {
    fail(
      "llms.txt has banned-claim guardrail note",
      rel(file),
      "Add a line explaining Job Genie does not use the unsupported 70–80% claim"
    );
  }
}

function auditRobotsTxt() {
  const file = join(PUBLIC, "robots.txt");
  const content = read(file);
  if (!content) { fail("robots.txt exists", rel(file)); return; }
  pass("robots.txt exists", rel(file));

  if (/Sitemap:/i.test(content)) {
    pass("robots.txt references sitemap", rel(file));
  } else {
    warn("robots.txt references sitemap", rel(file), "Sitemap: directive missing");
  }
}

async function auditTypeScript() {
  const { execSync } = await import("child_process");
  try {
    execSync("pnpm --filter @workspace/job-genie exec tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
    pass("TypeScript: job-genie compiles without errors", "artifacts/job-genie");
  } catch (e) {
    const stderr = ((e.stderr ?? e.stdout ?? "").toString()).slice(0, 400);
    fail("TypeScript: job-genie compiles without errors", "artifacts/job-genie", stderr);
  }
}

// ── Print results ─────────────────────────────────────────────────────────────
function printResults() {
  const passes = results.filter((r) => r.status === "PASS");
  const warns  = results.filter((r) => r.status === "WARN");
  const fails  = results.filter((r) => r.status === "FAIL");

  console.log(`\n${C.bold}Job Genie SEO/AEO Audit${C.reset}`);
  console.log(`${C.grey}${"─".repeat(72)}${C.reset}\n`);

  for (const r of results) {
    let icon, colour;
    if (r.status === "PASS")      { icon = "✓"; colour = C.green; }
    else if (r.status === "WARN") { icon = "⚠"; colour = C.yellow; }
    else                          { icon = "✗"; colour = C.red; }

    const label = `${colour}${C.bold}${r.status}${C.reset}`;
    const check = `${C.bold}${r.check}${C.reset}`;
    console.log(`  ${colour}${icon}${C.reset} ${label}  ${check}`);
    if (r.file) console.log(`     ${C.grey}${r.file}${C.reset}`);
    if (r.detail) console.log(`     ${C.cyan}→ ${r.detail}${C.reset}`);
  }

  console.log(`\n${C.grey}${"─".repeat(72)}${C.reset}`);
  console.log(
    `${C.bold}Summary:${C.reset}  ` +
    `${C.green}${passes.length} PASS${C.reset}  ` +
    `${C.yellow}${warns.length} WARN${C.reset}  ` +
    `${C.red}${fails.length} FAIL${C.reset}\n`
  );

  if (fails.length === 0) {
    console.log(`${C.green}${C.bold}✓ Audit passed${C.reset}\n`);
  } else {
    console.log(`${C.red}${C.bold}✗ Audit failed — ${fails.length} issue(s) must be fixed${C.reset}\n`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${C.grey}Scanning: ${ROOT}${C.reset}`);

  // Parse sitemap
  const sitemapContent = read(SITEMAP);
  if (!sitemapContent) {
    fail("sitemap.xml exists", rel(SITEMAP), "File not found — create it at artifacts/job-genie/public/sitemap.xml");
    printResults();
    process.exit(1);
  }
  const sitemapPaths = parseSitemapPaths(sitemapContent);
  pass(`sitemap.xml parsed (${sitemapPaths.length} URLs)`, rel(SITEMAP));
  auditSitemap(sitemapContent);

  // Build known-routes set
  const knownRoutes = new Set([
    ...sitemapPaths,
    "/admin", "/admin/corpus", "/qa",
  ]);

  // Discover dist/public/ HTML pages
  if (!existsSync(DIST)) {
    fail(
      "dist/public/ exists",
      rel(DIST),
      "Prerendered HTML not found. Run: pnpm --filter @workspace/job-genie build"
    );
    auditLlmsTxt();
    auditRobotsTxt();
    await auditTypeScript();
    printResults();
    process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
    return;
  }

  const renderedPages = findRenderedPages(DIST);
  if (renderedPages.length === 0) {
    fail("dist/public/ contains HTML pages", rel(DIST), "No index.html files found");
  } else {
    pass(`dist/public/ has ${renderedPages.length} prerendered page(s)`, rel(DIST));
  }

  auditDistCoverage(sitemapPaths, renderedPages);

  // Per-page audits
  for (const { filePath, routePath } of renderedPages) {
    const html = read(filePath);
    if (!html) { fail("Can read HTML", rel(filePath), "File unreadable"); continue; }
    auditPage(html, routePath, filePath, knownRoutes);
  }

  // Static file checks
  auditLlmsTxt();
  auditRobotsTxt();

  // TypeScript
  await auditTypeScript();

  printResults();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Audit error: ${err.message}${C.reset}`);
  console.error(err.stack);
  process.exit(1);
});
