#!/usr/bin/env node
/**
 * Job Genie SEO/AEO Audit Script
 * Usage:  node scripts/seo_audit.mjs
 * Or:     pnpm run seo:audit
 *
 * Audits source files for AEO/GEO compliance:
 *  - HTML structural requirements (H1, title, meta, canonical)
 *  - AEO section requirements (direct-answer, llm-summary, FAQ)
 *  - JSON-LD validity
 *  - Banned stat claims
 *  - Stat citation compliance
 *  - Image alt-text
 *  - Internal link integrity
 *
 * Exits 1 if any FAIL, 0 if only PASS/WARN.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, resolve, relative } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const JOB_GENIE = join(ROOT, "artifacts/job-genie");
const SRC = join(JOB_GENIE, "src");
const PUBLIC = join(JOB_GENIE, "public");
const INDEX_HTML = join(JOB_GENIE, "index.html");

// ── Colours ──────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  grey: "\x1b[90m",
};

// ── Result store ─────────────────────────────────────────────────────────────
const results = [];

function pass(check, file, detail = "") {
  results.push({ status: "PASS", check, file, detail });
}
function fail(check, file, detail = "") {
  results.push({ status: "FAIL", check, file, detail });
}
function warn(check, file, detail = "") {
  results.push({ status: "WARN", check, file, detail });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rel(p) {
  return relative(ROOT, p);
}

function read(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function grepLine(content, pattern) {
  const lines = content.split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    if (pattern.test(line)) hits.push({ line: i + 1, text: line.trim() });
  });
  return hits;
}

function walkFiles(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkFiles(full, ext, out);
    } else if (entry.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

// ── Audit functions ───────────────────────────────────────────────────────────

/** 1. index.html: title, description, canonical, H1 (via JSON-LD) */
function auditIndexHtml() {
  const file = INDEX_HTML;
  const content = read(file);
  if (!content) {
    fail("index.html exists", rel(file), "File not found");
    return;
  }

  if (/<title>[^<]+<\/title>/.test(content)) {
    pass("index.html has <title>", rel(file));
  } else {
    fail("index.html has <title>", rel(file), "<title> tag missing or empty");
  }

  if (/meta name="description"/.test(content)) {
    pass("index.html has meta description", rel(file));
  } else {
    fail("index.html has meta description", rel(file), "meta[name=description] missing");
  }

  if (/rel="canonical"/.test(content)) {
    pass("index.html has canonical link", rel(file));
  } else {
    fail("index.html has canonical link", rel(file), "link[rel=canonical] missing");
  }

  if (/meta name="robots"/.test(content)) {
    pass("index.html has robots meta", rel(file));
  } else {
    warn("index.html has robots meta", rel(file), "meta[name=robots] missing — defaults to index");
  }

  // JSON-LD validity
  const ldBlocks = [...content.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (ldBlocks.length === 0) {
    fail("index.html has JSON-LD", rel(file), "No application/ld+json blocks found");
  } else {
    let allValid = true;
    ldBlocks.forEach((m, i) => {
      try {
        JSON.parse(m[1].trim());
      } catch (e) {
        fail(`JSON-LD block ${i + 1} is valid JSON`, rel(file), String(e).slice(0, 100));
        allValid = false;
      }
    });
    if (allValid) pass(`index.html has ${ldBlocks.length} valid JSON-LD block(s)`, rel(file));
  }

  // Image alt check in index.html (inline images)
  const imgNoAlt = [...content.matchAll(/<img(?![^>]*alt=)[^>]*>/g)];
  if (imgNoAlt.length > 0) {
    fail("index.html images have alt text", rel(file), `${imgNoAlt.length} <img> tag(s) missing alt`);
  } else {
    pass("index.html images have alt text", rel(file));
  }
}

/** 2. Home.tsx: direct-answer, llm-summary, FAQ, H1 */
function auditHomePage() {
  const file = join(SRC, "pages/Home.tsx");
  const content = read(file);
  if (!content) { fail("Home.tsx exists", rel(file)); return; }

  if (/className="direct-answer"/.test(content)) {
    pass('Home.tsx has <section className="direct-answer">', rel(file));
  } else {
    fail('Home.tsx has <section className="direct-answer">', rel(file),
      'Missing direct-answer section — AEO featured-snippet target required');
  }

  if (/className="llm-summary"/.test(content)) {
    pass('Home.tsx has <section className="llm-summary">', rel(file));
  } else {
    fail('Home.tsx has <section className="llm-summary">', rel(file),
      'Missing llm-summary section — required for GEO/AI-crawler indexing');
  }

  if (/FAQAccordion|faq|aria-label="FAQ|section.*faq/i.test(content)) {
    pass("Home.tsx has FAQ section", rel(file));
  } else {
    fail("Home.tsx has FAQ section", rel(file), "No FAQ block detected");
  }

  const h1Count = (content.match(/<h1[\s>]/g) ?? []).length;
  if (h1Count === 1) {
    pass("Home.tsx has exactly one H1", rel(file));
  } else if (h1Count === 0) {
    fail("Home.tsx has exactly one H1", rel(file), "No H1 found");
  } else {
    fail("Home.tsx has exactly one H1", rel(file), `${h1Count} H1 tags found — must be exactly 1`);
  }
}

/** 3. AEO pages: direct-answer, llm-summary, FAQ rendered in AEOPage.tsx */
function auditAEOPageTemplate() {
  const file = join(SRC, "pages/AEOPage.tsx");
  const content = read(file);
  if (!content) { fail("AEOPage.tsx exists", rel(file)); return; }

  if (/direct-answer|aria-label="Direct answer"/.test(content)) {
    pass("AEOPage.tsx renders direct-answer block", rel(file));
  } else {
    fail("AEOPage.tsx renders direct-answer block", rel(file));
  }

  if (/llm-summary|aria-label="Summary for AI systems"/.test(content)) {
    pass("AEOPage.tsx renders llm-summary block", rel(file));
  } else {
    fail("AEOPage.tsx renders llm-summary block", rel(file));
  }

  if (/faq|FAQ/.test(content)) {
    pass("AEOPage.tsx renders FAQ block", rel(file));
  } else {
    fail("AEOPage.tsx renders FAQ block", rel(file));
  }

  if (/application\/ld\+json|FAQPage|HowTo/.test(content)) {
    pass("AEOPage.tsx outputs JSON-LD schema", rel(file));
  } else {
    fail("AEOPage.tsx outputs JSON-LD schema", rel(file), "No JSON-LD schema output detected");
  }
}

/** 4. landing-pages.ts: all required AEO slugs have directAnswer field */
function auditLandingPagesData() {
  const file = join(SRC, "data/landing-pages.ts");
  const content = read(file);
  if (!content) { fail("landing-pages.ts exists", rel(file)); return; }

  const requiredSlugs = [
    "why-no-responses-after-100-applications",
    "ghost-jobs",
    "glossary",
    "for/mid-career-professionals",
    "for/senior-engineers",
    "for/career-changers",
    "job-genie-vs-auto-apply",
  ];

  for (const slug of requiredSlugs) {
    if (content.includes(`slug: "${slug}"`)) {
      pass(`landing-pages.ts has entry: ${slug}`, rel(file));
    } else {
      fail(`landing-pages.ts has entry: ${slug}`, rel(file), "Slug missing from data file");
    }
  }

  const directAnswerCount = (content.match(/directAnswer:/g) ?? []).length;
  if (directAnswerCount >= requiredSlugs.length) {
    pass(`landing-pages.ts: all pages have directAnswer (${directAnswerCount})`, rel(file));
  } else {
    fail(`landing-pages.ts: all pages have directAnswer`, rel(file),
      `Found ${directAnswerCount}, expected at least ${requiredSlugs.length}`);
  }

  const llmSummaryCount = (content.match(/llmSummary:/g) ?? []).length;
  if (llmSummaryCount >= requiredSlugs.length) {
    pass(`landing-pages.ts: all pages have llmSummary (${llmSummaryCount})`, rel(file));
  } else {
    fail(`landing-pages.ts: all pages have llmSummary`, rel(file),
      `Found ${llmSummaryCount}, expected at least ${requiredSlugs.length}`);
  }
}

/** 5. sitemap.xml exists and has the 8 required static URLs */
function auditSitemap() {
  const file = join(PUBLIC, "sitemap.xml");
  const content = read(file);
  if (!content) { fail("sitemap.xml exists", rel(file)); return; }

  const requiredUrls = [
    "https://job-genie.ai/",
    "https://job-genie.ai/why-no-responses-after-100-applications",
    "https://job-genie.ai/ghost-jobs",
    "https://job-genie.ai/glossary",
    "https://job-genie.ai/for/mid-career-professionals",
    "https://job-genie.ai/for/senior-engineers",
    "https://job-genie.ai/for/career-changers",
    "https://job-genie.ai/job-genie-vs-auto-apply",
  ];

  for (const url of requiredUrls) {
    if (content.includes(url)) {
      pass(`sitemap.xml contains: ${url.replace("https://job-genie.ai", "")}`, rel(file));
    } else {
      fail(`sitemap.xml contains: ${url}`, rel(file), "URL missing from sitemap");
    }
  }
}

/** 6. llms.txt exists and contains guardrail note */
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

  if (/70.80%|claim|guardrail|does not claim/i.test(content)) {
    pass("llms.txt contains banned-claim guardrail", rel(file));
  } else {
    warn("llms.txt contains banned-claim guardrail", rel(file),
      "No guardrail note found — GEO best practice requires explicit AI-facing guardrail");
  }
}

/** 7. robots.txt exists */
function auditRobotsTxt() {
  const file = join(PUBLIC, "robots.txt");
  const content = read(file);
  if (!content) {
    fail("robots.txt exists", rel(file));
    return;
  }
  pass("robots.txt exists", rel(file));

  if (/Sitemap:/i.test(content)) {
    pass("robots.txt references sitemap", rel(file));
  } else {
    warn("robots.txt references sitemap", rel(file), "Sitemap: directive missing");
  }
}

/** 8. SEO.tsx: no banned fact-claims, has FAQ schema */
function auditSEOComponent() {
  const file = join(SRC, "components/SEO.tsx");
  const content = read(file);
  if (!content) { fail("SEO.tsx exists", rel(file)); return; }

  const bannedHits = grepLine(content, /70[–-]80%(?!.*unsupported|.*myth|.*claim)/);
  if (bannedHits.length === 0) {
    pass("SEO.tsx: no banned 70-80% fact-claims", rel(file));
  } else {
    for (const h of bannedHits) {
      fail("SEO.tsx: no banned 70-80% fact-claims", rel(file),
        `Line ${h.line}: ${h.text.slice(0, 100)}`);
    }
  }

  if (/FAQPage|application\/ld\+json/.test(content)) {
    pass("SEO.tsx outputs structured data", rel(file));
  } else {
    warn("SEO.tsx outputs structured data", rel(file), "No JSON-LD found in SEO component");
  }
}

/** 9. Sitewide banned-claim scan: "70–80%" as fact, not debunk */
function auditBannedClaims() {
  const filesToScan = [
    ...walkFiles(SRC, ".tsx"),
    ...walkFiles(SRC, ".ts"),
    join(JOB_GENIE, "index.html"),
    join(PUBLIC, "sitemap.xml"),
    ...walkFiles(join(ROOT, "content"), ".json"),
  ];

  // Pattern: "70–80%" or "70-80%" NOT immediately followed by debunking language
  // Debunking context: "unsupported", "myth", "inflation", "does not claim", "claim that"
  const bannedPattern = /70[–\-]80%/g;
  const debunkContext = /unsupported|myth|inflation|does not claim|claim that|is an|not credibly/i;

  let totalFails = 0;
  let totalFiles = 0;

  for (const file of filesToScan) {
    const content = read(file);
    if (!content) continue;
    const lines = content.split("\n");
    let fileFails = 0;
    lines.forEach((line, i) => {
      if (bannedPattern.test(line)) {
        bannedPattern.lastIndex = 0;
        // Check surrounding context (line ± 2)
        const ctx = lines.slice(Math.max(0, i - 2), i + 3).join(" ");
        if (!debunkContext.test(ctx)) {
          fail("No banned 70-80% fact-claim", rel(file),
            `Line ${i + 1}: ${line.trim().slice(0, 120)}`);
          fileFails++;
          totalFails++;
        }
      }
      bannedPattern.lastIndex = 0;
    });
    if (fileFails === 0) totalFiles++;
  }

  if (totalFails === 0) {
    pass(`Banned claim scan: 0 violations in ${filesToScan.length} files`, "sitewide");
  }
}

/** 10. Sitewide stat citation check: % figure should have inline source */
function auditStatCitations() {
  // Patterns: a lone percentage stat without a parenthetical source e.g. "(SHRM)" or "(Source)"
  // Heuristic: number + "%" not followed by a parenthetical within 120 chars
  const statPattern = /\d+[\.\d]*%/g;
  const citationNearby = /\(([A-Z][^)]{2,50})\)/; // "(Source Name)"

  const filesToScan = [
    join(SRC, "pages/Home.tsx"),
    join(JOB_GENIE, "index.html"),
    join(SRC, "data/landing-pages.ts"),
    join(SRC, "components/SEO.tsx"),
  ];

  let warnCount = 0;

  for (const file of filesToScan) {
    const content = read(file);
    if (!content) continue;
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Skip comment lines and import/export lines
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import") || trimmed.startsWith("export")) return;
      // Skip lines that contain only type annotations or code
      if (trimmed.startsWith("const ") || trimmed.startsWith("let ") || trimmed.startsWith("target=")) return;

      let m;
      statPattern.lastIndex = 0;
      while ((m = statPattern.exec(line)) !== null) {
        const stat = m[0];
        const after = line.slice(m.index);
        const lineAndNext = lines.slice(i, i + 3).join(" ");
        if (!citationNearby.test(lineAndNext)) {
          // Allow some known-exempt patterns (UI component values, CSS, config)
          const exempt = /target=|suffix=|animate|style=|className=|calc\(|vh|vw|px|rem|opacity|scale/.test(after.slice(0, 30));
          if (!exempt && parseFloat(stat) > 10) {
            warn("Stat has inline citation", rel(file),
              `Line ${i + 1}: "${stat}" — ensure a source is cited in parentheses near this stat`);
            warnCount++;
          }
        }
        statPattern.lastIndex = m.index + 1;
      }
    });
  }

  if (warnCount === 0) {
    pass("All visible stats have inline source citations", "sitewide");
  }
}

/** 11. Images missing alt text in TSX source files */
function auditImageAlt() {
  const files = walkFiles(SRC, ".tsx");
  let failCount = 0;

  for (const file of files) {
    const content = read(file);
    if (!content) continue;
    // Match <img> tags without alt attribute
    const imgNoAlt = [...content.matchAll(/<img(?![^>]*\balt=)[^>]*>/g)];
    if (imgNoAlt.length > 0) {
      fail("Images have alt text", rel(file),
        `${imgNoAlt.length} <img> tag(s) missing alt attribute`);
      failCount++;
    }
  }

  if (failCount === 0) {
    pass("All <img> tags in TSX files have alt attributes", "src/pages + src/components");
  }
}

/** 12. entry-server.tsx: all 7 AEO routes present */
function auditEntryServer() {
  const file = join(SRC, "entry-server.tsx");
  const content = read(file);
  if (!content) { fail("entry-server.tsx exists", rel(file)); return; }

  const requiredSlugs = [
    "why-no-responses-after-100-applications",
    "ghost-jobs",
    "glossary",
    "for/mid-career-professionals",
    "for/senior-engineers",
    "for/career-changers",
    "job-genie-vs-auto-apply",
  ];

  for (const slug of requiredSlugs) {
    if (content.includes(slug)) {
      pass(`entry-server.tsx registers: /${slug}`, rel(file));
    } else {
      fail(`entry-server.tsx registers: /${slug}`, rel(file),
        "AEO route missing from SSR entry — prerendered head will be incorrect");
    }
  }

  if (/AEO_ROUTES/.test(content)) {
    pass("entry-server.tsx has AEO_ROUTES metadata map", rel(file));
  } else {
    fail("entry-server.tsx has AEO_ROUTES metadata map", rel(file));
  }
}

/** 13. App.tsx: all 7 AEO routes registered before /:slug */
function auditAppRoutes() {
  const file = join(SRC, "App.tsx");
  const content = read(file);
  if (!content) { fail("App.tsx exists", rel(file)); return; }

  const requiredPaths = [
    "/why-no-responses-after-100-applications",
    "/ghost-jobs",
    "/glossary",
    "/for/mid-career-professionals",
    "/for/senior-engineers",
    "/for/career-changers",
    "/job-genie-vs-auto-apply",
  ];

  for (const path of requiredPaths) {
    if (content.includes(path)) {
      pass(`App.tsx registers route: ${path}`, rel(file));
    } else {
      fail(`App.tsx registers route: ${path}`, rel(file), "AEO route missing");
    }
  }

  // Verify AEO routes appear before /:slug wildcard (not /qa/:slug — that's a named segment)
  // Match only the bare wildcard: path="/:slug" or path='/:slug'
  const slugWildcardMatch = content.match(/path=["']\/:[a-z]+["']/);
  const slugWildcardIdx = slugWildcardMatch ? content.indexOf(slugWildcardMatch[0]) : -1;
  const aeoIdx = content.indexOf("/why-no-responses-after-100-applications");
  if (aeoIdx !== -1 && slugWildcardIdx !== -1 && aeoIdx < slugWildcardIdx) {
    pass("App.tsx: AEO routes appear before /:slug wildcard", rel(file));
  } else if (aeoIdx !== -1 && slugWildcardIdx !== -1) {
    fail("App.tsx: AEO routes appear before /:slug wildcard", rel(file),
      "/:slug wildcard will intercept AEO routes — move AEO routes above it");
  } else if (aeoIdx !== -1 && slugWildcardIdx === -1) {
    pass("App.tsx: AEO routes appear before /:slug wildcard", rel(file));
  }
}

/** 14. TypeScript: no compile errors (quick check via tsc --noEmit) */
async function auditTypeScript() {
  const { execSync } = await import("child_process");
  try {
    execSync("pnpm --filter @workspace/job-genie exec tsc --noEmit", {
      cwd: ROOT,
      stdio: "pipe",
    });
    pass("TypeScript: job-genie compiles without errors", "artifacts/job-genie");
  } catch (e) {
    const stderr = (e.stderr ?? e.stdout ?? "").toString().slice(0, 400);
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

    if (r.file && r.file !== "sitewide") {
      console.log(`     ${C.grey}${r.file}${C.reset}`);
    }
    if (r.detail) {
      console.log(`     ${C.cyan}→ ${r.detail}${C.reset}`);
    }
  }

  console.log(`\n${C.grey}${"─".repeat(72)}${C.reset}`);
  console.log(
    `${C.bold}Summary:${C.reset}  ` +
    `${C.green}${passes.length} PASS${C.reset}  ` +
    `${C.yellow}${warns.length} WARN${C.reset}  ` +
    `${C.red}${fails.length} FAIL${C.reset}\n`
  );

  if (fails.length === 0) {
    console.log(`${C.green}${C.bold}✓ Audit passed${fails.length > 0 ? " with warnings" : ""}${C.reset}\n`);
  } else {
    console.log(`${C.red}${C.bold}✗ Audit failed — ${fails.length} issue(s) must be fixed${C.reset}\n`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${C.grey}Scanning: ${ROOT}${C.reset}`);

  auditIndexHtml();
  auditHomePage();
  auditAEOPageTemplate();
  auditLandingPagesData();
  auditSitemap();
  auditLlmsTxt();
  auditRobotsTxt();
  auditSEOComponent();
  auditBannedClaims();
  auditStatCitations();
  auditImageAlt();
  auditEntryServer();
  auditAppRoutes();
  await auditTypeScript();

  printResults();

  const failCount = results.filter((r) => r.status === "FAIL").length;
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Audit error: ${err.message}${C.reset}`);
  process.exit(1);
});
