import { logger } from "../../lib/logger.js";
import { readFbMetrics, readPublishedVariants, readAttribution, writeAttribution, readVoiceLibrary } from "./fileStore.js";
import type { AttributionEntry } from "./types.js";

export interface AttributionResult {
  entriesWritten: number;
  entriesSkipped: number;
  belowImpressions: number;
  tooFresh: number;
  /** @deprecated use belowImpressions + tooFresh instead */
  belowGate: number;
  errors: string[];
}

const MIN_IMPRESSIONS_GATE = parseInt(process.env["VOICE_LOOP_MIN_IMPRESSIONS"] ?? "500");
const MIN_POST_AGE_HOURS = parseInt(process.env["VOICE_LOOP_MIN_POST_AGE_HOURS"] ?? "24");

export async function runAttribution(opts: { dryRun?: boolean } = {}): Promise<AttributionResult> {
  const metricsFile = readFbMetrics();
  const publishedFile = readPublishedVariants();
  const attributionFile = readAttribution();

  let entriesWritten = 0;
  let entriesSkipped = 0;
  let belowImpressions = 0;
  let tooFresh = 0;
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
    const { post_id, variant_id, voice_id, hook_type, instagram_post_id, publishedAt } = published;

    /** Age gate: skip posts that haven't been live long enough to accumulate stable signal. */
    const postAgeHours = publishedAt
      ? (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60)
      : Infinity;
    if (postAgeHours < MIN_POST_AGE_HOURS) {
      logger.debug(
        { post_id, publishedAt, postAgeHours: Math.round(postAgeHours * 10) / 10, minAgeHours: MIN_POST_AGE_HOURS },
        "Voice Loop Station ②: post too fresh — skipping attribution"
      );
      tooFresh++;
      continue;
    }

    /** Try Facebook metrics first; fall back to Instagram metrics when absent. */
    const fbMetrics = metricsByPost.get(post_id);
    const igMetrics = instagram_post_id ? metricsByPost.get(instagram_post_id) : undefined;

    if (!fbMetrics && !igMetrics) {
      logger.debug({ post_id, instagram_post_id }, "Voice Loop Station ②: no FB or IG metrics for post — skipping attribution");
      entriesSkipped++;
      continue;
    }

    let reach: number;
    let impressions: number;
    let engagements: number;
    let link_clicks: number;
    let channel: "facebook" | "instagram";

    if (fbMetrics) {
      reach = fbMetrics["post_impressions_unique"] ?? fbMetrics["page_impressions_unique"] ?? 0;
      impressions = fbMetrics["post_impressions"] ?? fbMetrics["page_impressions"] ?? 0;
      engagements = fbMetrics["post_engaged_users"] ?? fbMetrics["page_post_engagements"] ?? 0;
      link_clicks = fbMetrics["post_clicks"] ?? 0;
      channel = "facebook";
    } else {
      /** IG metrics are stored with "ig_" prefix by Station ①. */
      reach = igMetrics!["ig_reach"] ?? 0;
      impressions = igMetrics!["ig_impressions"] ?? 0;
      engagements = igMetrics!["ig_total_interactions"] ?? 0;
      link_clicks = 0; // Instagram media insights do not surface link-click counts
      channel = "instagram";
      logger.debug({ post_id, instagram_post_id }, "Voice Loop Station ②: no FB metrics — attributing from Instagram signal");
    }

    const meetGate = impressions >= MIN_IMPRESSIONS_GATE;
    if (!meetGate) belowImpressions++;

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
      channel,
      ...(channel === "instagram" && instagram_post_id ? { instagram_post_id } : {}),
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

  logger.info(
    { entriesWritten, entriesSkipped, belowImpressions, tooFresh, dryRun: opts.dryRun },
    "Voice Loop Station ②: attribution complete"
  );
  return { entriesWritten, entriesSkipped, belowImpressions, tooFresh, belowGate: belowImpressions, errors };
}
