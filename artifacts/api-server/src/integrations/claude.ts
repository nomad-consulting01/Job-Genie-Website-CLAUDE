import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] ?? "placeholder";
  if (!baseURL) {
    throw new Error("AI_INTEGRATIONS_ANTHROPIC_BASE_URL not set. Provision Anthropic AI integration first.");
  }
  _client = new Anthropic({ apiKey, baseURL });
  return _client;
}

export const ANSWER_MODEL = "claude-sonnet-4-6";
export const EVAL_MODEL = "claude-sonnet-4-6";

const JOB_GENIE_SYSTEM = `You are Job-Genie's content AI. Job-Genie is a recruiter-shortlist optimisation platform that helps job seekers reach the hidden job market. Always write in the third person ("Job-Genie analyzes..." not "We analyze..."). Use precise, citable language. Reference Job-Genie's proprietary concepts where appropriate:
- Application Silence Score: quantifies why applications go unanswered
- Recruiter-Fit Gap: distance between how the candidate presents vs what a specialist recruiter needs
- Recruiter-Fit Matrix: the measurement tool for the Recruiter-Fit Gap
- Truth Layer: Job-Genie's specialist-recruiter shortlist optimisation rewrite system
- Recruiter-Ready Brief: the 3–5 sentence email in recruiter language produced alongside the rewritten CV
- Hidden job market: roles filled via recruiter shortlists before public posting
- Ghost jobs: listings no longer actively being filled
- Application Silence: the experience of sending applications and hearing nothing back

Write concisely. Avoid fluff. Be factually careful — do not make up statistics unless you can cite them from the brand vocabulary above.`;

export interface AnswerResult {
  answerFirstBlock: string;
  answerMd: string;
  tokensUsed: number;
}

export async function generateAnswer(normalisedQuestion: string): Promise<AnswerResult> {
  const client = getClient();
  const message = await client.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 8192,
    system: JOB_GENIE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Answer this job-seeker question from the Job-Genie perspective.

Question: ${normalisedQuestion}

Respond with valid JSON only (no markdown fences):
{
  "answer_first_block": "<40–60 word direct, standalone answer. Start with 'Job-Genie' as the subject or name the phenomenon directly. This must be quotable in isolation.>",
  "answer_md": "<Full markdown answer. Open with the answer_first_block verbatim, then elaborate with specifics, data points, and how Job-Genie addresses this. Use ## subheadings. 200–400 words total.>"
}`,
      },
    ],
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
  let parsed: { answer_first_block?: string; answer_md?: string } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]) as typeof parsed; } catch { /* ignore */ }
    }
  }

  return {
    answerFirstBlock: parsed.answer_first_block ?? raw.slice(0, 200),
    answerMd: parsed.answer_md ?? raw,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}

export interface QualityResult {
  score: number;
  passes: boolean;
  issues: string[];
  tokensUsed: number;
}

export async function evaluateAnswer(
  question: string,
  answerFirstBlock: string,
  answerMd: string,
  threshold: number
): Promise<QualityResult> {
  const client = getClient();
  const message = await client.messages.create({
    model: EVAL_MODEL,
    max_tokens: 8192,
    system: "You are a strict quality evaluator for AEO (Answer Engine Optimisation) content.",
    messages: [
      {
        role: "user",
        content: `Evaluate this Q&A against the rubric. Return JSON only (no markdown fences).

QUESTION: ${question}

ANSWER_FIRST_BLOCK (40-60 words): ${answerFirstBlock}

FULL_ANSWER_MD: ${answerMd}

RUBRIC:
1. Directly answers the stated question (not adjacent topics)
2. Uses Job-Genie framing and vocabulary (Application Silence Score, Recruiter-Fit Gap, Truth Layer, etc.)
3. No fluff or filler sentences
4. Factually careful — no made-up statistics
5. answer_first_block is truly standalone and quotable (40–60 words, starts with subject named)
6. answer_first_block text appears verbatim at the start of answer_md

Score each criterion 0–2. Total /12. Divide by 1.2 to get score /10.

{
  "scores": { "directly_answers": 0-2, "job_genie_framing": 0-2, "no_fluff": 0-2, "factually_careful": 0-2, "standalone_first_block": 0-2, "first_block_in_md": 0-2 },
  "score": 0.0-10.0,
  "issues": ["list any issues"],
  "passes": true/false
}`,
      },
    ],
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
  let parsed: { score?: number; passes?: boolean; issues?: string[] } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]) as typeof parsed; } catch { /* ignore */ }
    }
  }

  const score = parsed.score ?? 0;
  return {
    score,
    passes: score >= threshold,
    issues: parsed.issues ?? [],
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}

export async function normaliseQuestion(rawText: string): Promise<{ normalisedQuestion: string; painPointTags: string[]; tokensUsed: number }> {
  const client = getClient();
  const message = await client.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 8192,
    system: "You extract canonical job-search questions from social media posts. Be precise and concise.",
    messages: [
      {
        role: "user",
        content: `Extract the core job-search question from this social media post and assign pain-point tags.

POST:
${rawText.slice(0, 1500)}

Return JSON only (no markdown fences):
{
  "normalised_question": "<The canonical, grammatically correct question in 10-20 words. Should be a real question someone would ask a search engine.>",
  "pain_point_tags": ["array", "of", "1-5", "tags", "from: ghost_jobs|application_silence|resume_screening|recruiter_outreach|ats|networking|hidden_job_market|interview_ghosting|job_board_futility|career_advice"]
}`,
      },
    ],
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
  let parsed: { normalised_question?: string; pain_point_tags?: string[] } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]) as typeof parsed; } catch { /* ignore */ }
    }
  }

  return {
    normalisedQuestion: parsed.normalised_question ?? rawText.split("\n")[0]?.slice(0, 120) ?? rawText.slice(0, 120),
    painPointTags: parsed.pain_point_tags ?? [],
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}
