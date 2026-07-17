import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  VoiceLibrary,
  FbMetricsFile,
  AttributionFile,
  VoiceLedgerFile,
  PublishedVariantsFile,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/** At runtime __dirname = dist/ inside the esbuild bundle;
 *  three levels up reaches the monorepo workspace root. */
const WORKSPACE_ROOT = resolve(__dirname, "../../../");

/** Validate at import time so misconfiguration is loud, not silent. */
if (!existsSync(WORKSPACE_ROOT)) {
  throw new Error(`[voice-loop/fileStore] WORKSPACE_ROOT not found: ${WORKSPACE_ROOT} — check bundle __dirname`);
}
// eslint-disable-next-line no-console
console.info(`[voice-loop/fileStore] WORKSPACE_ROOT = ${WORKSPACE_ROOT}`);

function dataPath(filename: string): string {
  return resolve(WORKSPACE_ROOT, "data", filename);
}

function contentPath(filename: string): string {
  return resolve(WORKSPACE_ROOT, "content", filename);
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(filePath);
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function readVoiceLibrary(): VoiceLibrary {
  const p = contentPath("voice-library.json");
  return readJson<VoiceLibrary>(p, {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    samplingPolicy: {
      exploitWeight: 0.75,
      exploreWeight: 0.25,
      minImpressionsGate: 500,
      compositeWeights: {
        w1_reach_rate: 0.25,
        w2_engagement_quality: 0.35,
        w3_on_brand_score: 0.15,
        w4_guardrail_risk: 0.15,
        w5_cta_action_rate: 0.10,
      },
    },
    voices: [],
  });
}

export function writeVoiceLibrary(lib: VoiceLibrary): void {
  writeJson(contentPath("voice-library.json"), lib);
}

export function readFbMetrics(): FbMetricsFile {
  return readJson<FbMetricsFile>(dataPath("fb-metrics-daily.json"), {
    _schema: "fb-metrics-daily-v1",
    _description: "Daily Facebook metrics",
    lastIngestAt: null,
    rows: [],
  });
}

export function writeFbMetrics(data: FbMetricsFile): void {
  writeJson(dataPath("fb-metrics-daily.json"), data);
}

export function readAttribution(): AttributionFile {
  return readJson<AttributionFile>(dataPath("variant-attribution.json"), {
    _schema: "variant-attribution-v1",
    _description: "Attribution join",
    lastRunAt: null,
    entries: [],
  });
}

export function writeAttribution(data: AttributionFile): void {
  writeJson(dataPath("variant-attribution.json"), data);
}

export function readVoiceLedger(): VoiceLedgerFile {
  return readJson<VoiceLedgerFile>(dataPath("voice-ledger.json"), {
    _schema: "voice-ledger-v1",
    _description: "Thompson-sampling Beta(α,β) per voice arm",
    lastUpdatedAt: null,
    samplingPolicy: null,
    arms: {},
  });
}

export function writeVoiceLedger(data: VoiceLedgerFile): void {
  writeJson(dataPath("voice-ledger.json"), data);
}

export function readPublishedVariants(): PublishedVariantsFile {
  return readJson<PublishedVariantsFile>(dataPath("published-variants.json"), {
    _schema: "published-variants-v1",
    _description: "post_id to variant_id mapping",
    lastUpdatedAt: null,
    entries: [],
  });
}

export function writePublishedVariants(data: PublishedVariantsFile): void {
  writeJson(dataPath("published-variants.json"), data);
}

export function readSelfImproveProposals(): { proposals: import("./types.js").SelfImprovementProposal[] } {
  return readJson(dataPath("self-improve-proposals.json"), { proposals: [] });
}

export function writeSelfImproveProposals(data: { proposals: import("./types.js").SelfImprovementProposal[] }): void {
  writeJson(dataPath("self-improve-proposals.json"), data);
}

export function appendVoiceChangelogEntry(entry: string): void {
  const p = resolve(WORKSPACE_ROOT, "docs", "voice-library-changelog.md");
  ensureDir(p);
  let existing = "";
  try {
    existing = readFileSync(p, "utf-8");
  } catch {
    existing = "# Voice Library Changelog\n\n";
  }
  writeFileSync(p, existing + "\n" + entry + "\n", "utf-8");
}
