import { db } from "@workspace/db";
import { questions, answers, contentAssets, loopRuns, type InsertQuestion, type InsertAnswer, type InsertContentAsset } from "@workspace/db";
import { eq, desc, and, sql, notExists, isNull, isNotNull } from "drizzle-orm";

export async function insertQuestion(data: InsertQuestion) {
  const [row] = await db.insert(questions).values(data).returning();
  return row;
}

export async function getQuestionByNormalised(normalisedQuestion: string) {
  const [row] = await db
    .select()
    .from(questions)
    .where(eq(questions.normalisedQuestion, normalisedQuestion));
  return row ?? null;
}

export async function getAllNormalisedQuestions(): Promise<string[]> {
  const rows = await db.select({ q: questions.normalisedQuestion }).from(questions);
  return rows.map((r) => r.q);
}

export async function updateQuestionStatus(id: number, status: string) {
  await db.update(questions).set({ status }).where(eq(questions.id, id));
}

export async function listQuestions(limit = 50, offset = 0) {
  return db
    .select()
    .from(questions)
    .orderBy(desc(questions.discoveredAt))
    .limit(limit)
    .offset(offset);
}

export async function getQuestionById(id: number) {
  const [row] = await db.select().from(questions).where(eq(questions.id, id));
  return row ?? null;
}

export async function insertAnswer(data: InsertAnswer) {
  const [row] = await db.insert(answers).values(data).returning();
  return row;
}

export async function getAnswerByQuestionId(questionId: number) {
  const [row] = await db
    .select()
    .from(answers)
    .where(eq(answers.questionId, questionId))
    .orderBy(desc(answers.createdAt));
  return row ?? null;
}

export async function listAnswers(limit = 50, offset = 0) {
  return db
    .select({
      answer: answers,
      question: questions,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .orderBy(desc(answers.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function insertContentAsset(data: InsertContentAsset) {
  const [row] = await db.insert(contentAssets).values(data).returning();
  return row;
}

export async function getContentAssetBySlug(slug: string) {
  const [row] = await db
    .select({
      asset: contentAssets,
      answer: answers,
      question: questions,
    })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(
      and(
        eq(contentAssets.channel, "web_aeo"),
        eq(contentAssets.status, "published"),
        sql`${contentAssets.payloadJson}->>'slug' = ${slug}`
      )
    );
  return row ?? null;
}

export async function listPublishedQAs(limit = 100) {
  return db
    .select({
      asset: contentAssets,
      answer: answers,
      question: questions,
    })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(
      and(
        eq(contentAssets.channel, "web_aeo"),
        eq(contentAssets.status, "published")
      )
    )
    .orderBy(desc(contentAssets.publishedAt))
    .limit(limit);
}

export async function updateContentAssetStatus(id: number, status: string, publishedAt?: Date) {
  await db
    .update(contentAssets)
    .set({ status, ...(publishedAt ? { publishedAt } : {}) })
    .where(eq(contentAssets.id, id));
}

export async function startLoopRun(loop: string) {
  const [row] = await db
    .insert(loopRuns)
    .values({ loop, status: "running" })
    .returning();
  return row;
}

export async function finishLoopRun(
  id: number,
  opts: { itemsProcessed: number; costEstimate: number; status: string; error?: string }
) {
  await db
    .update(loopRuns)
    .set({
      finishedAt: new Date(),
      itemsProcessed: opts.itemsProcessed,
      costEstimate: opts.costEstimate,
      status: opts.status,
      error: opts.error ?? null,
    })
    .where(eq(loopRuns.id, id));
}

export async function listLoopRuns(loop?: string, limit = 20) {
  const q = db
    .select()
    .from(loopRuns)
    .orderBy(desc(loopRuns.startedAt))
    .limit(limit);
  if (loop) {
    return db
      .select()
      .from(loopRuns)
      .where(eq(loopRuns.loop, loop))
      .orderBy(desc(loopRuns.startedAt))
      .limit(limit);
  }
  return q;
}

export async function getCorpusStats() {
  const [stats] = await db
    .select({
      totalQuestions: sql<number>`count(distinct ${questions.id})`,
      pendingQuestions: sql<number>`count(distinct ${questions.id}) filter (where ${questions.status} = 'pending')`,
      answeredQuestions: sql<number>`count(distinct ${questions.id}) filter (where ${questions.status} = 'answered')`,
      totalAnswers: sql<number>`count(distinct ${answers.id})`,
      publishedAssets: sql<number>`count(distinct ${contentAssets.id}) filter (where ${contentAssets.status} = 'published')`,
      draftAssets: sql<number>`count(distinct ${contentAssets.id}) filter (where ${contentAssets.status} = 'draft')`,
    })
    .from(questions)
    .leftJoin(answers, eq(answers.questionId, questions.id))
    .leftJoin(contentAssets, eq(contentAssets.answerId, answers.id));
  return stats;
}

// ─── Loop 2 queries ──────────────────────────────────────────────────────────

/**
 * Returns answered questions whose answers have NOT yet had Loop 2 multi-channel
 * assets generated (i.e., no content_assets rows with channel != 'web_aeo').
 */
export async function listAnswersNotYetInLoop2(limit = 10) {
  const loop2AssetSubquery = db
    .select({ id: contentAssets.answerId })
    .from(contentAssets)
    .where(sql`${contentAssets.channel} != 'web_aeo'`);

  return db
    .select({
      answer: answers,
      question: questions,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(
      and(
        eq(questions.status, "answered"),
        notExists(
          db
            .select({ id: contentAssets.id })
            .from(contentAssets)
            .where(
              and(
                eq(contentAssets.answerId, answers.id),
                sql`${contentAssets.channel} != 'web_aeo'`
              )
            )
        )
      )
    )
    .orderBy(desc(answers.createdAt))
    .limit(limit);
}

/**
 * List all Loop 2 multi-channel assets (excluding web_aeo) with their question context.
 */
export async function listLoop2Assets(limit = 100) {
  return db
    .select({
      asset: contentAssets,
      answer: answers,
      question: questions,
    })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(sql`${contentAssets.channel} != 'web_aeo'`)
    .orderBy(desc(contentAssets.publishedAt))
    .limit(limit);
}

// ─── Loop 4 queries ──────────────────────────────────────────────────────────

/** web_aeo assets not yet published as GEO pages (externalId IS NULL) */
export async function listUnpublishedWebAeoAssets(limit = 20) {
  return db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(contentAssets.channel, "web_aeo"), eq(contentAssets.variant, "standard"), isNull(contentAssets.externalId)))
    .orderBy(desc(contentAssets.publishedAt))
    .limit(limit);
}

/** newsletter/standard assets not yet sent (externalId IS NULL) */
export async function listUnpublishedNewsletterAssets(limit = 10) {
  return db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(contentAssets.channel, "newsletter"), eq(contentAssets.variant, "standard"), isNull(contentAssets.externalId)))
    .orderBy(desc(contentAssets.publishedAt))
    .limit(limit);
}

/** linkedin/standard assets not yet queued (externalId IS NULL) */
export async function listUnpublishedLinkedInAssets(limit = 10) {
  return db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(contentAssets.channel, "linkedin"), eq(contentAssets.variant, "standard"), isNull(contentAssets.externalId)))
    .orderBy(desc(contentAssets.publishedAt))
    .limit(limit);
}

/** answers whose question has a Reddit sourceUrl and whose web_aeo asset externalId is already set (i.e. GEO published) */
export async function listAnswersWithRedditSource(limit = 10) {
  return db
    .select({ answer: answers, question: questions })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(sql`${questions.sourceUrl} LIKE '%reddit.com%'`)
    .orderBy(desc(answers.id))
    .limit(limit);
}

/** Get the web_aeo standard asset for a given answerId */
export async function getWebAeoAssetForAnswer(answerId: number) {
  const [row] = await db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(contentAssets.answerId, answerId), eq(contentAssets.channel, "web_aeo"), eq(contentAssets.variant, "standard")));
  return row ?? null;
}

/** Mark an asset as distributed by setting externalId and optionally updating engagementMetricsJson */
export async function markAssetDistributed(
  id: number,
  externalId: string,
  channel: string,
  meta?: Record<string, unknown>
) {
  await db
    .update(contentAssets)
    .set({
      externalId,
      scheduledFor: new Date(),
      ...(meta ? { engagementMetricsJson: meta } : {}),
    })
    .where(eq(contentAssets.id, id));
}

/** List all published GEO answer pages (web_aeo, externalId set), newest first */
export async function listPublishedAnswerPages(limit = 50, offset = 0) {
  return db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(contentAssets.channel, "web_aeo"), eq(contentAssets.variant, "standard"), isNotNull(contentAssets.externalId)))
    .orderBy(desc(contentAssets.scheduledFor))
    .limit(limit)
    .offset(offset);
}

/** Get a single GEO answer page by slug */
export async function getAnswerPageBySlug(slug: string) {
  const [row] = await db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(contentAssets.channel, "web_aeo"), eq(contentAssets.variant, "standard"), eq(contentAssets.externalId, slug)));
  return row ?? null;
}

// ─── Loop 3 queries ──────────────────────────────────────────────────────────

/**
 * Blog post assets (standard variant) that have not yet been enriched with a slug.
 */
export async function listBlogPostsNotYetPublished(limit = 10) {
  return db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(
      and(
        eq(contentAssets.channel, "blog_post"),
        eq(contentAssets.variant, "standard"),
        isNull(contentAssets.externalId)
      )
    )
    .orderBy(desc(contentAssets.publishedAt))
    .limit(limit);
}

/**
 * Store SEO metadata and slug on a blog_post asset.
 */
export async function updateBlogMeta(
  id: number,
  slug: string,
  meta: {
    seoTitle: string;
    metaDescription: string;
    readTimeMinutes: number;
    faqJsonLd: Record<string, unknown>;
    featuredImageUrl?: string | null;
  }
) {
  await db
    .update(contentAssets)
    .set({
      externalId: slug,
      engagementMetricsJson: meta,
      scheduledFor: new Date(),
    })
    .where(eq(contentAssets.id, id));
}

/**
 * List all published blog posts (standard variant, slug set), newest first.
 */
export async function listPublishedBlogPosts(limit = 20, offset = 0) {
  return db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(
      and(
        eq(contentAssets.channel, "blog_post"),
        eq(contentAssets.variant, "standard"),
        isNotNull(contentAssets.externalId)
      )
    )
    .orderBy(desc(contentAssets.scheduledFor))
    .limit(limit)
    .offset(offset);
}

/**
 * Get a single blog post by its slug.
 */
export async function getBlogPostBySlug(slug: string) {
  const [row] = await db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(
      and(
        eq(contentAssets.channel, "blog_post"),
        eq(contentAssets.variant, "standard"),
        eq(contentAssets.externalId, slug)
      )
    );
  return row ?? null;
}

/**
 * Get all Loop 2 assets for a specific answer, grouped by channel and variant.
 */
export async function getLoop2AssetsForAnswer(answerId: number) {
  return db
    .select()
    .from(contentAssets)
    .where(
      and(
        eq(contentAssets.answerId, answerId),
        sql`${contentAssets.channel} != 'web_aeo'`
      )
    )
    .orderBy(contentAssets.channel, contentAssets.variant);
}

/** Blog posts that have a slug (externalId set) but haven't been migrated to Beehiiv yet */
export async function listUnmigratedBlogPosts(limit = 20) {
  return db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(
      and(
        eq(contentAssets.channel, "blog_post"),
        eq(contentAssets.variant, "standard"),
        isNotNull(contentAssets.externalId),
        sql`${contentAssets.engagementMetricsJson}->>'beehiivPostId' IS NULL`
      )
    )
    .orderBy(desc(contentAssets.scheduledFor))
    .limit(limit);
}

/** Merge Beehiiv post ID + web URL into engagementMetricsJson (non-destructive) */
export async function markBlogPostMigratedToBeehiiv(
  id: number,
  beehiivPostId: string,
  beehiivWebUrl: string | null
) {
  await db
    .update(contentAssets)
    .set({
      engagementMetricsJson: sql`COALESCE(${contentAssets.engagementMetricsJson}, '{}'::jsonb) || ${JSON.stringify({ beehiivPostId, beehiivWebUrl })}::jsonb`,
    })
    .where(eq(contentAssets.id, id));
}

/** Get a blog_post asset by its numeric ID */
export async function getBlogPostById(id: number) {
  const [row] = await db
    .select({ asset: contentAssets, answer: answers, question: questions })
    .from(contentAssets)
    .innerJoin(answers, eq(contentAssets.answerId, answers.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(
      and(
        eq(contentAssets.channel, "blog_post"),
        eq(contentAssets.variant, "standard"),
        eq(contentAssets.id, id)
      )
    );
  return row ?? null;
}
