import { Router } from "express";
import { AnalyzeJobPostingBody } from "@workspace/api-zod";
import { analyzePosting, PostingAnalysisError } from "../integrations/job-posting-analysis.js";
import { fetchJobPosting, PostingFetchError } from "../lib/job-posting-fetch.js";

const router = Router();
const attempts = new Map<string, { count: number; until: number }>();
let active = 0;

router.post("/job-posting/analyze", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = AnalyzeJobPostingBody.safeParse(req.body);
  if (!parsed.success || Boolean(parsed.data.url?.trim()) === Boolean(parsed.data.text?.trim())) {
    res.status(400).json({ error: "Supply either a public job URL or 80–30,000 characters of posting text.", code: "invalid_input" });
    return;
  }
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
  const usage = attempts.get(ip) ?? { count: 0, until: now + 10 * 60000 };
  if (usage.count >= 6 || active >= 8 || attempts.size >= 10000) {
    res.setHeader("Retry-After", "600");
    res.status(429).json({ error: "Please wait a few minutes before another analysis. You can still read the example below.", code: "rate_limited" });
    return;
  }
  usage.count++;
  attempts.set(ip, usage);
  active++;
  try {
    let text = parsed.data.text?.trim() ?? "";
    let sourceUrl: string | null = null;
    if (parsed.data.url) ({ text, sourceUrl } = await fetchJobPosting(parsed.data.url.trim()));
    if (text.length < 80) {
      res.status(400).json({ error: "Paste at least 80 characters from the job description.", code: "invalid_input" });
      return;
    }
    const brief = await analyzePosting(text, sourceUrl);
    if (!brief) {
      res.status(422).json({ error: "We could not find enough job requirements in this content. Paste the full job description and try again.", code: "insufficient_posting" });
      return;
    }
    res.json(brief);
  } catch (error) {
    if (error instanceof PostingFetchError) {
      res.status(error.code === "blocked_url" ? 400 : 422).json({ error: error.message, code: error.code });
    } else {
      // Never log posting content, URLs, prompts, provider responses or raw provider errors.
      req.log.warn({ failure: error instanceof PostingAnalysisError ? error.reason : "unexpected" }, "Job-posting analysis failed; no source content logged");
      res.status(502).json({ error: "The analysis service could not complete this brief. Please try again shortly; no result has been invented.", code: "analysis_failed" });
    }
  } finally {
    active--;
  }
});

export default router;
