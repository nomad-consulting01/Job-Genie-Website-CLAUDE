import Anthropic from "@anthropic-ai/sdk";
import type { Loop2Channel } from "../config/engine.js";

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

const DIRECT_RESPONSE_SYSTEM = `You are a direct-response copywriter for Job-Genie — a recruiter-shortlist optimisation engine that helps job seekers escape Application Silence and reach the hidden job market.

Every sentence must move the reader through: Attention → Curiosity → Belief Shift → Desire → Urgency → Action.

Rules:
- Bold, direct, commercially minded tone — not pleasant, not corporate
- Short paragraphs (1–3 sentences max)
- Direct address: "you," "your," "I"
- Name a clear enemy: broken job boards, spray-and-pray applications, ATS black holes, ghost jobs
- Reveal the hidden mechanism: specialist recruiters shortlist candidates who match the client brief, use the right keywords, quantify relevant evidence, and apply to active recruiter-held listings — not the biggest job boards
- Never position Job-Genie as "just a tool." It's a recruiter-shortlist optimisation engine / mechanism / blueprint / system
- No passive language. No vague advice. Every sentence earns its place
- Include a CTA that creates mild urgency without being dishonest

Job-Genie proprietary vocabulary:
- Application Silence Score: quantifies why applications go unanswered
- Recruiter-Fit Gap: the distance between how the candidate presents vs what a specialist recruiter actually needs to shortlist
- Truth Layer: Job-Genie's shortlist optimisation rewrite system
- Recruiter-Ready Brief: 3–5 sentence email in recruiter language produced alongside the rewritten CV
- Ghost jobs: listings no longer actively being filled
- Hidden job market: roles filled via recruiter shortlists before public posting`;

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

// ─── Loop 3: Blog SEO metadata generation ────────────────────────────────────

export interface BlogMetaResult {
  slug: string;
  seoTitle: string;
  metaDescription: string;
  readTimeMinutes: number;
  faqJsonLd: Record<string, unknown>;
  tokensUsed: number;
}

export async function generateBlogMeta(
  question: string,
  answerFirstBlock: string,
  blogContent: string
): Promise<BlogMetaResult> {
  const client = getClient();
  const wordCount = blogContent.split(/\s+/).length;
  const estimatedReadTime = Math.max(1, Math.round(wordCount / 230));

  const message = await client.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 2048,
    system: "You are an SEO specialist for Job-Genie. Generate precise, search-optimised metadata for blog posts. Return only valid JSON — no markdown fences.",
    messages: [
      {
        role: "user",
        content: `Generate SEO metadata for this Job-Genie blog post.

QUESTION: ${question}

ANSWER SUMMARY: ${answerFirstBlock.slice(0, 300)}

BLOG CONTENT (first 800 chars): ${blogContent.slice(0, 800)}

ESTIMATED READ TIME: ${estimatedReadTime} minutes

Return JSON only (no markdown fences):
{
  "slug": "<url-safe slug, max 60 chars, derived from the question — lowercase, hyphens only, no stop words>",
  "seo_title": "<50-65 char title ending with ' | Job Genie'>",
  "meta_description": "<150-160 char compelling meta description — includes the core answer concept and a subtle CTA>",
  "faq_json_ld": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "<the question verbatim>",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "<the answer first block verbatim>"
        }
      }
    ]
  }
}`,
      },
    ],
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
  let parsed: {
    slug?: string;
    seo_title?: string;
    meta_description?: string;
    faq_json_ld?: Record<string, unknown>;
  } = {};

  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]) as typeof parsed; } catch { /* ignore */ }
    }
  }

  const slug = (parsed.slug ?? question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60));

  return {
    slug,
    seoTitle: parsed.seo_title ?? `${question.slice(0, 50)} | Job Genie`,
    metaDescription: parsed.meta_description ?? answerFirstBlock.slice(0, 155),
    readTimeMinutes: estimatedReadTime,
    faqJsonLd: parsed.faq_json_ld ?? {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answerFirstBlock } }],
    },
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}

// ─── Loop 2: Multi-channel content generation ───────────────────────────────

export interface Loop2ContentResult {
  newsletter: string;
  blog_post: string;
  linkedin: string;
  email_nurture: string;
  tokensUsed: number;
}

const CHANNEL_INSTRUCTIONS_STANDARD = `
Generate four content assets for the following job-search question and expert answer. Return valid JSON only (no markdown fences).

QUESTION: {QUESTION}

EXPERT ANSWER:
{ANSWER}

Produce these four assets:

1. newsletter (150–250 words): An informative newsletter section. Start with the question as a bold heading. Answer clearly using Job-Genie vocabulary. End with a soft CTA to try Job-Genie.

2. blog_post (600–900 words markdown): A full SEO blog post. Include: H1 title, intro paragraph, 3–4 ## subheadings with useful content, a "How Job-Genie helps" section, and a closing CTA. Use the expert answer as the factual foundation. No fluff.

3. linkedin (100–200 words): A LinkedIn post. Bold first line (stops the scroll). Short punchy paragraphs. Insight from the question. Specific takeaway. End with a soft question to drive comments and a link mention.

4. email_nurture (3-email drip sequence as JSON array): Each email has: subject, preview_text, body (150–200 words), cta_text, cta_url ("/"). Email 1: identify the pain. Email 2: reveal the mechanism. Email 3: present Job-Genie as the solution.

Return:
{
  "newsletter": "...",
  "blog_post": "...",
  "linkedin": "...",
  "email_nurture": [{ "subject": "...", "preview_text": "...", "body": "...", "cta_text": "...", "cta_url": "/" }, ...]
}`;

const CHANNEL_INSTRUCTIONS_DR = `
Generate four DIRECT-RESPONSE content assets for the following job-search question and expert answer. Return valid JSON only (no markdown fences).

QUESTION: {QUESTION}

EXPERT ANSWER:
{ANSWER}

Apply these direct-response rules to ALL four assets:
- Attention → Curiosity → Belief Shift → Desire → Urgency → Action
- Name the enemy (broken job boards / ATS black holes / ghost jobs / spray-and-pray)
- Reveal the hidden mechanism (specialist recruiters shortlist on brief match + keywords + quantified evidence)
- Short paragraphs, direct address ("you", "your"), strong verbs
- Never call Job-Genie "just a tool" — it's a recruiter-shortlist optimisation engine
- Bold power phrases. No passive voice. No corporate tone.

1. newsletter (150–250 words): Hook first line. Agitate the pain from the question. Reveal the mechanism. Introduce Job-Genie as the engine. CTA with mild urgency.

2. blog_post (600–900 words markdown): H1 is a contrarian hook. Intro names the enemy and agitates. ## sections: name the real problem, expose why conventional advice fails, reveal the hidden mechanism, introduce Job-Genie as the system. Closing CTA with urgency.

3. linkedin (100–200 words): First line stops the scroll with a bold claim or pattern interrupt. Agitate. Mechanism. Takeaway. CTA.

4. email_nurture (3-email drip sequence as JSON array): Each email has: subject (curiosity-driven), preview_text, body (150–200 words), cta_text, cta_url ("/"). Email 1: agitate the pain. Email 2: destroy the false belief / reveal enemy. Email 3: present Job-Genie as the mechanism with urgency.

Return:
{
  "newsletter": "...",
  "blog_post": "...",
  "linkedin": "...",
  "email_nurture": [{ "subject": "...", "preview_text": "...", "body": "...", "cta_text": "...", "cta_url": "/" }, ...]
}`;

// ─── Meta Ads + Instagram marketing copy (Direct-Response Growth Engine) ─────

const META_INSTAGRAM_SYSTEM = `You are an elite direct-response copywriter, offer strategist, and paid-social creative strategist working on Job-Genie's Meta Ads + Instagram Marketing Operating System.

Job-Genie context — ground all copy in this product understanding:
Job-Genie.ai is an AI-powered job search and resume analysis platform focused on specialist recruiter listings, not general job boards or direct employer ATS listings.
- Access to specialist recruiter and staffing-firm listings, AI resume analysis, resume-to-role matching, active listing validation, resume tailoring, full rewrites, and recruiter-ready application workflows.
- Enemy options: broken job boards, spray-and-pray applications, generic resumes, ATS black holes, recruiter invisibility, outdated job-search advice.
- Hidden mechanism: specialist recruiters shortlist candidates who clearly match the client brief, use the right keywords, quantify relevant evidence, and apply to active recruiter-held listings.

Rules:
- Move the reader through Attention → Curiosity → Belief Shift → Desire → Urgency → Action.
- Bold, commercially minded, conversational tone. Short paragraphs, strong verbs, direct address.
- Never invent testimonials, statistics, guarantees, deadlines, or results. If proof would strengthen a claim, write "Proof needed: [describe]".
- Make copy native to each platform. Treat the first frame as part of the headline.
- Do not imply personal attributes in ways that violate Meta's advertising policies.`;

const META_INSTAGRAM_INSTRUCTIONS = `Create ready-to-publish direct-response social copy for this job-search topic and expert answer. Return valid JSON only (no markdown fences, no commentary).

QUESTION: {QUESTION}

EXPERT ANSWER:
{ANSWER}

Produce ONE strong, publish-ready post for EACH platform.

META (Facebook / Instagram feed ad — "meta"):
- "copy": Longer-form, link-friendly, conversational primary text — 3 to 6 short paragraphs. Move the reader Attention → Curiosity → Belief Shift → Desire → Urgency → Action. Name the enemy (ghost jobs, ATS black holes, spray-and-pray applications, recruiter invisibility). It is fine to reference clicking the link or claiming the free Application Autopsy directly.
- "hashtags": 4 to 8 relevant, non-spammy hashtags.
- "cta": A short call-to-action button phrase (e.g. "Get My Free Autopsy").

INSTAGRAM (organic caption — "instagram"):
- "copy": Shorter and hook-first. Open with a scroll-stopping first line, then punchy high-energy lines with line breaks for readability. NO raw URLs — reference the link in bio instead. End by prompting saves / shares / DMs.
- "hashtags": 8 to 15 relevant hashtags.
- "cta": A short call-to-action that references the link in bio (e.g. "Link in bio for your free Application Autopsy").

Rules:
- Never invent testimonials, statistics, guarantees, deadlines, or results. If proof would strengthen a claim, write "Proof needed: [describe]".
- Ground everything in Job-Genie's specialist-recruiter mechanism, enemy, and audience.
- Do not imply personal attributes in ways that violate Meta's advertising policies.

Return exactly this shape:
{
  "meta": { "copy": "<text>", "hashtags": ["...", "..."], "cta": "<text>" },
  "instagram": { "copy": "<text>", "hashtags": ["...", "..."], "cta": "<text>" }
}`;

export interface MarketingVariant {
  copy: string;
  hashtags: string[];
  cta: string;
}

export interface MetaInstagramResult {
  meta: MarketingVariant;
  instagram: MarketingVariant;
  tokensUsed: number;
}

/** Coerce a parsed variant into a clean {copy, hashtags[], cta} shape. */
function normaliseVariant(v: unknown): MarketingVariant {
  const o = (v ?? {}) as Record<string, unknown>;
  const copy = typeof o["copy"] === "string" ? o["copy"].trim() : "";
  const cta = typeof o["cta"] === "string" ? o["cta"].trim() : "";
  let hashtags: string[] = [];
  const h = o["hashtags"];
  if (Array.isArray(h)) hashtags = h.map((x) => String(x).trim()).filter(Boolean);
  else if (typeof h === "string") hashtags = h.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  hashtags = hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`));
  return { copy, hashtags, cta };
}

export async function generateMetaInstagramCopy(
  question: string,
  answerMd: string
): Promise<MetaInstagramResult> {
  const client = getClient();
  const userPrompt = META_INSTAGRAM_INSTRUCTIONS
    .replace("{QUESTION}", question)
    .replace("{ANSWER}", answerMd.slice(0, 2000));

  const message = await client.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 8192,
    system: META_INSTAGRAM_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
  let parsed: { meta?: unknown; instagram?: unknown } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]) as typeof parsed; } catch { /* ignore */ }
    }
  }

  return {
    meta: normaliseVariant(parsed.meta),
    instagram: normaliseVariant(parsed.instagram),
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}

export async function generateLoop2Content(
  question: string,
  answerMd: string,
  variant: "standard" | "direct_response"
): Promise<Loop2ContentResult> {
  const client = getClient();
  const systemPrompt = variant === "direct_response" ? DIRECT_RESPONSE_SYSTEM : JOB_GENIE_SYSTEM;
  const instructions = variant === "direct_response" ? CHANNEL_INSTRUCTIONS_DR : CHANNEL_INSTRUCTIONS_STANDARD;

  const userPrompt = instructions
    .replace("{QUESTION}", question)
    .replace("{ANSWER}", answerMd.slice(0, 2000));

  const message = await client.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
  let parsed: {
    newsletter?: string;
    blog_post?: string;
    linkedin?: string;
    email_nurture?: unknown;
  } = {};

  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]) as typeof parsed; } catch { /* ignore */ }
    }
  }

  const emailNurture = Array.isArray(parsed.email_nurture)
    ? JSON.stringify(parsed.email_nurture)
    : typeof parsed.email_nurture === "string"
    ? parsed.email_nurture
    : "[]";

  return {
    newsletter: parsed.newsletter ?? "",
    blog_post: parsed.blog_post ?? "",
    linkedin: parsed.linkedin ?? "",
    email_nurture: emailNurture,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}

export interface VoiceVariantCopyResult {
  copy: string;
  inputTokens: number;
  outputTokens: number;
}

export async function generateVoiceVariantCopy(params: {
  voiceLabel: string;
  generationInstructions: string;
  question: string;
  answerMd: string;
  seoTitle: string;
}): Promise<VoiceVariantCopyResult> {
  const client = getClient();

  const system = `You are a specialised blog copywriter for Job-Genie — a recruiter-shortlist optimisation engine that helps job seekers reach the hidden job market.

You will be given a specific voice/style to write in, with detailed instructions. Follow them precisely.

Job-Genie core concepts:
- Application Silence Score: quantifies why applications go unanswered
- Recruiter-Fit Gap: distance between how a candidate presents vs what a specialist recruiter needs
- Truth Layer: Job-Genie's shortlist optimisation rewrite system
- Hidden job market: roles filled via recruiter shortlists before public posting
- Ghost jobs: listings no longer actively being filled

Return ONLY the blog post body text — no headings, no meta commentary, no JSON wrapper. Plain text, 300–500 words.`;

  const userPrompt = `Voice style: ${params.voiceLabel}

Style instructions:
${params.generationInstructions}

Blog post topic / question:
${params.question}

Source answer content (for factual grounding — do not copy verbatim, transform into this voice):
${params.answerMd.slice(0, 2500)}

SEO title (for context):
${params.seoTitle}

Write a 300–500 word blog post body in the voice described above. Return only the body text.`;

  const message = await client.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  const copy = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
  return {
    copy,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
