import { generateAssetsForAnswer } from "./generate.js";
import { startLoopRun, finishLoopRun, listAnswersNotYetInLoop2 } from "../../corpus/db.js";
import { engineConfig } from "../../config/engine.js";
import { logger } from "../../lib/logger.js";

export interface Loop2RunResult {
  runId: number;
  processed: number;
  succeeded: number;
  failed: number;
  assetsCreated: number;
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

export async function run(): Promise<Loop2RunResult> {
  const run_ = await startLoopRun("loop2");
  logger.info({ runId: run_.id }, "Loop 2 started");

  const cfg = engineConfig.loop2;
  let totalTokens = 0;
  let succeeded = 0;
  let failed = 0;
  let assetsCreated = 0;
  const errors: string[] = [];

  try {
    const pending = await listAnswersNotYetInLoop2(cfg.maxAnswersPerRun);

    logger.info({ count: pending.length }, "Loop 2: answers to process");

    for (const { answer, question } of pending) {
      if (estimateCost(totalTokens) >= cfg.costBudgetUsd) {
        logger.warn({ budget: cfg.costBudgetUsd }, "Loop 2: cost budget reached — stopping");
        errors.push(`Cost budget $${cfg.costBudgetUsd} reached after ${succeeded + failed} answers`);
        break;
      }

      const result = await generateAssetsForAnswer(answer, question);
      totalTokens += result.tokensUsed;

      if (result.error) {
        failed++;
        errors.push(`Answer ${answer.id}: ${result.error}`);
      } else {
        succeeded++;
        assetsCreated += result.assetsCreated;
      }
    }

    const costEstimate = estimateCost(totalTokens);
    await finishLoopRun(run_.id, {
      itemsProcessed: succeeded + failed,
      costEstimate,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      error: errors.length > 0 ? errors.join("; ") : undefined,
    });

    logger.info({ runId: run_.id, succeeded, failed, assetsCreated, cost: costEstimate }, "Loop 2 completed");

    return { runId: run_.id, processed: succeeded + failed, succeeded, failed, assetsCreated, costEstimateUsd: costEstimate, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishLoopRun(run_.id, {
      itemsProcessed: 0,
      costEstimate: estimateCost(totalTokens),
      status: "failed",
      error: msg,
    });
    logger.error({ runId: run_.id, err: msg }, "Loop 2 failed");
    throw err;
  }
}
