import { runGeo } from "./geo.js";
import { runReddit } from "./reddit.js";
import { runEmail } from "./email.js";
import { runLinkedIn } from "./linkedin.js";
import { runFacebook } from "./facebook.js";
import { startLoopRun, finishLoopRun } from "../../corpus/db.js";
import { engineConfig } from "../../config/engine.js";
import { logger } from "../../lib/logger.js";

export interface Loop4SubResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped?: number;
  queued?: number;
  slugs?: string[];
  errors: string[];
}

export interface Loop4RunResult {
  runId: number;
  geo: Loop4SubResult;
  reddit: Loop4SubResult;
  email: Loop4SubResult;
  linkedin: Loop4SubResult;
  facebook: Loop4SubResult;
  totalSucceeded: number;
  totalFailed: number;
  errors: string[];
}

export async function run(): Promise<Loop4RunResult> {
  const run_ = await startLoopRun("loop4");
  logger.info({ runId: run_.id }, "Loop 4 started");

  const cfg = engineConfig.loop4;
  let totalSucceeded = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  let geo: Loop4SubResult = { processed: 0, succeeded: 0, failed: 0, slugs: [], errors: [] };
  let reddit: Loop4SubResult = { processed: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
  let email: Loop4SubResult = { processed: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
  let linkedin: Loop4SubResult = { processed: 0, succeeded: 0, failed: 0, queued: 0, errors: [] };
  let facebook: Loop4SubResult = { processed: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };

  try {
    // GEO — always runs, no external deps
    logger.info("Loop 4: running GEO sub-engine");
    geo = await runGeo(cfg.maxItemsPerChannel);
    totalSucceeded += geo.succeeded;
    totalFailed += geo.failed;
    if (geo.errors.length > 0) allErrors.push(...geo.errors.map((e) => `[geo] ${e}`));

    // Reddit — graceful skip if no credentials
    logger.info("Loop 4: running Reddit sub-engine");
    reddit = await runReddit(cfg.maxItemsPerChannel);
    totalSucceeded += reddit.succeeded;
    totalFailed += reddit.failed;
    if (reddit.errors.length > 0) allErrors.push(...reddit.errors.map((e) => `[reddit] ${e}`));

    // Email — graceful skip if no credentials
    logger.info("Loop 4: running Email sub-engine");
    email = await runEmail(cfg.maxItemsPerChannel);
    totalSucceeded += email.succeeded;
    totalFailed += email.failed;
    if (email.errors.length > 0) allErrors.push(...email.errors.map((e) => `[email] ${e}`));

    // LinkedIn — queues for manual posting if no API token
    logger.info("Loop 4: running LinkedIn sub-engine");
    linkedin = await runLinkedIn(cfg.maxItemsPerChannel);
    totalSucceeded += linkedin.succeeded + (linkedin.queued ?? 0);
    totalFailed += linkedin.failed;
    if (linkedin.errors.length > 0) allErrors.push(...linkedin.errors.map((e) => `[linkedin] ${e}`));

    // Facebook — graceful skip if no credentials
    logger.info("Loop 4: running Facebook sub-engine");
    facebook = await runFacebook(cfg.maxItemsPerChannel);
    totalSucceeded += facebook.succeeded;
    totalFailed += facebook.failed;
    if (facebook.errors.length > 0) allErrors.push(...facebook.errors.map((e) => `[facebook] ${e}`));

    const hasErrors = totalFailed > 0;
    await finishLoopRun(run_.id, {
      itemsProcessed: totalSucceeded + totalFailed,
      costEstimate: 0, // Loop 4 uses no Claude
      status: hasErrors ? "completed_with_errors" : "completed",
      error: hasErrors ? allErrors.join("; ") : undefined,
    });

    logger.info(
      { runId: run_.id, totalSucceeded, totalFailed, geo, reddit: { ...reddit, errors: reddit.errors.length }, email: { ...email, errors: email.errors.length }, linkedin },
      "Loop 4 completed"
    );

    return { runId: run_.id, geo, reddit, email, linkedin, facebook, totalSucceeded, totalFailed, errors: allErrors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishLoopRun(run_.id, {
      itemsProcessed: totalSucceeded + totalFailed,
      costEstimate: 0,
      status: "failed",
      error: msg,
    });
    logger.error({ runId: run_.id, err: msg }, "Loop 4 failed");
    throw err;
  }
}
