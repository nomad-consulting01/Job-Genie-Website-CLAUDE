import { logger } from "../../lib/logger.js";
import { readAttribution, readVoiceLedger, writeVoiceLedger, readVoiceLibrary } from "./fileStore.js";
import type { BanditArm, SamplingPolicy } from "./types.js";

export interface LedgerUpdateResult {
  armsUpdated: number;
  armsCreated: number;
  samplingPolicy: SamplingPolicy;
}

export interface SamplingDraw {
  voiceId: string;
  drawScore: number;
  isExplore: boolean;
}

const MIN_IMPRESSIONS = parseInt(process.env["VOICE_LOOP_MIN_IMPRESSIONS"] ?? "500");
const EXPLOIT_WEIGHT = parseFloat(process.env["VOICE_LOOP_EXPLOIT_WEIGHT"] ?? "0.75");

function armKey(voiceId: string, topic: string, persona: string, format: string): string {
  return `${voiceId}:${topic}:${persona}:${format}`;
}

function sampleBeta(alpha: number, beta: number): number {
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

function gammaSample(shape: number): number {
  if (shape < 1) {
    return gammaSample(1 + shape) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = Math.random() * 2 - 1;
      const u = Math.random();
      x = Math.log(u) * Math.sqrt(-2 * Math.log(u)) * x / Math.abs(x);
      v = Math.pow(1 + c * x, 3);
    } while (v <= 0);
    const u = Math.random();
    if (u < 1 - 0.0331 * Math.pow(x, 4)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function computeCompositeScore(
  engagement_rate: number,
  link_clicks: number,
  impressions: number,
  weights: SamplingPolicy["compositeWeights"]
): number {
  const reach_rate = Math.min(1, impressions > 0 ? engagement_rate : 0);
  const engagement_quality = Math.min(1, engagement_rate * 10);
  const on_brand_score = 0.7;
  const guardrail_risk = 0.0;
  const cta_action_rate = impressions > 0 ? Math.min(1, link_clicks / impressions) : 0;

  return (
    weights.w1_reach_rate * reach_rate +
    weights.w2_engagement_quality * engagement_quality +
    weights.w3_on_brand_score * on_brand_score -
    weights.w4_guardrail_risk * guardrail_risk +
    weights.w5_cta_action_rate * cta_action_rate
  );
}

export async function runLedgerUpdate(opts: { dryRun?: boolean } = {}): Promise<LedgerUpdateResult> {
  const attribution = readAttribution();
  const ledger = readVoiceLedger();
  const voiceLib = readVoiceLibrary();
  const policy = voiceLib.samplingPolicy;

  ledger.samplingPolicy = policy;

  const validEntries = attribution.entries.filter((e) => e.meets_impressions_gate);
  let armsUpdated = 0;
  let armsCreated = 0;

  for (const entry of validEntries) {
    const key = armKey(entry.voice_id, entry.topic, entry.persona, entry.format);
    const composite = computeCompositeScore(
      entry.engagement_rate,
      entry.link_clicks,
      entry.impressions,
      policy.compositeWeights
    );

    const IS_SUCCESS = composite >= 0.5;

    if (!ledger.arms[key]) {
      ledger.arms[key] = {
        voiceId: entry.voice_id,
        topic: entry.topic,
        persona: entry.persona,
        format: entry.format,
        alpha: 1.0,
        beta: 1.0,
        mean: 0.5,
        impressions: 0,
        status: "under_test",
        lastUpdatedAt: new Date().toISOString(),
      };
      armsCreated++;
    }

    const arm = ledger.arms[key];
    if (IS_SUCCESS) {
      arm.alpha += composite;
    } else {
      arm.beta += (1 - composite);
    }
    arm.impressions += entry.impressions;
    arm.mean = arm.alpha / (arm.alpha + arm.beta);
    arm.status = arm.impressions >= MIN_IMPRESSIONS ? "active" : "under_test";
    arm.lastUpdatedAt = new Date().toISOString();
    armsUpdated++;
  }

  const voices = voiceLib.voices.filter((v) => v.active);
  for (const voice of voices) {
    const key = armKey(voice.id, "career_advice", "job_seekers", "blog_post");
    if (!ledger.arms[key]) {
      ledger.arms[key] = {
        voiceId: voice.id,
        topic: "career_advice",
        persona: "job_seekers",
        format: "blog_post",
        alpha: 1.0,
        beta: 1.0,
        mean: 0.5,
        impressions: 0,
        status: "under_test",
        lastUpdatedAt: new Date().toISOString(),
      };
      armsCreated++;
    }
  }

  if (!opts.dryRun) {
    ledger.lastUpdatedAt = new Date().toISOString();
    writeVoiceLedger(ledger);
  }

  logger.info({ armsUpdated, armsCreated, totalArms: Object.keys(ledger.arms).length, dryRun: opts.dryRun }, "Voice Loop Station ③: ledger update complete");
  return { armsUpdated, armsCreated, samplingPolicy: policy };
}

export function getSamplingDraws(voiceIds: string[]): SamplingDraw[] {
  const ledger = readVoiceLedger();
  const voiceLib = readVoiceLibrary();
  const exploreWeight = parseFloat(process.env["VOICE_LOOP_EXPLORE_WEIGHT"] ?? String(1 - EXPLOIT_WEIGHT));

  const draws: SamplingDraw[] = voiceIds.map((voiceId) => {
    const key = armKey(voiceId, "career_advice", "job_seekers", "blog_post");
    const arm = ledger.arms[key];
    const voice = voiceLib.voices.find((v) => v.id === voiceId);

    const isUnderTest = !arm || arm.status === "under_test" || arm.impressions < MIN_IMPRESSIONS;
    const isExplore = isUnderTest || Math.random() < exploreWeight;

    const drawScore = arm
      ? (isExplore ? Math.random() : sampleBeta(arm.alpha, arm.beta))
      : (voice?.samplingWeight ?? 0.5);

    return { voiceId, drawScore, isExplore };
  });

  return draws.sort((a, b) => b.drawScore - a.drawScore);
}

export function getPredictedScore(voiceId: string): number | null {
  const ledger = readVoiceLedger();
  const key = armKey(voiceId, "career_advice", "job_seekers", "blog_post");
  const arm = ledger.arms[key];
  if (!arm || arm.impressions < MIN_IMPRESSIONS) return null;
  return arm.mean;
}
