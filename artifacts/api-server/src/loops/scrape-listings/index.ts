import { scrapeRedditUrl } from "../../integrations/reddit.js";
import { insertQuestion, getAllNormalisedQuestions } from "../../corpus/db.js";
import { engineConfig } from "../../config/engine.js";
import { logger } from "../../lib/logger.js";

function cosineLike(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/));
  const tb = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  return intersection / Math.sqrt(ta.size * tb.size);
}

function deriveNormalisedQuestion(rawText: string): string {
  const first = rawText.split(/[\n.!?]/)[0]?.trim() ?? rawText;
  return first.slice(0, 200) || rawText.slice(0, 200);
}

export interface ScraperRunResult {
  urlsProcessed: number;
  totalScraped: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export async function runListingScraper(
  urls?: string[]
): Promise<ScraperRunResult> {
  const targetUrls = urls ?? engineConfig.listingScraper.urls;
  const threshold = engineConfig.listingScraper.dedupeThreshold;

  logger.info({ urls: targetUrls.length }, "Listing scraper: starting");

  const existing = await getAllNormalisedQuestions();
  const seen = new Set(existing);

  let totalScraped = 0;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const url of targetUrls) {
    logger.info({ url }, "Listing scraper: fetching");

    let scraped;
    try {
      scraped = await scrapeRedditUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ url, err: msg }, "Listing scraper: fetch failed");
      errors.push(`${url}: ${msg}`);
      continue;
    }

    totalScraped += scraped.comments.length;

    for (const item of scraped.comments) {
      if (!item.rawText || item.rawText.trim().length < 20) {
        skipped++;
        continue;
      }

      const normQ = deriveNormalisedQuestion(item.rawText);
      const isDupe = [...seen].some((e) => cosineLike(normQ, e) >= threshold);
      if (isDupe) {
        skipped++;
        continue;
      }

      try {
        await insertQuestion({
          source: item.source,
          sourceUrl: item.sourceUrl,
          rawText: item.rawText,
          normalisedQuestion: normQ,
          painPointTags: [],
          engagementSignal: item.engagementSignal,
          status: "pending",
        });
        seen.add(normQ);
        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`insert: ${msg}`);
        if (errors.length >= 10) break;
      }
    }

    // Polite delay between subreddits — Reddit rate-limits bursts
    const jitter = Math.floor(Math.random() * 10000);
    await new Promise((r) => setTimeout(r, 30000 + jitter));
  }

  logger.info({ urlsProcessed: targetUrls.length, totalScraped, imported, skipped }, "Listing scraper: complete");
  return { urlsProcessed: targetUrls.length, totalScraped, imported, skipped, errors };
}
