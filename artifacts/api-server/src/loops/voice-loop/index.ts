export { runFbMetricsIngest } from "./fbMetrics.js";
export { runAttribution } from "./attribution.js";
export { runLedgerUpdate, getSamplingDraws, getPredictedScore } from "./ledger.js";
export { generateVoiceVariants } from "./variantGenerator.js";
export { runVoiceLibrarySelfImprove, applySelfImproveProposal, dismissSelfImproveProposal } from "./selfImprove.js";
export { readVoiceLibrary, readVoiceLedger, readFbMetrics, readAttribution, readPublishedVariants, readSelfImproveProposals } from "./fileStore.js";
export type { VoiceVariant, SelfImprovementProposal } from "./types.js";

import { logger } from "../../lib/logger.js";
import { runFbMetricsIngest } from "./fbMetrics.js";
import { runAttribution } from "./attribution.js";
import { runLedgerUpdate } from "./ledger.js";

/** Run stations ①②③ in sequence (daily cadence). No publishing. */
export async function runDailyMetricsPipeline(): Promise<{
  fbMetrics: Awaited<ReturnType<typeof runFbMetricsIngest>>;
  attribution: Awaited<ReturnType<typeof runAttribution>>;
  ledger: Awaited<ReturnType<typeof runLedgerUpdate>>;
}> {
  logger.info("Voice Loop: starting daily metrics pipeline (Stations ①②③)");

  const fbMetrics = await runFbMetricsIngest();
  const attribution = await runAttribution();
  const ledger = await runLedgerUpdate();

  logger.info({ fbMetrics, attribution, ledger }, "Voice Loop: daily metrics pipeline complete");
  return { fbMetrics, attribution, ledger };
}
