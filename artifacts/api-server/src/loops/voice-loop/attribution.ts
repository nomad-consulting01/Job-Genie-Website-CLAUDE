import { logger } from "../../lib/logger.js";
import { readFbMetrics, readPublishedVariants, readAttribution, writeAttribution, readVoiceLibrary } from "./fileStore.js";
import type { AttributionEntry } from "./types.js";

export interface AttributionResult {
  entriesWritten: number;
  entriesSkipped: number;
  belowGate: number;
  errors: string[];
}

const MIN_IMPRESSIONS_GATE = parseInt(process.env["VOICE_LOOP_MIN_IMPRESSIONS"] ?? "500");

export async function runAttribution(opts: { dryRun?: boolean } = {}): Promise<AttributionResult> {
  const metricsFile = readFbMetrics();
  const publishedFile = readPublishedVariants();
  const attributionFile = readAttribution();

  let entriesWritten = 0;
  let entriesSkipped = 0;
  let belowGate = 0;
  const errors: string[] = [];

  const voiceLib = readVoiceLibrary();
  const voiceLabelMap = new Map(voiceLib.voices.map((v) => [v.id, v.label]));

  /** Use the LATEST snapshot per (post_id, metric) to avoid inflating lifetime
   *  totals that would result from summing multiple daily snapshots of the same cumulative counter. */
  const latestDateByPostMetric = new Map<string, string>();
  for (const row of metricsFile.rows) {
    const key = `${row.post_id}::${row.metric}`;
    const existing = latestDateByPostMetric.get(key);
    if (!existing || row.date > existing) latestDateByPostMetric.set(key, row.date);
  }

  const metricsByPost = new Map<string, Record<string, number>>();
  for (const row of metricsFile.rows) {
    const key = `${row.post_id}::${row.metric}`;
    if (latestDateByPostMetric.get(key) !== row.date) continue; // skip stale snapshots
    if (!metricsByPost.has(row.post_id)) metricsByPost.set(row.post_id, {});
    const map = metricsByPost.get(row.post_id)!;
    map[row.metric] = row.value; // assign, not sum
  }

  for (const published of publishedFile.entries) {
    const { post_id, variant_id, voice_id, hook_type } = published;

    const metrics = metricsByPost.get(post_id);
    if (!metrics) {
      logger.debug({ post_id }, "Voice Loop Station ②: no FB metrics for post — skipping attribution");
      entriesSkipped++;
      continue;
    }

    const reach = metrics["post_impressions_unique"] ?? metrics["page_impressions_unique"] ?? 0;
    const impressions = metrics["post_impressions"] ?? metrics["page_impressions"] ?? 0;
    const engagements = metrics["post_engaged_users"] ?? metrics["page_post_engagements"] ?? 0;
    const link_clicks = metrics["post_clicks"] ?? 0;

    const meetGate = impressions >= MIN_IMPRESSIONS_GATE;
    if (!meetGate) belowGate++;

    const engagement_rate = reach > 0 ? engagements / reach : 0;

    const entry: AttributionEntry = {
      post_id,
      variant_id,
      voice_id,
      voice_label: voiceLabelMap.get(voice_id) ?? voice_id,
      hook_type,
      topic: "career_advice",
      persona: "job_seekers",
      format: "blog_post",
      reach,
      impressions,
      engagements,
      link_clicks,
      engagement_rate,
      meets_impressions_gate: meetGate,
      attributedAt: new Date().toISOString(),
    };

    /** Upsert: overwrite stale attribution for same post_id so reruns recompute correctly. */
    const idx = attributionFile.entries.findIndex((e) => e.post_id === post_id);
    if (idx >= 0) {
      attributionFile.entries[idx] = entry;
      entriesWritten++;
    } else {
      attributionFile.entries.push(entry);
      entriesWritten++;
    }
  }

  if (!opts.dryRun) {
    attributionFile.lastRunAt = new Date().toISOString();
    writeAttribution(attributionFile);
  }

  logger.info({ entriesWritten, entriesSkipped, belowGate, dryRun: opts.dryRun }, "Voice Loop Station ②: attribution complete");
  return { entriesWritten, entriesSkipped, belowGate, errors };
}
