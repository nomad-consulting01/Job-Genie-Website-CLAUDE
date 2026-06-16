import { ingestFromReddit } from "../../integrations/reddit.js";
import { processRawText } from "./answer.js";
import {
  insertQuestion,
  getAllNormalisedQuestions,
} from "../../corpus/db.js";
import { engineConfig } from "../../config/engine.js";
import { logger } from "../../lib/logger.js";
import type { Question } from "@workspace/db";

function cosineLikeSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/));
  const tokensB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  return intersection / Math.sqrt(tokensA.size * tokensB.size);
}

function isDuplicate(candidate: string, existing: string[], threshold: number): boolean {
  for (const existing_ of existing) {
    if (cosineLikeSimilarity(candidate, existing_) >= threshold) return true;
  }
  return false;
}

export interface IngestResult {
  ingested: number;
  deduped: number;
  saved: number;
  questions: Question[];
  tokensUsed: number;
}

export async function runIngest(): Promise<IngestResult> {
  const cfg = engineConfig.loop1;
  let totalTokens = 0;

  logger.info("Loop 1 ingest: starting Reddit mining");
  const rawItems = await ingestFromReddit(
    cfg.targetSubreddits,
    cfg.searchQueries,
    cfg.maxQuestionsPerRun * 3
  );

  const existingQuestions = await getAllNormalisedQuestions();
  logger.info({ existing: existingQuestions.length }, "Loaded existing corpus questions");

  const newQuestions: Question[] = [];
  let dedupedCount = 0;

  for (const item of rawItems) {
    if (newQuestions.length >= cfg.maxQuestionsPerRun) break;

    const normalised = await processRawText(item.rawText);
    totalTokens += normalised.tokensUsed;

    const allKnown = [...existingQuestions, ...newQuestions.map((q) => q.normalisedQuestion)];
    if (isDuplicate(normalised.normalisedQuestion, allKnown, cfg.dedupeThreshold)) {
      dedupedCount++;
      logger.debug({ q: normalised.normalisedQuestion }, "Deduped — similar question already in corpus");
      continue;
    }

    const saved = await insertQuestion({
      source: item.source,
      sourceUrl: item.sourceUrl,
      rawText: item.rawText,
      normalisedQuestion: normalised.normalisedQuestion,
      painPointTags: normalised.painPointTags,
      engagementSignal: item.engagementSignal,
      status: "pending",
    });

    newQuestions.push(saved);
    logger.info({ id: saved.id, q: saved.normalisedQuestion }, "New question ingested");
  }

  return {
    ingested: rawItems.length,
    deduped: dedupedCount,
    saved: newQuestions.length,
    questions: newQuestions,
    tokensUsed: totalTokens,
  };
}

export async function seedManualQuestion(
  rawText: string,
  sourceUrl: string | null,
  source: "manual" | "quora" | "linkedin" = "manual"
): Promise<Question> {
  const normalised = await processRawText(rawText);
  const existingQuestions = await getAllNormalisedQuestions();
  const cfg = engineConfig.loop1;

  if (isDuplicate(normalised.normalisedQuestion, existingQuestions, cfg.dedupeThreshold)) {
    throw new Error(`Question already in corpus (near-duplicate): "${normalised.normalisedQuestion}"`);
  }

  return insertQuestion({
    source,
    sourceUrl: sourceUrl ?? null,
    rawText,
    normalisedQuestion: normalised.normalisedQuestion,
    painPointTags: normalised.painPointTags,
    engagementSignal: 0,
    status: "pending",
  });
}
