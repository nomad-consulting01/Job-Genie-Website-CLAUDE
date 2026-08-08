/**
 * Generates the AEO/GEO audit Word document.
 * Run with: node scripts/gen-aeo-audit-doc.cjs
 */
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, PageBreak
} = require("/home/runner/workspace/node_modules/.pnpm/docx@9.7.1/node_modules/docx/dist/index.cjs");
const fs = require("fs");

const h1 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
const h2 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 140 } });
const h3 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 } });
const p  = (t) => new Paragraph({ children: [new TextRun({ text: t, size: 22 })], spacing: { after: 120 } });
const li = (t) => new Paragraph({ children: [new TextRun({ text: t, size: 22 })], bullet: { level: 0 }, spacing: { after: 80 } });
const mono = (t) => new Paragraph({ children: [new TextRun({ text: t, font: "Courier New", size: 18 })], shading: { type: "clear", fill: "F2F2F2" }, spacing: { after: 60 } });
const sp = () => new Paragraph({ spacing: { after: 180 } });
const pb = () => new Paragraph({ children: [new PageBreak()] });

function tbl(rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, ri) => new TableRow({
      tableHeader: ri === 0,
      children: cells.map((txt, ci) => new TableCell({
        width: { size: (widths || [])[ci] || Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: txt, bold: ri === 0, size: 20, color: ri === 0 ? "FFFFFF" : "111111" })] })],
        shading: ri === 0 ? { type: "clear", fill: "1F3864" }
               : ri % 2 === 0 ? { type: "clear", fill: "F5F7FA" }
               : undefined,
      }))
    }))
  });
}

const REDIRECTS = [
  ["withdraw-interview-process-without-upsetting-recruiter","withdraw-interview-process-professionally"],
  ["withdraw-interview-24-hours-unprofessional","withdraw-interview-process-professionally"],
  ["withdraw-interview-process-after-first-round","withdraw-interview-process-professionally"],
  ["withdraw-interview-process-after-second-interview","withdraw-interview-process-professionally"],
  ["withdraw-interview-process-24-hours-before","withdraw-interview-process-professionally"],
  ["will-ai-replace-human-jobs","will-ai-replace-human-workers"],
  ["ai-automation-replacing-human-jobs","will-ai-replace-human-workers"],
  ["ai-automation-replacing-human-workers","will-ai-replace-human-workers"],
  ["ai-automation-replacing-human-workers-job-search","will-ai-replace-human-workers"],
  ["will-ai-automation-eliminate-jobs","will-ai-replace-human-workers"],
  ["will-ai-eliminate-jobs-replace-teams","will-ai-replace-human-workers"],
  ["ai-replacing-workers-eliminating-jobs","will-ai-replace-human-workers"],
  ["will-ai-replace-my-job-stay-employed-ai-workforce","will-ai-replace-human-workers"],
  ["will-ai-automation-eliminate-jobs-tech-executives","ai-eliminating-jobs-tech-leaders-deny"],
  ["networking-vs-skill-job-interview","networking-vs-skill-landing-job-interviews"],
  ["networking-vs-skills-job-interviews","networking-vs-skill-landing-job-interviews"],
  ["older-workers-find-employment-after-layoff-without-pay-cut","older-workers-find-jobs-after-layoffs-without-pay-cut"],
  ["recruiter-scheduling-assistant-unprofessional","recruiter-delegate-scheduling-unprofessional"],
  ["job-hopping-vs-loyalty-higher-salary","why-employees-earn-more-leaving-returning-than-staying-loyal"],
  ["job-switchers-earn-more-than-loyal-employees","why-employees-earn-more-leaving-returning-than-staying-loyal"],
  ["staying-loyal-one-employer-hurts-salary","why-employees-earn-more-leaving-returning-than-staying-loyal"],
  ["switching-companies-higher-salary-increases","why-employees-earn-more-leaving-returning-than-staying-loyal"],
  ["interviewer-extremely-late-no-communication","interviewer-keeps-you-waiting-over-hour"],
  ["relocating-remote-small-town-high-paying-job","relocating-rural-area-higher-salary-career-market"],
  ["handle-overwhelming-job-interview-without-breaking-down","handle-emotional-overwhelm-stressful-job-interview"],
  ["terminated-for-giving-notice-employer-asked-to-return","fired-giving-notice-employer-wants-rehire"],
  ["respond-rescheduling-request-after-ghosted-interview","respond-rude-recruiter-email-stood-up-interview"],
];

const doc = new Document({
  title: "Job Genie — AEO/GEO Crawler Readiness Audit",
  sections: [{ children: [

    // ── Cover ──────────────────────────────────────────────────────────────
    new Paragraph({ children: [new TextRun({ text: "Job Genie", bold: true, size: 64, color: "1F3864" })], alignment: AlignmentType.CENTER, spacing: { before: 700, after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: "AEO / GEO Crawler Readiness Audit", bold: true, size: 40, color: "2E74B5" })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: "Five-Phase Remediation Report  ·  August 2026", size: 24, color: "555555" })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: "Target: https://www.job-genie.ai", size: 20, color: "888888" })], alignment: AlignmentType.CENTER, spacing: { after: 700 } }),

    // ── Executive Summary ──────────────────────────────────────────────────
    h1("Executive Summary"),
    p("A full AEO/GEO crawler readiness audit was conducted on job-genie.ai. Two compounding failures were confirmed: (1) GoDaddy domain masking serving the apex domain through a frame wrapper, making all content invisible to crawlers and AI answer engines; and (2) severe keyword cannibalization — 27 of 104 published blog posts are near-duplicate intent, fragmenting ranking authority across competing URLs."),
    p("Three of five audit phases produced code fixes that have been shipped to the repository. Two require manual GoDaddy/DNS actions by the site owner before they can take effect."),
    sp(),

    // ── Phase 1 ────────────────────────────────────────────────────────────
    pb(),
    h1("Phase 1 — Discoverability Diagnosis"),
    h2("Host Consistency Results"),
    tbl([
      ["Check","Result"],
      ["https://job-genie.ai (apex)","⚠️  HTTP 200 — GoDaddy masking ACTIVE. Content in frame. App-level 301 cannot fire until removed."],
      ["https://www.job-genie.ai (www)","✅  HTTP 200 — serving correctly"],
      ["http://job-genie.ai (plain HTTP)","⚠️  GoDaddy 301 → https://job-genie.ai:443  (NOT redirecting to www)"],
      ["sitemap.xml","✅  1,052 URLs — all on www canonical host"],
      ["robots.txt","✅  References https://www.job-genie.ai/sitemap.xml correctly"],
    ],[38,62]),
    sp(),
    h2("Root Cause: GoDaddy Domain Masking"),
    p("The apex domain returns HTTP 200 with a frame wrapper — the signature of GoDaddy Domain Forwarding with masking enabled. Crawlers and AI answer engines see only the opaque frame shell, not the page content. The Express 301 middleware that was added to the API server cannot execute because apex-domain requests never reach the Replit deployment while GoDaddy forwarding is active."),
    h2("Required Manual Steps (Must Be Completed First)"),
    li("GoDaddy → My Products → Domain Settings → Forwarding → DELETE the apex forwarding rule entirely (do not just disable masking — remove it completely)"),
    li("Replit Deployments → Settings → Link a domain: link www.job-genie.ai → copy its A record IP + replit-verify TXT value"),
    li("Replit Deployments → Link a domain again: link job-genie.ai (apex) → copy its separate A record IP + TXT value (these differ from the www values)"),
    li("GoDaddy DNS: remove existing parking/forwarding A records for @ and www; add all four records from Replit"),
    li("replit-verify TXT records must stay permanently — removing them breaks Replit's automatic SSL renewal"),
    sp(),

    // ── Phase 2 ────────────────────────────────────────────────────────────
    pb(),
    h1("Phase 2 — Canonical / Redirect Remediation"),
    h2("Status: SHIPPED"),
    p("The following has been applied to artifacts/api-server/src/app.ts:"),
    li("app.set('trust proxy', 1) — reads Replit reverse-proxy headers correctly"),
    li("Permanent 301 middleware: job-genie.ai → https://www.job-genie.ai, full path + query string preserved"),
    li("HTTP upgrade: http:// on either host → https://www.job-genie.ai"),
    li("Safe exclusions: *.replit.app preview URLs and localhost are skipped — dev environment is unaffected"),
    sp(),
    h2("Verification Commands — Run After DNS Propagates"),
    mono("# 1. Apex must 301 → www (NOT return 200)"),
    mono("curl -sI https://job-genie.ai/blog | grep -iE 'HTTP/|location'"),
    mono("# Expected: HTTP/2 301   location: https://www.job-genie.ai/blog"),
    sp(),
    mono("# 2. www must return 200"),
    mono("curl -sI https://www.job-genie.ai/blog | grep -iE 'HTTP/|location'"),
    mono("# Expected: HTTP/2 200"),
    sp(),
    mono("# 3. Plain HTTP must upgrade to https + www"),
    mono("curl -sI http://job-genie.ai/blog | grep -iE 'HTTP/|location'"),
    mono("# Expected: 301 → https://www.job-genie.ai/blog"),
    sp(),
    p("If the apex still returns 200 with no Location header, the GoDaddy forwarding rule was not fully removed — return to Phase 1."),
    sp(),

    // ── Phase 3 ────────────────────────────────────────────────────────────
    pb(),
    h1("Phase 3 — Keyword Cannibalization Audit"),
    h2("Finding: SEVERE — 27 Posts Confirmed Near-Duplicate"),
    p("104 published blog posts were audited by slug and title similarity. 27 posts cluster around 11 query intents where multiple URLs compete for the same searcher. This fragments crawl budget, prevents authority consolidation on any single URL, and signals low content quality to ranking algorithms."),
    p("STATUS: 301 redirect middleware shipped to artifacts/api-server/src/routes/canonical-redirects.ts and mounted before blog SSR routes in app.ts. All 27 duplicates permanently redirect to their keeper URL."),
    sp(),
    h2("Cannibalization Clusters"),

    h3("Cluster 1 — Withdrawing From an Interview Process  (5 duplicates → 1 keeper)"),
    li("KEEPER: /blog/withdraw-interview-process-professionally"),
    li("301 → /blog/withdraw-interview-process-without-upsetting-recruiter"),
    li("301 → /blog/withdraw-interview-24-hours-unprofessional"),
    li("301 → /blog/withdraw-interview-process-after-first-round"),
    li("301 → /blog/withdraw-interview-process-after-second-interview"),
    li("301 → /blog/withdraw-interview-process-24-hours-before"),
    sp(),

    h3("Cluster 2 — Will AI Replace Human Workers/Jobs  (9 duplicates → 2 keepers)"),
    li("KEEPER A: /blog/will-ai-replace-human-workers  (general intent)"),
    li("301 → will-ai-replace-human-jobs"),
    li("301 → ai-automation-replacing-human-jobs"),
    li("301 → ai-automation-replacing-human-workers"),
    li("301 → ai-automation-replacing-human-workers-job-search"),
    li("301 → will-ai-automation-eliminate-jobs"),
    li("301 → will-ai-eliminate-jobs-replace-teams"),
    li("301 → ai-replacing-workers-eliminating-jobs"),
    li("301 → will-ai-replace-my-job-stay-employed-ai-workforce"),
    li("KEEPER B: /blog/ai-eliminating-jobs-tech-leaders-deny  (distinct angle: tech exec claims)"),
    li("301 → will-ai-automation-eliminate-jobs-tech-executives"),
    sp(),

    h3("Cluster 3 — Networking vs Skills for Job Interviews  (2 duplicates + 1 exact-duplicate slug)"),
    li("KEEPER: /blog/networking-vs-skill-landing-job-interviews"),
    li("301 → networking-vs-skill-job-interview"),
    li("301 → networking-vs-skills-job-interviews  [NOTE: this exact slug was published twice — exact duplicate]"),
    sp(),

    h3("Clusters 4–11 — Remaining Duplicate Pairs"),
    li("older-workers-find-employment-after-layoff-without-pay-cut → older-workers-find-jobs-after-layoffs-without-pay-cut"),
    li("recruiter-scheduling-assistant-unprofessional → recruiter-delegate-scheduling-unprofessional"),
    li("job-hopping-vs-loyalty-higher-salary → why-employees-earn-more-leaving-returning-than-staying-loyal"),
    li("job-switchers-earn-more-than-loyal-employees → why-employees-earn-more-leaving-returning-than-staying-loyal"),
    li("staying-loyal-one-employer-hurts-salary → why-employees-earn-more-leaving-returning-than-staying-loyal"),
    li("switching-companies-higher-salary-increases → why-employees-earn-more-leaving-returning-than-staying-loyal"),
    li("interviewer-extremely-late-no-communication → interviewer-keeps-you-waiting-over-hour"),
    li("relocating-remote-small-town-high-paying-job → relocating-rural-area-higher-salary-career-market"),
    li("handle-overwhelming-job-interview-without-breaking-down → handle-emotional-overwhelm-stressful-job-interview"),
    li("terminated-for-giving-notice-employer-asked-to-return → fired-giving-notice-employer-wants-rehire"),
    li("respond-rescheduling-request-after-ghosted-interview → respond-rude-recruiter-email-stood-up-interview"),
    sp(),

    h2("Full Redirect Map (27 Entries)"),
    tbl([["Duplicate URL (301 FROM)","Keeper URL (301 TO)"], ...REDIRECTS],[50,50]),
    sp(),

    // ── Phase 4 ────────────────────────────────────────────────────────────
    pb(),
    h1("Phase 4 — On-Page AEO Signals"),
    h2("Blog Posts (/blog/:slug) — Fixes Shipped"),
    tbl([
      ["Signal","Status"],
      ["Self-referencing canonical (www)","✅  Correct on all posts"],
      ["BlogPosting JSON-LD — image field","FIXED: added featuredImageUrl (or site OG fallback). Required for Google rich-result eligibility."],
      ["BlogPosting JSON-LD — dateModified","FIXED: added. Was missing. Affects freshness ranking signal for both Google and AI crawlers."],
      ["Question JSON-LD — acceptedAnswer.text","FIXED: now uses full answerFirstBlock instead of the truncated meta description. Significantly richer signal for AI citation engines."],
      ["BreadcrumbList JSON-LD","✅  Present and correct on all posts"],
      ["FAQPage JSON-LD","✅  Present where faqJsonLd payload is populated"],
      ["OG + Twitter meta tags","✅  Per-post with featuredImageUrl where available"],
      ["Answer-first Quick Answer block","✅  Teal callout in SSR HTML — visible to all crawlers without JavaScript"],
      ["H1 present and descriptive","✅  Confirmed on sampled posts"],
      ["H2 structure","⚠️  Sample post had only 1 H2. Recommendation: target 3–6 H2 sections per post for better AI answer extraction."],
    ],[38,62]),
    sp(),
    h2("Answer Pages (/answers/:slug)"),
    tbl([
      ["Signal","Status"],
      ["FAQPage JSON-LD with full answerFirstBlock","✅  Already using full text — no change needed"],
      ["Article JSON-LD with datePublished + dateModified","✅  Present"],
      ["BreadcrumbList JSON-LD","✅  Present"],
      ["HowTo JSON-LD (how-to questions)","✅  Auto-generated when H2 sections exist"],
      ["OG image","⚠️  Generic site OG image used on all /answers pages. No per-page image. Lower social card quality vs blog posts."],
      ["Self-referencing canonical","✅  Correct on every page"],
    ],[38,62]),
    sp(),

    // ── Phase 5 ────────────────────────────────────────────────────────────
    pb(),
    h1("Phase 5 — Authority & Corroboration"),
    h2("Proprietary Terms at Risk of Low Citability"),
    p("Job Genie uses proprietary terms that AI answer engines cannot independently verify because no external source uses them. This limits citability — engines prefer pages whose claims map to facts they already index from trusted sources."),
    tbl([
      ["Term","Recommended Anchor"],
      ["Application Silence","Anchor to SHRM data: 70%+ of applicants receive no response. Define Application Silence as the named symptom; cite SHRM as the measurement basis."],
      ["Application Silence Score","Frame as proprietary diagnostic tool. Cite underlying inputs (ATS rejection benchmarks, shortlist thresholds) with named sources."],
      ["Recruiter-Fit Gap","Anchor to Granovetter (1974) weak-ties research + SHRM referral hire data (30%+ of hires). Define the gap as the distance between how a candidate presents and the recruiter's shortlist threshold."],
      ["Truth Layer","Resume-rewrite methodology optimised for recruiter-fit over keyword matching. Cite Harvard/Accenture 'Hidden Workers' report (2021) on ATS over-filtering."],
      ["Recruiter-Ready Brief","Describe the output format, not just the name. Anchor to documented recruiter shortlisting processes so engines can map it to a known workflow."],
    ],[25,75]),
    sp(),
    h2("Confirmed Citable Statistics (All Correctly Sourced in llms.txt)"),
    li("Employee referrals = 30%+ of all hires; ~45% of internal hires — SHRM"),
    li("Referrals convert ~1 in 16 vs ~1 in 100 overall — SHRM / Lever analysis"),
    li("Referred candidates ~4× more likely to be hired — widely reported referral data"),
    li("81% of recruiters say their employer has posted a ghost job — MyPerfectResume survey"),
    li("62% of hiring managers admit posting ghost jobs — Resume Builder survey"),
    li("43% of employers post ghost jobs to look like they're growing — Clarify Capital survey"),
    li("~27% of U.S. LinkedIn listings likely ghost jobs — ResumeUp.AI analysis, Sept 2025"),
    li("~56% of job-changers found work via personal contacts — Granovetter (1974)"),
    sp(),

    // ── Action Plan ────────────────────────────────────────────────────────
    pb(),
    h1("Prioritised Action Plan"),
    tbl([
      ["Priority","Owner","Action"],
      ["P0 — BLOCKING","You","Delete GoDaddy forwarding/masking rule. Until done, all crawlability fixes are invisible to search engines and AI crawlers."],
      ["P0 — BLOCKING","You","Set DNS A + TXT records for BOTH apex and www after linking both domains in Replit Deployments."],
      ["P1 — SHIPPED","Done","App-level 301 middleware: apex + http → https://www.job-genie.ai (live in repository, active on next publish)"],
      ["P1 — SHIPPED","Done","BlogPosting JSON-LD: added image field, dateModified, and full answerFirstBlock in Question.acceptedAnswer.text"],
      ["P1 — SHIPPED","Done","27-post cannibalization: permanent 301 redirect map live in canonical-redirects.ts"],
      ["P2 — MANUAL","You","Google Search Console: verify www.job-genie.ai property, submit sitemap, request indexing on /blog and top posts after DNS clears"],
      ["P2 — CONTENT","You","Anchor proprietary terms (Application Silence Score, Recruiter-Fit Gap, Truth Layer) to named primary sources in on-page copy"],
      ["P3 — CONTENT","You","Ensure new blog posts have 3–6 H2 sections per post for better AI answer extraction"],
      ["P3 — CONTENT","You","Add per-page OG images to /answers/:slug pages (currently using generic site image)"],
      ["P4 — PROCESS","You","Before publishing any new blog post, check slug/title against existing posts to prevent recurrence of intent cannibalization"],
    ],[15,15,70]),
    sp(),

    // Footer
    new Paragraph({
      children: [new TextRun({ text: "Job Genie AEO/GEO Audit  ·  Confidential  ·  August 2026", size: 18, color: "888888" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    }),
  ]}]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/runner/workspace/attached_assets/job-genie-aeo-audit-august-2026.docx", buf);
  console.log("Written", buf.length, "bytes");
}).catch(e => { console.error(e); process.exit(1); });
