/**
 * canonical-redirects.ts
 * 301 redirect map for cannibalising blog posts → keeper URLs.
 * Two sources merged at runtime:
 *   1. Static audit map (AEO/GEO audit, August 2026)
 *   2. DB-detected redirects written by Loop 3's cannibalization guard (auto-refreshed every 10 min)
 */
import { Router } from "express";
import { SITE_URL } from "@workspace/site-config";
import { listBlogRedirects } from "../corpus/db.js";

const router = Router();

// ---------------------------------------------------------------------------
// Blog post redirect map  { duplicate-slug → keeper-slug }
// ---------------------------------------------------------------------------

const BLOG_REDIRECTS: Record<string, string> = {
  // Cluster: "Withdraw from interview process" (keeper: withdraw-interview-process-professionally)
  "withdraw-interview-process-without-upsetting-recruiter": "withdraw-interview-process-professionally",
  "withdraw-interview-24-hours-unprofessional":             "withdraw-interview-process-professionally",
  "withdraw-interview-process-after-first-round":           "withdraw-interview-process-professionally",
  "withdraw-interview-process-after-second-interview":      "withdraw-interview-process-professionally",
  "withdraw-interview-process-24-hours-before":             "withdraw-interview-process-professionally",

  // Cluster: "Will AI replace human workers/jobs" (keeper: will-ai-replace-human-workers)
  "will-ai-replace-human-jobs":                             "will-ai-replace-human-workers",
  "ai-automation-replacing-human-jobs":                     "will-ai-replace-human-workers",
  "ai-automation-replacing-human-workers":                  "will-ai-replace-human-workers",
  "ai-automation-replacing-human-workers-job-search":       "will-ai-replace-human-workers",
  "will-ai-automation-eliminate-jobs":                      "will-ai-replace-human-workers",
  "will-ai-eliminate-jobs-replace-teams":                   "will-ai-replace-human-workers",
  "ai-replacing-workers-eliminating-jobs":                  "will-ai-replace-human-workers",
  "will-ai-replace-my-job-stay-employed-ai-workforce":      "will-ai-replace-human-workers",
  "will-ai-automation-eliminate-jobs-tech-executives":      "ai-eliminating-jobs-tech-leaders-deny",

  // Cluster: "Networking vs skills for job interviews" (keeper: networking-vs-skill-landing-job-interviews)
  "networking-vs-skill-job-interview":                      "networking-vs-skill-landing-job-interviews",
  "networking-vs-skills-job-interviews":                    "networking-vs-skill-landing-job-interviews",

  // Cluster: "Older workers after layoffs" (keeper: older-workers-find-jobs-after-layoffs-without-pay-cut)
  "older-workers-find-employment-after-layoff-without-pay-cut": "older-workers-find-jobs-after-layoffs-without-pay-cut",

  // Cluster: "Recruiter delegation unprofessional" (keeper: recruiter-delegate-scheduling-unprofessional)
  "recruiter-scheduling-assistant-unprofessional":          "recruiter-delegate-scheduling-unprofessional",

  // Cluster: "Job switching / loyalty / salary" (keeper: why-employees-earn-more-leaving-returning-than-staying-loyal)
  "job-hopping-vs-loyalty-higher-salary":                   "why-employees-earn-more-leaving-returning-than-staying-loyal",
  "job-switchers-earn-more-than-loyal-employees":           "why-employees-earn-more-leaving-returning-than-staying-loyal",
  "staying-loyal-one-employer-hurts-salary":                "why-employees-earn-more-leaving-returning-than-staying-loyal",
  "switching-companies-higher-salary-increases":            "why-employees-earn-more-leaving-returning-than-staying-loyal",

  // Cluster: "Interviewer late / making you wait" (keeper: interviewer-keeps-you-waiting-over-hour)
  "interviewer-extremely-late-no-communication":            "interviewer-keeps-you-waiting-over-hour",

  // Cluster: "Relocating for work" (keeper: relocating-rural-area-higher-salary-career-market)
  "relocating-remote-small-town-high-paying-job":           "relocating-rural-area-higher-salary-career-market",

  // Cluster: "Emotional overwhelm in interview" (keeper: handle-emotional-overwhelm-stressful-job-interview)
  "handle-overwhelming-job-interview-without-breaking-down": "handle-emotional-overwhelm-stressful-job-interview",

  // Cluster: "Terminated for giving notice" (keeper: fired-giving-notice-employer-wants-rehire)
  "terminated-for-giving-notice-employer-asked-to-return":  "fired-giving-notice-employer-wants-rehire",

  // Cluster: "Responding to recruiter after being ghosted/stood up" (keeper: respond-rude-recruiter-email-stood-up-interview)
  "respond-rescheduling-request-after-ghosted-interview":   "respond-rude-recruiter-email-stood-up-interview",
};

// ---------------------------------------------------------------------------
// DB-detected redirects cache (refreshed every 10 minutes)
// ---------------------------------------------------------------------------

let dbRedirectCache: Record<string, string> = {};
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function getDbRedirects(): Promise<Record<string, string>> {
  if (Date.now() - cacheLoadedAt < CACHE_TTL_MS) return dbRedirectCache;
  try {
    const rows = await listBlogRedirects();
    dbRedirectCache = Object.fromEntries(rows.map((r) => [r.duplicateSlug, r.keeperSlug]));
    cacheLoadedAt = Date.now();
  } catch {
    // Non-fatal: fall back to stale cache or empty
  }
  return dbRedirectCache;
}

export async function getRedirectedBlogSlugs(): Promise<Set<string>> {
  return new Set([...Object.keys(BLOG_REDIRECTS), ...Object.keys(await getDbRedirects())]);
}

// ---------------------------------------------------------------------------
// Middleware: intercept /blog/:slug and 301 to keeper if in either map
// ---------------------------------------------------------------------------

router.get("/blog/:slug", async (req, res, next) => {
  const { slug } = req.params;
  const staticKeeper = BLOG_REDIRECTS[slug];
  if (staticKeeper) {
    return res.redirect(301, `${SITE_URL}/blog/${staticKeeper}`);
  }
  const db = await getDbRedirects();
  const dbKeeper = db[slug];
  if (dbKeeper) {
    return res.redirect(301, `${SITE_URL}/blog/${dbKeeper}`);
  }
  next();
});

export { BLOG_REDIRECTS };
export default router;
