import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const reactorInvitePosts = pgTable("reactor_invite_posts", {
  postId: text("post_id").primaryKey(),
  postSnippet: text("post_snippet"),
  permalink: text("permalink"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  lastHarvestedAt: timestamp("last_harvested_at", { withTimezone: true }),
  totalReactions: integer("total_reactions").notNull().default(0),
  reactionDelta: integer("reaction_delta").notNull().default(0),
  reactionBreakdown: jsonb("reaction_breakdown"),
  inviteStatus: text("invite_status").notNull().default("never_invited"),
  invitesSentCount: integer("invites_sent_count").notNull().default(0),
  lastInvitedAt: timestamp("last_invited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reactorInviteSessions = pgTable("reactor_invite_sessions", {
  id: serial("id").primaryKey(),
  postId: text("post_id").notNull().references(() => reactorInvitePosts.postId),
  invitesSent: integer("invites_sent").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ReactorInvitePost = typeof reactorInvitePosts.$inferSelect;
export type ReactorInviteSession = typeof reactorInviteSessions.$inferSelect;
