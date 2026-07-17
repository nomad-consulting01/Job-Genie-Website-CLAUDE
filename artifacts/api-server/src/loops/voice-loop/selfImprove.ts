import { randomUUID } from "crypto";
import { logger } from "../../lib/logger.js";
import {
  readVoiceLibrary,
  writeVoiceLibrary,
  readVoiceLedger,
  readSelfImproveProposals,
  writeSelfImproveProposals,
  appendVoiceChangelogEntry,
} from "./fileStore.js";
import type { SelfImprovementProposal, VoiceSpec } from "./types.js";

const MIN_IMPRESSIONS = parseInt(process.env["VOICE_LOOP_MIN_IMPRESSIONS"] ?? "500");
const LOSER_THRESHOLD = 0.35;
const WINNER_THRESHOLD = 0.70;

export interface SelfImproveResult {
  proposalId: string | null;
  underperformers: number;
  topPerformers: number;
  proposals: number;
  dryRun?: boolean;
}

export async function runVoiceLibrarySelfImprove(opts: { dryRun?: boolean } = {}): Promise<SelfImproveResult> {
  const ledger = readVoiceLedger();
  const voiceLib = readVoiceLibrary();

  const qualifiedArms = Object.entries(ledger.arms)
    .filter(([, arm]) => arm.impressions >= MIN_IMPRESSIONS && arm.status !== "retired")
    .map(([key, arm]) => ({ key, arm }));

  if (qualifiedArms.length === 0) {
    logger.info("Voice Loop Station ⑦: no arms with sufficient impressions — skipping self-improve");
    return { proposalId: null, underperformers: 0, topPerformers: 0, proposals: 0, dryRun: opts.dryRun };
  }

  const underperformers = qualifiedArms.filter(({ arm }) => arm.mean < LOSER_THRESHOLD);
  const topPerformers = qualifiedArms.filter(({ arm }) => arm.mean >= WINNER_THRESHOLD);

  const proposals: SelfImprovementProposal["proposals"] = [];

  for (const { key, arm } of underperformers) {
    proposals.push({
      action: "retire",
      voiceId: arm.voiceId,
      reason: `Arm ${key} has mean composite score ${arm.mean.toFixed(3)} (threshold: ${LOSER_THRESHOLD}) over ${arm.impressions} impressions. Consistently underperforms — proposing retirement.`,
    });
  }

  if (topPerformers.length >= 2) {
    const topTwo = topPerformers.sort((a, b) => b.arm.mean - a.arm.mean).slice(0, 2);
    const [first, second] = topTwo;
    const firstVoice = voiceLib.voices.find((v) => v.id === first.arm.voiceId);
    const secondVoice = voiceLib.voices.find((v) => v.id === second.arm.voiceId);

    if (firstVoice && secondVoice) {
      const spawnedId = `spawned_${firstVoice.id}_x_${secondVoice.id}_${Date.now()}`;
      const newVoice: VoiceSpec = {
        id: spawnedId,
        label: `${firstVoice.label} × ${secondVoice.label} (Hybrid)`,
        description: `Auto-spawned hybrid of top performers ${firstVoice.label} (mean: ${first.arm.mean.toFixed(3)}) and ${secondVoice.label} (mean: ${second.arm.mean.toFixed(3)}).`,
        active: false,
        samplingWeight: 0.5,
        hookTypes: [...new Set([...firstVoice.hookTypes, ...secondVoice.hookTypes])].slice(0, 3),
        generationInstructions: `Combine the following two proven styles:\n\n[Style A — ${firstVoice.label}]: ${firstVoice.generationInstructions}\n\n[Style B — ${secondVoice.label}]: ${secondVoice.generationInstructions}\n\nBlend both styles: open with Style A's hook approach, then transition to Style B's emotional resonance. Use specificity from both.`,
        bannedPhrases: [...new Set([...firstVoice.bannedPhrases, ...secondVoice.bannedPhrases])],
        brandVoiceChecks: [...new Set([...firstVoice.brandVoiceChecks, ...secondVoice.brandVoiceChecks])].slice(0, 4),
        beta: { alpha: 1.0, beta: 1.0 },
      };
      proposals.push({
        action: "spawn",
        voiceId: spawnedId,
        reason: `Top performers ${firstVoice.id} (${first.arm.mean.toFixed(3)}) and ${secondVoice.id} (${second.arm.mean.toFixed(3)}) suggest a hybrid may outperform. New voice spec included — starts inactive until human approval.`,
        newSpec: newVoice,
      });
    }
  }

  for (const { arm } of topPerformers.slice(0, 3)) {
    const voice = voiceLib.voices.find((v) => v.id === arm.voiceId);
    if (voice && voice.samplingWeight < 1.5) {
      proposals.push({
        action: "reweight",
        voiceId: arm.voiceId,
        reason: `${arm.voiceId} is a top performer (mean: ${arm.mean.toFixed(3)}) — increasing sampling weight from ${voice.samplingWeight} to ${Math.min(1.5, voice.samplingWeight + 0.2).toFixed(1)}.`,
        newWeight: Math.min(1.5, voice.samplingWeight + 0.2),
      });
    }
  }

  if (proposals.length === 0) {
    logger.info("Voice Loop Station ⑦: no actions to propose this week");
    return { proposalId: null, underperformers: underperformers.length, topPerformers: topPerformers.length, proposals: 0, dryRun: opts.dryRun };
  }

  const proposalId = randomUUID();
  const proposal: SelfImprovementProposal = {
    proposalId,
    proposedAt: new Date().toISOString(),
    evidence: {
      underperformers: underperformers.map(({ key, arm }) => ({ voiceId: arm.voiceId, armKey: key, mean: arm.mean, impressions: arm.impressions })),
      topPerformers: topPerformers.map(({ key, arm }) => ({ voiceId: arm.voiceId, armKey: key, mean: arm.mean, impressions: arm.impressions })),
    },
    proposals,
    status: "pending",
  };

  if (!opts.dryRun) {
    const propsFile = readSelfImproveProposals();
    propsFile.proposals.push(proposal);
    writeSelfImproveProposals(propsFile);

    const changelogEntry = `
## Weekly Self-Improve Proposal — ${new Date().toISOString().slice(0, 10)} (ID: ${proposalId})

**Status**: Pending human approval

### Evidence

**Under-performers** (mean < ${LOSER_THRESHOLD}):
${underperformers.map(({ key, arm }) => `- \`${key}\`: mean ${arm.mean.toFixed(3)} over ${arm.impressions} impressions`).join("\n") || "None"}

**Top performers** (mean ≥ ${WINNER_THRESHOLD}):
${topPerformers.map(({ key, arm }) => `- \`${key}\`: mean ${arm.mean.toFixed(3)} over ${arm.impressions} impressions`).join("\n") || "None"}

### Proposed Actions

${proposals.map((p, i) => `${i + 1}. **${p.action.toUpperCase()}** \`${p.voiceId}\`: ${p.reason}`).join("\n")}
`;
    appendVoiceChangelogEntry(changelogEntry);
  }

  logger.info({ proposalId, proposals: proposals.length, underperformers: underperformers.length, topPerformers: topPerformers.length, dryRun: opts.dryRun }, "Voice Loop Station ⑦: self-improve proposal created");

  return {
    proposalId,
    underperformers: underperformers.length,
    topPerformers: topPerformers.length,
    proposals: proposals.length,
    dryRun: opts.dryRun,
  };
}

export async function applySelfImproveProposal(proposalId: string, appliedBy: string): Promise<{ applied: boolean; reason?: string }> {
  const propsFile = readSelfImproveProposals();
  const proposal = propsFile.proposals.find((p) => p.proposalId === proposalId);
  if (!proposal) return { applied: false, reason: "Proposal not found" };
  if (proposal.status !== "pending") return { applied: false, reason: `Proposal is already ${proposal.status}` };

  const voiceLib = readVoiceLibrary();

  for (const action of proposal.proposals) {
    if (action.action === "retire") {
      const voice = voiceLib.voices.find((v) => v.id === action.voiceId);
      if (voice) voice.active = false;
    } else if (action.action === "spawn" && action.newSpec) {
      const existing = voiceLib.voices.find((v) => v.id === action.voiceId);
      if (!existing) voiceLib.voices.push(action.newSpec as VoiceSpec);
    } else if (action.action === "reweight" && action.newWeight !== undefined) {
      const voice = voiceLib.voices.find((v) => v.id === action.voiceId);
      if (voice) voice.samplingWeight = action.newWeight;
    }
  }

  voiceLib.updatedAt = new Date().toISOString();
  writeVoiceLibrary(voiceLib);

  proposal.status = "applied";
  proposal.appliedAt = new Date().toISOString();
  proposal.appliedBy = appliedBy;
  writeSelfImproveProposals(propsFile);

  appendVoiceChangelogEntry(`\n**Proposal ${proposalId} APPLIED** by ${appliedBy} on ${new Date().toISOString().slice(0, 10)}\n`);
  logger.info({ proposalId, appliedBy }, "Voice Loop Station ⑦: proposal applied");
  return { applied: true };
}

export async function dismissSelfImproveProposal(proposalId: string): Promise<{ dismissed: boolean; reason?: string }> {
  const propsFile = readSelfImproveProposals();
  const proposal = propsFile.proposals.find((p) => p.proposalId === proposalId);
  if (!proposal) return { dismissed: false, reason: "Proposal not found" };
  if (proposal.status !== "pending") return { dismissed: false, reason: `Proposal is already ${proposal.status}` };

  proposal.status = "dismissed";
  writeSelfImproveProposals(propsFile);
  appendVoiceChangelogEntry(`\n**Proposal ${proposalId} DISMISSED** on ${new Date().toISOString().slice(0, 10)}\n`);
  logger.info({ proposalId }, "Voice Loop Station ⑦: proposal dismissed");
  return { dismissed: true };
}
