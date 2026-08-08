import { enrichBlogPost } from "./enrich.js";
import { startLoopRun, finishLoopRun, listBlogPostsNotYetPublished } from "../../corpus/db.js";
import { engineConfig } from "../../config/engine.js";
import { logger } from "../../lib/logger.js";
import { generateAndSaveVoiceVariants } from "../voice-loop/generateAndSave.js";

export interface Loop3RunResult {
  runId: number;
  processed: number;
  succeeded: number;
  failed: number;
  slugs: string[];
  costEstimateUsd: number;
  errors: string[];
}

const USD_PER_M_INPUT = 3.0;
const USD_PER_M_OUTPUT = 15.0;
const AVG_OUTPUT_RATIO = 0.3;

function estimateCost(totalTokens: number): number {
  const inputTokens = totalTokens * (1 - AVG_OUTPUT_RATIO);
  const outputTokens = totalTokens * AVG_OUTPUT_RATIO;
  return (inputTokens * USD_PER_M_INPUT + outputTokens * USD_PER_M_OUTPUT) / 1_000_000;
}

export async function run(): Promise<Loop3RunResult> {
  const run_ = await startLoopRun("loop3");
  logger.info({ runId: run_.id }, "Loop 3 started");

  const cfg = engineConfig.loop3;
  let totalTokens = 0;
  let succeeded = 0;
  let failed = 0;
  const slugs: string[] = [];
  const errors: string[] = [];

  try {
    const pending = await listBlogPostsNotYetPublished(cfg.maxPostsPerRun);
    logger.info({ count: pending.length }, "Loop 3: blog posts to enrich");

    for (const { asset, answer, question } of pending) {
      if (estimateCost(totalTokens) >= cfg.costBudgetUsd) {
        logger.warn({ budget: cfg.costBudgetUsd }, "Loop 3: cost budget reached — stopping");
        errors.push(`Cost budget $${cfg.costBudgetUsd} reached after ${succeeded + failed} posts`);
        break;
      }

      const result = await enrichBlogPost(asset, answer, question, cfg.cannibalThreshold);
      totalTokens += result.tokensUsed;

      if (result.error) {
        failed++;
        errors.push(`Asset ${asset.id}: ${result.error}`);
      } else {
        succeeded++;
        slugs.push(result.slug);
        setImmediate(() => {
          generateAndSaveVoiceVariants({
            assetId: asset.id,
            answerId: answer.id,
            slug: result.slug,
            question: question.normalisedQuestion,
            answerMd: answer.answerMd,
            seoTitle: String((asset.engagementMetricsJson as Record<string, unknown> | null)?.["seoTitle"] ?? question.normalisedQuestion),
          }).catch((err: unknown) => {
            logger.warn({ assetId: asset.id, err }, "Loop 3: background voice variant generation failed — non-blocking");
          });
        });
      }
    }

    const costEstimate = estimateCost(totalTokens);
    await finishLoopRun(run_.id, {
      itemsProcessed: succeeded + failed,
      costEstimate,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      error: errors.length > 0 ? errors.join("; ") : undefined,
    });

    logger.info({ runId: run_.id, succeeded, failed, slugs, cost: costEstimate }, "Loop 3 completed");
    return { runId: run_.id, processed: succeeded + failed, succeeded, failed, slugs, costEstimateUsd: costEstimate, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishLoopRun(run_.id, {
      itemsProcessed: 0,
      costEstimate: estimateCost(totalTokens),
      status: "failed",
      error: msg,
    });
    logger.error({ runId: run_.id, err: msg }, "Loop 3 failed");
    throw err;
  }
}
