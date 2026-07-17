import { randomUUID } from "crypto";
import { logger } from "../../lib/logger.js";
import { readVoiceLibrary } from "./fileStore.js";
import { getSamplingDraws, getPredictedScore } from "./ledger.js";
import { runGuardrails } from "./guardrails.js";
import { generateVoiceVariantCopy } from "../../integrations/claude.js";
import type { VoiceVariant } from "./types.js";

const BUDGET_USD = parseFloat(process.env["VOICE_LOOP_BUDGET_USD"] ?? "2.00");
const CLAUDE_COST_PER_1K_INPUT = 0.003;
const CLAUDE_COST_PER_1K_OUTPUT = 0.015;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * CLAUDE_COST_PER_1K_INPUT + (outputTokens / 1000) * CLAUDE_COST_PER_1K_OUTPUT;
}

export interface VariantGenerateResult {
  variants: VoiceVariant[];
  autoRejected: number;
  budgetUsedUsd: number;
  budgetCapHit: boolean;
  errors: string[];
}

export async function generateVoiceVariants(
  blogPost: {
    assetId: number;
    slug: string;
    question: string;
    answerMd: string;
    seoTitle: string;
  },
  opts: { dryRun?: boolean } = {}
): Promise<VariantGenerateResult> {
  const voiceLib = readVoiceLibrary();
  const activeVoices = voiceLib.voices.filter((v) => v.active);

  /** Thompson sampling draws sorted descending by score — generate one variant per active voice,
   *  ordered so the admin sees the highest-ranked arm first. Bandit weights bias approval/publish
   *  priority, not coverage — every seed voice gets a fair generation slot. */
  const draws = getSamplingDraws(activeVoices.map((v) => v.id));

  const variants: VoiceVariant[] = [];
  let autoRejected = 0;
  let budgetUsedUsd = 0;
  let budgetCapHit = false;
  const errors: string[] = [];

  for (const draw of draws) {
    const voice = activeVoices.find((v) => v.id === draw.voiceId);
    if (!voice) continue;

    const estimatedCost = estimateCost(2000, 800);
    if (budgetUsedUsd + estimatedCost > BUDGET_USD) {
      budgetCapHit = true;
      logger.warn({ voiceId: voice.id, budgetUsedUsd, BUDGET_USD }, "Voice Loop Station ④: budget cap reached — halting variant generation");
      break;
    }

    let bodyText = "";
    let tokensUsed = { input: 0, output: 0 };

    if (opts.dryRun) {
      bodyText = `[DRY RUN — ${voice.label}] This is a placeholder body text for the ${voice.label} voice. In a real run, Claude would generate a full blog variant here based on the post "${blogPost.seoTitle}". Hook type: ${voice.hookTypes[0]}. Generation instructions would be applied: ${voice.generationInstructions.slice(0, 120)}...`;
      tokensUsed = { input: 800, output: 300 };
    } else {
      try {
        const result = await generateVoiceVariantCopy({
          voiceLabel: voice.label,
          generationInstructions: voice.generationInstructions,
          question: blogPost.question,
          answerMd: blogPost.answerMd,
          seoTitle: blogPost.seoTitle,
        });
        bodyText = result.copy;
        tokensUsed = { input: result.inputTokens ?? 800, output: result.outputTokens ?? 300 };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Voice ${voice.id}: ${msg}`);
        logger.error({ voiceId: voice.id, err: msg }, "Voice Loop Station ④: generation failed");
        continue;
      }
    }

    const cost = estimateCost(tokensUsed.input, tokensUsed.output);
    budgetUsedUsd += cost;

    const guardrail = runGuardrails(bodyText, voice);
    const predictedScore = getPredictedScore(voice.id);

    const variantId = randomUUID();
    const variant: VoiceVariant = {
      variantId,
      voiceId: voice.id,
      voiceLabel: voice.label,
      blogPostAssetId: blogPost.assetId,
      blogPostSlug: blogPost.slug,
      topic: "career_advice",
      persona: "job_seekers",
      format: "blog_post",
      generatedAt: new Date().toISOString(),
      bodyText,
      hookType: voice.hookTypes[0] ?? "unknown",
      predictedScore,
      guardrail,
      status: guardrail.passed ? "pending" : "rejected",
      ...(guardrail.passed ? {} : { rejectReason: guardrail.failReasons.join("; ") }),
    };

    if (!guardrail.passed) {
      autoRejected++;
      logger.warn(
        { variantId, voiceId: voice.id, reasons: guardrail.failReasons },
        "Voice Loop Station ④: variant auto-rejected by guardrails"
      );
    }

    variants.push(variant);
    logger.info(
      { variantId, voiceId: voice.id, guardrailPassed: guardrail.passed, isExplore: draw.isExplore },
      "Voice Loop Station ④: variant generated"
    );
  }

  return { variants, autoRejected, budgetUsedUsd, budgetCapHit, errors };
}
