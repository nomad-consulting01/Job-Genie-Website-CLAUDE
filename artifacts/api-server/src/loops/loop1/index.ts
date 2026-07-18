import { runIngest } from "./ingest.js";
import { processQuestion } from "./answer.js";
import { startLoopRun, finishLoopRun, listQuestions } from "../../corpus/db.js";
import { engineConfig } from "../../config/engine.js";
import { logger } from "../../lib/logger.js";
import { pingGoogleSitemap } from "../../lib/google-ping.js";
import { invalidateSitemapCache } from "../../routes/sitemap.js";

export interface Loop1RunResult {
  runId: number;
  ingested: number;
  deduped: number;
  newQuestions: number;
  processed: number;
  passed: number;
  failed: number;
  costEstimateUsd: number;
  errors: string[];
}

const USD_PER_M_INPUT = 3.0;
const USD_PER_M_OUTPUT = 15.0;
const AVG_OUTPUT_RATIO = 0.4;

function estimateCost(totalTokens: number): number {
  const inputTokens = totalTokens * (1 - AVG_OUTPUT_RATIO);
  const outputTokens = totalTokens * AVG_OUTPUT_RATIO;
  return (inputTokens * USD_PER_M_INPUT + outputTokens * USD_PER_M_OUTPUT) / 1_000_000;
}

export async function run(): Promise<Loop1RunResult> {
  const run_ = await startLoopRun("loop1");
  logger.info({ runId: run_.id }, "Loop 1 started");

  let totalTokens = 0;
  const errors: string[] = [];

  try {
    const cfg = engineConfig.loop1;

    const ingestResult = await runIngest();
    totalTokens += ingestResult.tokensUsed;

    const pendingQuestions = await listQuestions(cfg.maxQuestionsPerRun);
    const toProcess = pendingQuestions.filter((q) => q.status === "pending");

    logger.info(
      { total: toProcess.length, ingestNew: ingestResult.saved },
      "Loop 1: answering pending questions"
    );

    let passed = 0;
    let failed = 0;

    for (const q of toProcess) {
      if (estimateCost(totalTokens) >= cfg.costBudgetUsd) {
        logger.warn({ budget: cfg.costBudgetUsd }, "Loop 1: cost budget reached — stopping");
        errors.push(`Cost budget $${cfg.costBudgetUsd} reached after processing ${passed + failed} questions`);
        break;
      }

      try {
        const result = await processQuestion(q);
        totalTokens += result.tokensUsed;
        if (result.passed) {
          passed++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Question ${q.id}: ${msg}`);
        logger.error({ questionId: q.id, err: msg }, "Loop 1: error processing question");
      }
    }

    const costEstimate = estimateCost(totalTokens);
    await finishLoopRun(run_.id, {
      itemsProcessed: passed + failed,
      costEstimate,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      error: errors.length > 0 ? errors.join("; ") : undefined,
    });

    if (passed > 0) {
      invalidateSitemapCache();
      pingGoogleSitemap();
    }

    logger.info(
      { runId: run_.id, passed, failed, cost: costEstimate },
      "Loop 1 completed"
    );

    return {
      runId: run_.id,
      ingested: ingestResult.ingested,
      deduped: ingestResult.deduped,
      newQuestions: ingestResult.saved,
      processed: passed + failed,
      passed,
      failed,
      costEstimateUsd: costEstimate,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishLoopRun(run_.id, {
      itemsProcessed: 0,
      costEstimate: estimateCost(totalTokens),
      status: "failed",
      error: msg,
    });
    logger.error({ runId: run_.id, err: msg }, "Loop 1 failed");
    throw err;
  }
}
