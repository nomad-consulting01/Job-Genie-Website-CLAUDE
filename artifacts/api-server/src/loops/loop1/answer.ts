import { generateAnswer, evaluateAnswer, normaliseQuestion } from "../../integrations/claude.js";
import {
  insertAnswer,
  insertContentAsset,
  updateQuestionStatus,
} from "../../corpus/db.js";
import { engineConfig } from "../../config/engine.js";
import { logger } from "../../lib/logger.js";
import type { Question } from "@workspace/db";

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export interface AnswerPipelineResult {
  questionId: number;
  answerId: number | null;
  assetId: number | null;
  passed: boolean;
  score: number;
  issues: string[];
  tokensUsed: number;
}

export async function processQuestion(q: Question): Promise<AnswerPipelineResult> {
  const threshold = engineConfig.loop1.qualityScoreThreshold;
  let totalTokens = 0;

  const answer = await generateAnswer(q.normalisedQuestion);
  totalTokens += answer.tokensUsed;

  const evaluation = await evaluateAnswer(
    q.normalisedQuestion,
    answer.answerFirstBlock,
    answer.answerMd,
    threshold
  );
  totalTokens += evaluation.tokensUsed;

  if (!evaluation.passes) {
    logger.info(
      { questionId: q.id, score: evaluation.score, issues: evaluation.issues },
      "Answer failed quality gate — holding for manual review"
    );
    await updateQuestionStatus(q.id, "pending_review");
    return { questionId: q.id, answerId: null, assetId: null, passed: false, score: evaluation.score, issues: evaluation.issues, tokensUsed: totalTokens };
  }

  const savedAnswer = await insertAnswer({
    questionId: q.id,
    answerMd: answer.answerMd,
    answerFirstBlock: answer.answerFirstBlock,
    modelUsed: "claude-sonnet-4-6",
    qualityScore: evaluation.score,
  });

  await updateQuestionStatus(q.id, "answered");

  const slug = toSlug(q.normalisedQuestion);
  const asset = await insertContentAsset({
    answerId: savedAnswer.id,
    channel: "web_aeo",
    payloadJson: {
      slug,
      title: q.normalisedQuestion,
      answer_first_block: answer.answerFirstBlock,
      answer_md: answer.answerMd,
      pain_point_tags: q.painPointTags,
      source: q.source,
      source_url: q.sourceUrl ?? null,
    },
    status: "published",
    publishedAt: new Date(),
  });

  logger.info(
    { questionId: q.id, answerId: savedAnswer.id, slug, score: evaluation.score },
    "Q&A published to AEO corpus"
  );

  return {
    questionId: q.id,
    answerId: savedAnswer.id,
    assetId: asset.id,
    passed: true,
    score: evaluation.score,
    issues: [],
    tokensUsed: totalTokens,
  };
}

export async function processRawText(
  rawText: string
): Promise<{ normalisedQuestion: string; painPointTags: string[]; tokensUsed: number }> {
  return normaliseQuestion(rawText);
}
