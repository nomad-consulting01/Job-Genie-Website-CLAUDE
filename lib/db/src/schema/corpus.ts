import { pgTable, serial, text, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  rawText: text("raw_text").notNull(),
  normalisedQuestion: text("normalised_question").notNull(),
  painPointTags: text("pain_point_tags").array().notNull().default([]),
  engagementSignal: integer("engagement_signal").default(0),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status").notNull().default("pending"),
});

export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true, discoveredAt: true });
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export const answers = pgTable("answers", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").references(() => questions.id).notNull(),
  answerMd: text("answer_md").notNull(),
  answerFirstBlock: text("answer_first_block").notNull(),
  modelUsed: text("model_used").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  qualityScore: real("quality_score").default(0),
});

export const insertAnswerSchema = createInsertSchema(answers).omit({ id: true, createdAt: true });
export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;

export const contentAssets = pgTable("content_assets", {
  id: serial("id").primaryKey(),
  answerId: integer("answer_id").references(() => answers.id).notNull(),
  channel: text("channel").notNull(),
  variant: text("variant").notNull().default("standard"),
  payloadJson: jsonb("payload_json"),
  status: text("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  externalId: text("external_id"),
  engagementMetricsJson: jsonb("engagement_metrics_json"),
});

export const insertContentAssetSchema = createInsertSchema(contentAssets).omit({ id: true });
export type ContentAsset = typeof contentAssets.$inferSelect;
export type InsertContentAsset = z.infer<typeof insertContentAssetSchema>;

export const loopRuns = pgTable("loop_runs", {
  id: serial("id").primaryKey(),
  loop: text("loop").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  itemsProcessed: integer("items_processed").default(0),
  costEstimate: real("cost_estimate"),
  status: text("status").notNull().default("running"),
  error: text("error"),
});

export const insertLoopRunSchema = createInsertSchema(loopRuns).omit({ id: true, startedAt: true });
export type LoopRun = typeof loopRuns.$inferSelect;
export type InsertLoopRun = z.infer<typeof insertLoopRunSchema>;

/**
 * Auto-detected blog post cannibalization redirects.
 * Populated by Loop 3 when a new blog slug is too similar to an existing published post.
 */
export const blogRedirects = pgTable("blog_redirects", {
  id: serial("id").primaryKey(),
  duplicateSlug: text("duplicate_slug").notNull().unique(),
  keeperSlug: text("keeper_slug").notNull(),
  normalisedQuestion: text("normalised_question").notNull(),
  similarityScore: real("similarity_score").notNull(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BlogRedirect = typeof blogRedirects.$inferSelect;
