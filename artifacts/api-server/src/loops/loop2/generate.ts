import { generateLoop2Content } from "../../integrations/claude.js";
import { insertContentAsset } from "../../corpus/db.js";
import { logger } from "../../lib/logger.js";
import type { Loop2Channel } from "../../config/engine.js";
import type { Answer, Question } from "@workspace/db";

export interface Loop2GenerateResult {
  answerId: number;
  questionId: number;
  assetsCreated: number;
  tokensUsed: number;
  error?: string;
}

const CHANNELS: Loop2Channel[] = ["newsletter", "blog_post", "linkedin", "email_nurture"];

export async function generateAssetsForAnswer(
  answer: Answer,
  question: Question
): Promise<Loop2GenerateResult> {
  let totalTokens = 0;
  let assetsCreated = 0;

  try {
    // Generate both variants in parallel — 2 Claude calls per answer
    const [standardResult, drResult] = await Promise.all([
      generateLoop2Content(question.normalisedQuestion, answer.answerMd, "standard"),
      generateLoop2Content(question.normalisedQuestion, answer.answerMd, "direct_response"),
    ]);

    totalTokens += standardResult.tokensUsed + drResult.tokensUsed;

    // Persist all 8 assets (4 channels × 2 variants) to DB
    const inserts: Promise<unknown>[] = [];

    for (const channel of CHANNELS) {
      const standardPayload = buildPayload(channel, "standard", standardResult, question);
      const drPayload = buildPayload(channel, "direct_response", drResult, question);

      inserts.push(
        insertContentAsset({
          answerId: answer.id,
          channel,
          variant: "standard",
          payloadJson: standardPayload,
          status: "published",
          publishedAt: new Date(),
        })
      );

      inserts.push(
        insertContentAsset({
          answerId: answer.id,
          channel,
          variant: "direct_response",
          payloadJson: drPayload,
          status: "published",
          publishedAt: new Date(),
        })
      );
    }

    await Promise.all(inserts);
    assetsCreated = CHANNELS.length * 2; // 8 total

    logger.info(
      { answerId: answer.id, questionId: question.id, assetsCreated },
      "Loop 2: assets generated"
    );

    return { answerId: answer.id, questionId: question.id, assetsCreated, tokensUsed: totalTokens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ answerId: answer.id, questionId: question.id, err: msg }, "Loop 2: failed to generate assets");
    return { answerId: answer.id, questionId: question.id, assetsCreated, tokensUsed: totalTokens, error: msg };
  }
}

function buildPayload(
  channel: Loop2Channel,
  variant: "standard" | "direct_response",
  result: { newsletter: string; blog_post: string; linkedin: string; email_nurture: string },
  question: Question
): Record<string, unknown> {
  const contentMap: Record<Loop2Channel, string> = {
    newsletter: result.newsletter,
    blog_post: result.blog_post,
    linkedin: result.linkedin,
    email_nurture: result.email_nurture,
  };

  return {
    channel,
    variant,
    question: question.normalisedQuestion,
    pain_point_tags: question.painPointTags,
    source_url: question.sourceUrl ?? null,
    content: contentMap[channel],
    generated_at: new Date().toISOString(),
  };
}
