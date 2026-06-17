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

// ── Sitemap parser ────────────────────────────────────────────────────────────

/**
 * Parse sitemap.xml and return an array of path strings (no domain).
 * e.g. ["https://job-genie.ai/ghost-jobs"] → ["/ghost-jobs"]
 */
function parseSitemapPaths(sitemapContent) {
  const paths = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(sitemapContent)) !== null) {
    const url = m[1].trim();
    const path = url.startsWith(SITE_URL)
      ? url.slice(SITE_URL.length) || "/"
      : url;
    paths.push(path || "/");
  }
  return paths;
}

// ── dist/ HTML discovery ──────────────────────────────────────────────────────

/**
 * Recursively find all index.html files under dist/public/ and return
 * { filePath, routePath } pairs.
 */
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

// ── Per-page HTML auditor ─────────────────────────────────────────────────────

/**
 * Banned stat detection.
 * "70–80%" / "70-80%" is BANNED as a fact-claim everywhere.
 * Exception: it is allowed ONLY inside the specific debunking FAQ answer
 * whose question contains "Is it true that 70" or text that explicitly
 * frames the stat as "unsupported", "myth", or "not credibly".
 * Context window: ±400 chars around the match.
 */
function checkBannedStat(html, fileLabel) {
  const pattern = /70[–\-]80%/g;
  const debunkPhrases = [
    "not credibly",
    "unsupported inflation",
    "essentially a myth",
    "that specific figure",
    "Is it true that 70",
    "claim that 70",
    "unsupported",
    "the myth",
  ];

  let anyFail = false;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const ctx = html.slice(Math.max(0, m.index - 400), m.index + 400);
    // Strip tags to get readable context for diagnosis
    const textCtx = ctx.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const isDebunk = debunkPhrases.some((phrase) =>
      textCtx.toLowerCase().includes(phrase.toLowerCase())
    );
    if (!isDebunk) {
      fail(
        "No banned 70–80% fact-claim",
        fileLabel,
        `Found outside debunk context: "…${textCtx.slice(0, 120)}…"`
      );
      anyFail = true;
    }
    pattern.lastIndex = m.index + 1;
  }
  if (!anyFail) {
    pass("No banned 70–80% fact-claim", fileLabel);
  }
}

/**
 * Audit a single prerendered HTML file for AEO/SEO compliance.
 */
function auditPage(html, routePath, filePath, knownRoutes) {
  const label = `${rel(filePath)} (${routePath})`;

  // 1. <title>
  if (/<title>[^<]+<\/title>/.test(html)) {
    pass("Has <title>", label);
  } else {
    fail("Has <title>", label, "<title> tag missing or empty");
  }

  // 2. meta description
  if (/<meta[^>]*name="description"[^>]*content="[^"]+"/.test(html)) {
    pass("Has meta description", label);
  } else {
    fail("Has meta description", label, "meta[name=description] missing or empty");
  }

  // 3. canonical link
  if (/<link[^>]*rel="canonical"[^>]*>/.test(html)) {
    pass("Has canonical link", label);
  } else {
    fail("Has canonical link", label, "link[rel=canonical] missing");
  }

  // 4. H1 count — must be exactly 1
  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1Count === 1) {
    pass("Exactly one H1", label);
  } else if (h1Count === 0) {
    fail("Exactly one H1", label, "No H1 found");
  } else {
    fail("Exactly one H1", label, `${h1Count} H1 tags — must be exactly 1`);
  }

  // 5. JSON-LD — all blocks must be valid JSON
  const ldBlocks = [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
    ),
  ];
  if (ldBlocks.length === 0) {
    fail("Has JSON-LD schema", label, "No application/ld+json blocks found");
  } else {
    let allValid = true;
    ldBlocks.forEach((m, i) => {
      try {
        JSON.parse(m[1].trim());
      } catch (e) {
        fail(
          `JSON-LD block ${i + 1} is valid JSON`,
          label,
          String(e).slice(0, 100)
        );
        allValid = false;
      }
    });
    if (allValid)
      pass(`Has ${ldBlocks.length} valid JSON-LD block(s)`, label);
  }

  // 6. direct-answer section
  if (/class="direct-answer/.test(html)) {
    pass('Has <section class="direct-answer">', label);
  } else {
    // Home page might have it inline without a dedicated section tag on older builds
    const isHome = routePath === "/";
    if (isHome && /Application Silence|Job Genie diagnoses/.test(html)) {
      warn(
        'Has <section class="direct-answer">',
        label,
        "direct-answer class not found — check Home.tsx renders the section"
      );
    } else {
      fail(
        'Has <section class="direct-answer">',
        label,
        'Missing required AEO direct-answer block — add <section className="direct-answer">'
      );
    }
  }

  // 7. llm-summary section
  if (/class="llm-summary/.test(html)) {
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
    fail(
      "All images have alt text",
      label,
      `${imgNoAlt.length} <img> tag(s) missing alt attribute`
    );
  }

  // 10. Internal link integrity
  const internalHrefs = [
    ...html.matchAll(/href="(\/[^"#?][^"]*|\/)"[^>]*>/g),
  ].map((m) => {
    // Normalise: strip trailing slash (except bare /)
    let p = m[1].split("?")[0].split("#")[0];
    p = p === "/" ? "/" : p.replace(/\/$/, "");
    return p;
  });

  const uniqueHrefs = [...new Set(internalHrefs)];
  for (const href of uniqueHrefs) {
    // Allow /qa/* paths (dynamic corpus routes)
    if (href.startsWith("/qa/")) continue;
    // Allow /admin paths
    if (href.startsWith("/admin")) continue;
    // Allow asset paths (files with extensions)
    if (extname(href)) continue;
    // Check against known routes
    if (knownRoutes.has(href)) {
      pass(`Internal link valid: ${href}`, label);
    } else {
      fail(
        `Internal link valid: ${href}`,
        label,
        `Path "${href}" not found in sitemap — broken internal link or missing sitemap entry`
      );
    }
  }

  // 11. Banned stat
  checkBannedStat(html, label);
}

// ── Global checks ─────────────────────────────────────────────────────────────

function auditSitemap(sitemapPaths) {
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
    if (sitemapPaths.includes(p)) {
      pass(
        `sitemap.xml contains: ${p || "/"}`,
        rel(SITEMAP)
      );
    } else {
      fail(
        `sitemap.xml contains: ${p || "/"}`,
        rel(SITEMAP),
        `URL "${SITE_URL}${p}" missing from sitemap`
      );
    }
  }
}

function auditDistCoverage(sitemapPaths, renderedRoutes) {
  // Check that every sitemap URL has a prerendered HTML file in dist/
  const renderedSet = new Set(renderedRoutes.map((r) => r.routePath));
  for (const sitemapPath of sitemapPaths) {
    if (renderedSet.has(sitemapPath)) {
      pass(
        `dist/public has prerendered HTML for: ${sitemapPath || "/"}`,
        rel(DIST)
      );
    } else {
      fail(
        `dist/public has prerendered HTML for: ${sitemapPath || "/"}`,
        rel(DIST),
        `No dist/public${sitemapPath}/index.html found — run: pnpm --filter @workspace/job-genie build`
      );
    }
  }
}

function auditLlmsTxt() {
  const file = join(PUBLIC, "llms.txt");
  const content = read(file);
  if (!content) {
    fail("llms.txt exists", rel(file));
    return;
  }
  pass("llms.txt exists", rel(file));

  if (/Job Genie/i.test(content)) {
    pass("llms.txt mentions Job Genie entity", rel(file));
  } else {
    fail("llms.txt mentions Job Genie entity", rel(file));
  }

  if (/70.80%|does not claim|guardrail/i.test(content)) {
    pass("llms.txt has banned-claim guardrail note", rel(file));
  } else {
    fail(
      "llms.txt has banned-claim guardrail note",
      rel(file),
      "Add a line explaining Job Genie does not use the 70–80% unsupported claim"
    );
  }
}

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

async function auditTypeScript() {
  const { execSync } = await import("child_process");
  try {
    execSync("pnpm --filter @workspace/job-genie exec tsc --noEmit", {
      cwd: ROOT,
      stdio: "pipe",
    });
    pass("TypeScript: job-genie compiles without errors", "artifacts/job-genie");
  } catch (e) {
    const stderr = ((e.stderr ?? e.stdout ?? "").toString()).slice(0, 400);
    fail("TypeScript: job-genie compiles without errors", "artifacts/job-genie", stderr);
  }
}

// ── Print results ─────────────────────────────────────────────────────────────

function printResults() {
  const passes = results.filter((r) => r.status === "PASS");
  const warns = results.filter((r) => r.status === "WARN");
  const fails = results.filter((r) => r.status === "FAIL");

  console.log(`\n${C.bold}Job Genie SEO/AEO Audit${C.reset}`);
  console.log(`${C.grey}${"─".repeat(72)}${C.reset}\n`);

  for (const r of results) {
    let icon, colour;
    if (r.status === "PASS") {
      icon = "✓";
      colour = C.green;
    } else if (r.status === "WARN") {
      icon = "⚠";
      colour = C.yellow;
    } else {
      icon = "✗";
      colour = C.red;
    }
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
    console.log(
      `${C.red}${C.bold}✗ Audit failed — ${fails.length} issue(s) must be fixed${C.reset}\n`
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${C.grey}Scanning: ${ROOT}${C.reset}`);

  // ── Parse sitemap ──────────────────────────────────────────────────────────
  const sitemapContent = read(SITEMAP);
  if (!sitemapContent) {
    fail("sitemap.xml exists", rel(SITEMAP), "File not found — create it at artifacts/job-genie/public/sitemap.xml");
    printResults();
    process.exit(1);
  }

  const sitemapPaths = parseSitemapPaths(sitemapContent);
  pass(`sitemap.xml parsed (${sitemapPaths.length} URLs)`, rel(SITEMAP));
  auditSitemap(sitemapPaths);

  // Build a set of all known valid internal routes
  const knownRoutes = new Set([
    ...sitemapPaths,
    // Additional internal pages not in sitemap (fine to link to)
    "/admin",
    "/admin/corpus",
    "/qa",
  ]);

  // ── Discover dist/public/ HTML pages ──────────────────────────────────────
  if (!existsSync(DIST)) {
    fail(
      "dist/public/ exists",
      rel(DIST),
      "Prerendered HTML not found. Run: pnpm --filter @workspace/job-genie build"
    );
    // Fall through to run TypeScript + static file checks even without dist
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

  // ── Check sitemap coverage vs dist ────────────────────────────────────────
  auditDistCoverage(sitemapPaths, renderedPages);

  // ── Per-page audits ────────────────────────────────────────────────────────
  for (const { filePath, routePath } of renderedPages) {
    const html = read(filePath);
    if (!html) {
      fail("Can read HTML", rel(filePath), "File unreadable");
      continue;
    }
    auditPage(html, routePath, filePath, knownRoutes);
  }

  // ── Static file checks ────────────────────────────────────────────────────
  auditLlmsTxt();
  auditRobotsTxt();

  // ── TypeScript ────────────────────────────────────────────────────────────
  await auditTypeScript();

  // ── Print & exit ──────────────────────────────────────────────────────────
  printResults();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Audit error: ${err.message}${C.reset}`);
  console.error(err.stack);
  process.exit(1);
});
