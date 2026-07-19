import { Router, type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger.js";
import {
  listPublishedBlogPosts,
  getBlogPostById,
  insertContentAsset,
  getContentAssetById,
  updateContentAssetStatus,
  markBlogPostFacebookShared,
} from "../corpus/db.js";
import { generateVoiceVariants } from "../loops/voice-loop/variantGenerator.js";
import { readSelfImproveProposals, readVoiceLibrary, readVoiceLedger, writePublishedVariants, readPublishedVariants } from "../loops/voice-loop/fileStore.js";
import { applySelfImproveProposal, dismissSelfImproveProposal } from "../loops/voice-loop/selfImprove.js";
import { runFbMetricsIngest } from "../loops/voice-loop/fbMetrics.js";
import { postToFacebookPage } from "../integrations/facebook.js";
import { db } from "@workspace/db";
import { contentAssets, answers, questions } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";

const router = Router();

const SITE_URL = "https://www.job-genie.ai";

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const ADMIN_TOKEN = process.env["ADMIN_TOKEN"];
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: "Admin not configured — set ADMIN_TOKEN env var" });
    return;
  }
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(requireAdmin);

/** List all voice variants for all blog posts, grouped by blog post. */
router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select({
        asset: contentAssets,
        answer: answers,
        question: questions,
      })
      .from(contentAssets)
      .innerJoin(answers, eq(contentAssets.answerId, answers.id))
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(eq(contentAssets.channel, "voice_variant"))
      .orderBy(desc(contentAssets.publishedAt));

    res.json({ variants: rows, total: rows.length });
  } catch (err) {
    logger.error({ err }, "GET /voice-variants failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** List voice variants for a specific blog post (by assetId). */
router.get("/blog-post/:assetId", async (req, res) => {
  try {
    const blogAssetId = parseInt(req.params["assetId"] ?? "0");
    const blogAsset = await getBlogPostById(blogAssetId);
    if (!blogAsset) {
      res.status(404).json({ error: "Blog post not found" });
      return;
    }

    const variants = await db
      .select()
      .from(contentAssets)
      .where(
        and(
          eq(contentAssets.channel, "voice_variant"),
          eq(contentAssets.answerId, blogAsset.answer.id)
        )
      )
      .orderBy(desc(contentAssets.publishedAt));

    res.json({
      blogPostAssetId: blogAssetId,
      slug: blogAsset.asset.externalId,
      question: blogAsset.question.normalisedQuestion,
      variants,
    });
  } catch (err) {
    logger.error({ err }, "GET /voice-variants/blog-post/:id failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Generate voice variants for a blog post. */
router.post("/blog-post/:assetId/generate", async (req, res) => {
  try {
    const blogAssetId = parseInt(req.params["assetId"] ?? "0");
    const { force } = req.body as { force?: boolean };
    const blogAsset = await getBlogPostById(blogAssetId);
    if (!blogAsset) {
      // Distinguish "asset doesn't exist" from "asset exists but its answer row is missing"
      const rawAsset = await getContentAssetById(blogAssetId);
      if (!rawAsset || rawAsset.channel !== "blog_post") {
        res.status(404).json({ error: "Blog post not found" });
      } else {
        res.status(422).json({
          error: "This blog post does not have an answer yet. Run Loop 1 to generate an answer before creating voice variants.",
        });
      }
      return;
    }

    if (!blogAsset.answer.answerMd?.trim()) {
      res.status(422).json({
        error: "This blog post's answer is empty or corrupted. Re-run Loop 1 to regenerate the answer before creating voice variants.",
      });
      return;
    }

    const existing = await db
      .select()
      .from(contentAssets)
      .where(and(eq(contentAssets.channel, "voice_variant"), eq(contentAssets.answerId, blogAsset.answer.id)));

    if (existing.length > 0 && !force) {
      res.json({ message: "Variants already exist. Use force=true to regenerate.", variants: existing.length });
      return;
    }

    if (force && existing.length > 0) {
      await db.delete(contentAssets).where(
        and(eq(contentAssets.channel, "voice_variant"), eq(contentAssets.answerId, blogAsset.answer.id))
      );
    }

    const meta = (blogAsset.asset.engagementMetricsJson ?? {}) as Record<string, unknown>;
    const payload = (blogAsset.asset.payloadJson ?? {}) as Record<string, unknown>;

    const result = await generateVoiceVariants({
      assetId: blogAssetId,
      slug: blogAsset.asset.externalId ?? `post-${blogAssetId}`,
      question: blogAsset.question.normalisedQuestion,
      answerMd: blogAsset.answer.answerMd,
      seoTitle: String(meta["seoTitle"] ?? blogAsset.question.normalisedQuestion),
    });

    const stored = [];
    for (const variant of result.variants) {
      const row = await insertContentAsset({
        answerId: blogAsset.answer.id,
        channel: "voice_variant",
        variant: variant.voiceId,
        payloadJson: variant as unknown as Record<string, unknown>,
        status: variant.status === "rejected" ? "rejected" : "draft",
        publishedAt: new Date(),
      });
      stored.push(row);
    }

    res.json({
      generated: result.variants.length,
      autoRejected: result.autoRejected,
      budgetUsedUsd: result.budgetUsedUsd,
      budgetCapHit: result.budgetCapHit,
      errors: result.errors,
      stored: stored.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "POST /voice-variants/blog-post/:id/generate failed");
    res.status(500).json({ error: msg });
  }
});

/** Edit a voice variant's body text or SEO title (only while still in draft). */
router.patch("/:variantAssetId", async (req, res) => {
  try {
    const variantAssetId = parseInt(req.params["variantAssetId"] ?? "0");
    const { bodyText, seoTitle } = req.body as { bodyText?: string; seoTitle?: string };

    if (!bodyText && !seoTitle) {
      res.status(400).json({ error: "Provide at least one of: bodyText, seoTitle" });
      return;
    }

    const asset = await getContentAssetById(variantAssetId);
    if (!asset || asset.channel !== "voice_variant") {
      res.status(404).json({ error: "Voice variant not found" });
      return;
    }

    if (asset.status === "published") {
      res.status(409).json({ error: "Cannot edit a published variant" });
      return;
    }

    const existingPayload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (bodyText !== undefined) updates["bodyText"] = bodyText.trim();
    if (seoTitle !== undefined) updates["seoTitle"] = seoTitle.trim();
    updates["editedAt"] = new Date().toISOString();

    await db
      .update(contentAssets)
      .set({ payloadJson: { ...existingPayload, ...updates } })
      .where(eq(contentAssets.id, variantAssetId));

    logger.info({ variantAssetId, editedFields: Object.keys(updates) }, "Voice variant edited");
    res.json({ id: variantAssetId, ...updates });
  } catch (err) {
    logger.error({ err }, "PATCH /voice-variants/:id failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Approve a voice variant. Records approver + timestamp. Publishing remains gated on this. */
router.post("/:variantAssetId/approve", async (req, res) => {
  try {
    const variantAssetId = parseInt(req.params["variantAssetId"] ?? "0");
    const { approver } = req.body as { approver?: string };

    if (!approver || typeof approver !== "string" || approver.trim().length < 1) {
      res.status(400).json({ error: "approver is required" });
      return;
    }

    const asset = await getContentAssetById(variantAssetId);
    if (!asset || asset.channel !== "voice_variant") {
      res.status(404).json({ error: "Voice variant not found" });
      return;
    }

    if (asset.status === "rejected") {
      res.status(409).json({ error: "Cannot approve a rejected variant — rejected variants cannot be published" });
      return;
    }

    const existingPayload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    const approvedAt = new Date().toISOString();

    await db
      .update(contentAssets)
      .set({
        status: "approved",
        payloadJson: {
          ...existingPayload,
          status: "approved",
          approver: approver.trim(),
          approvedAt,
        },
      })
      .where(eq(contentAssets.id, variantAssetId));

    logger.info({ variantAssetId, approver, approvedAt }, "Voice variant approved");
    res.json({ id: variantAssetId, status: "approved", approver: approver.trim(), approvedAt });
  } catch (err) {
    logger.error({ err }, "POST /voice-variants/:id/approve failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Reject a voice variant. */
router.post("/:variantAssetId/reject", async (req, res) => {
  try {
    const variantAssetId = parseInt(req.params["variantAssetId"] ?? "0");
    const { reason } = req.body as { reason?: string };

    const asset = await getContentAssetById(variantAssetId);
    if (!asset || asset.channel !== "voice_variant") {
      res.status(404).json({ error: "Voice variant not found" });
      return;
    }

    const existingPayload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    await db
      .update(contentAssets)
      .set({
        status: "rejected",
        payloadJson: {
          ...existingPayload,
          status: "rejected",
          rejectReason: reason ?? "Rejected by admin",
          rejectedAt: new Date().toISOString(),
        },
      })
      .where(eq(contentAssets.id, variantAssetId));

    logger.info({ variantAssetId, reason }, "Voice variant rejected");
    res.json({ id: variantAssetId, status: "rejected" });
  } catch (err) {
    logger.error({ err }, "POST /voice-variants/:id/reject failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Publish an approved voice variant to blog (inline update) and queue for Facebook.
 * Gated on: status === 'approved' AND approver recorded.
 * Writes post_id ↔ variant_id mapping to data/published-variants.json.
 */
router.post("/:variantAssetId/publish", async (req, res) => {
  try {
    const variantAssetId = parseInt(req.params["variantAssetId"] ?? "0");

    const asset = await getContentAssetById(variantAssetId);
    if (!asset || asset.channel !== "voice_variant") {
      res.status(404).json({ error: "Voice variant not found" });
      return;
    }

    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;

    if (asset.status !== "approved") {
      res.status(403).json({
        error: "Publishing is gated on human approval. Approve this variant first.",
        currentStatus: asset.status,
        approver: payload["approver"] ?? null,
      });
      return;
    }

    if (!payload["approver"]) {
      res.status(403).json({ error: "No approver recorded on this variant — cannot publish" });
      return;
    }

    const blogPostAssetId = payload["blogPostAssetId"] as number | undefined;
    const blogPostSlug = payload["blogPostSlug"] as string | undefined;
    const variantId = payload["variantId"] as string | undefined;
    const voiceId = payload["voiceId"] as string | undefined;
    const hookType = payload["hookType"] as string | undefined;

    let facebookPostId: string | null = null;
    const fbErrors: string[] = [];

    const pageId = process.env["FACEBOOK_PAGE_ID"];
    const fbToken = process.env["FACEBOOK_PAGE_ACCESS_TOKEN"];

    if (pageId && fbToken && blogPostSlug) {
      try {
        const bodyText = payload["bodyText"] as string ?? "";
        const seoTitle = payload["seoTitle"] as string ?? "";
        const link = `${SITE_URL}/blog/${blogPostSlug}?v=${variantId ?? ""}`;
        const caption = `${seoTitle}\n\n${bodyText.slice(0, 200)}…\n\n👉 Read the full post: ${link}`;
        const { postId, error } = await postToFacebookPage(pageId, fbToken, caption, link, null);
        if (postId) {
          facebookPostId = postId;
        } else {
          fbErrors.push(error ?? "Unknown Facebook error");
        }
      } catch (err) {
        fbErrors.push(err instanceof Error ? err.message : String(err));
      }
    }

    await db
      .update(contentAssets)
      .set({
        status: "published",
        payloadJson: {
          ...payload,
          status: "published",
          publishedAt: new Date().toISOString(),
          ...(facebookPostId ? { facebookPostId } : {}),
        },
      })
      .where(eq(contentAssets.id, variantAssetId));

    if (variantId && voiceId && blogPostAssetId) {
      const bodyText = payload["bodyText"] as string | undefined;
      if (bodyText) {
        try {
          /** Merge variant body into blog post payloadJson so SSR renders the new copy. */
          await db
            .update(contentAssets)
            .set({
              payloadJson: sql`${contentAssets.payloadJson} || ${JSON.stringify({ content: bodyText, activeVoiceId: voiceId, activeVariantId: variantId })}::jsonb`,
            })
            .where(eq(contentAssets.id, blogPostAssetId));
          logger.info({ blogPostAssetId, variantId, voiceId }, "Voice variant body applied to blog post payloadJson");
        } catch (updateErr) {
          logger.warn({ err: updateErr }, "Failed to apply voice variant body to blog post — continuing publish");
        }
      }

      if (facebookPostId) {
        try {
          /** Write facebookPostId into the top-level engagementMetricsJson DB column so Loop 4
           *  listPublishedBlogPostsNotOnFacebook() sees it and does not re-distribute. */
          await markBlogPostFacebookShared(blogPostAssetId, facebookPostId);
          logger.info({ blogPostAssetId, facebookPostId }, "markBlogPostFacebookShared: Loop 4 duplicate guard set");
        } catch (markErr) {
          logger.warn({ err: markErr }, "Failed to mark blog post facebook shared — continuing");
        }
      }

      /** Create an approved Instagram content asset for the blog post's answer so that Loop 4's
       *  IG scheduler picks up this variant's copy on its next run.  The variantId is embedded in
       *  the payload so Loop 4 can stamp the resulting Instagram post_id back into the attribution
       *  mapping (published-variants.json) and close Station ② for the IG channel. */
      if (bodyText) {
        try {
          const blogPostAsset = await getContentAssetById(blogPostAssetId);
          if (blogPostAsset?.answerId) {
            await insertContentAsset({
              answerId: blogPostAsset.answerId,
              channel: "instagram",
              variant: "direct_response",
              status: "approved",
              payloadJson: {
                copy: bodyText,
                hashtags: ["#JobSearch", "#CareerTips", "#JobGenie", "#CareerAdvice"],
                cta: "Get personalized career guidance",
                variantId,
                voiceId,
                voiceVariantAssetId: variantAssetId,
                createdByVoiceLoop: true,
              },
            });
            logger.info(
              { blogPostAssetId, answerId: blogPostAsset.answerId, variantId },
              "Approved Instagram content asset created — queued for Loop 4 IG distribution with variant attribution"
            );
          }
        } catch (igErr) {
          logger.warn({ err: igErr }, "Failed to create Instagram content asset — continuing publish");
        }
      }

      /** Always persist the post_id ↔ variant_id mapping so Station ② can close the attribution loop.
       *  If FB creds were absent, use a placeholder so the entry can be updated when Task #27 links real post IDs. */
      const effectivePostId = facebookPostId ?? `pending:${variantId ?? "unknown"}`;
      const file = readPublishedVariants();
      const existingIdx = file.entries.findIndex((e) => e.variant_id === variantId);
      const entry = {
        post_id: effectivePostId,
        variant_id: variantId,
        voice_id: voiceId,
        hook_type: String(hookType ?? "unknown"),
        blog_post_asset_id: blogPostAssetId,
        approver: String(payload["approver"]),
        approvedAt: String(payload["approvedAt"] ?? new Date().toISOString()),
        publishedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        file.entries[existingIdx] = entry;
      } else {
        file.entries.push(entry);
      }
      file.lastUpdatedAt = new Date().toISOString();
      writePublishedVariants(file);
      logger.info({ effectivePostId, variantId, hasFbPostId: Boolean(facebookPostId) }, "Attribution mapping persisted to published-variants.json");
    }

    logger.info({ variantAssetId, facebookPostId, blogPostSlug }, "Voice variant published");
    res.json({
      id: variantAssetId,
      status: "published",
      facebookPostId,
      fbErrors,
      variantId,
      voiceId,
      hookType,
      blogPostSlug,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "POST /voice-variants/:id/publish failed");
    res.status(500).json({ error: msg });
  }
});

/** Get the voice library (current voices + ledger state). */
router.get("/voice-library", (_req, res) => {
  try {
    const lib = readVoiceLibrary();
    const ledger = readVoiceLedger();
    res.json({ voiceLibrary: lib, ledger });
  } catch (err) {
    logger.error({ err }, "GET /voice-variants/voice-library failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** List pending self-improve proposals. */
router.get("/self-improve", (_req, res) => {
  try {
    const { proposals } = readSelfImproveProposals();
    res.json({ proposals });
  } catch (err) {
    logger.error({ err }, "GET /voice-variants/self-improve failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Apply a self-improve proposal. */
router.post("/self-improve/:proposalId/apply", async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { appliedBy } = req.body as { appliedBy?: string };
    const result = await applySelfImproveProposal(proposalId ?? "", appliedBy ?? "admin");
    if (!result.applied) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.json({ applied: true, proposalId });
  } catch (err) {
    logger.error({ err }, "POST /voice-variants/self-improve/:id/apply failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Dismiss a self-improve proposal. */
router.post("/self-improve/:proposalId/dismiss", async (req, res) => {
  try {
    const { proposalId } = req.params;
    const result = await dismissSelfImproveProposal(proposalId ?? "");
    if (!result.dismissed) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.json({ dismissed: true, proposalId });
  } catch (err) {
    logger.error({ err }, "POST /voice-variants/self-improve/:id/dismiss failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Manually trigger FB metrics ingest. */
router.post("/run-fb-metrics", async (_req, res) => {
  res.json({ message: "FB metrics ingest started — running in background" });
  setImmediate(async () => {
    try {
      const result = await runFbMetricsIngest();
      logger.info({ result }, "Manual FB metrics ingest complete");
    } catch (err) {
      logger.error({ err }, "Manual FB metrics ingest failed");
    }
  });
});

/**
 * Link a real Facebook post_id to a published voice variant.
 * Used when the automatic FB post failed at publish time and the admin posted manually,
 * or when FB creds were absent so a pending:${variantId} placeholder was written instead.
 *
 * Updates:
 *   1. contentAssets.payloadJson.facebookPostId in the DB
 *   2. The matching entry in data/published-variants.json (replaces any pending: prefix)
 *   3. engagementMetricsJson on the blog post asset (so Loop 4 duplicate guard fires correctly)
 */
router.patch("/:variantAssetId/link-fb-post", async (req, res) => {
  try {
    const variantAssetId = parseInt(req.params["variantAssetId"] ?? "0");
    const { fbPostId } = req.body as { fbPostId?: string };

    if (!fbPostId || !fbPostId.trim()) {
      res.status(400).json({ error: "fbPostId is required" });
      return;
    }
    const trimmedPostId = fbPostId.trim();

    const asset = await getContentAssetById(variantAssetId);
    if (!asset || asset.channel !== "voice_variant") {
      res.status(404).json({ error: "Voice variant not found" });
      return;
    }
    if (asset.status !== "published") {
      res.status(400).json({ error: "Only published variants can have an FB post ID linked" });
      return;
    }

    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    const variantId = payload["variantId"] as string | undefined;
    const blogPostAssetId = payload["blogPostAssetId"] as number | undefined;

    /** 1. Stamp facebookPostId into the DB asset payload. */
    await db
      .update(contentAssets)
      .set({
        payloadJson: {
          ...payload,
          facebookPostId: trimmedPostId,
        },
      })
      .where(eq(contentAssets.id, variantAssetId));

    /** 2. Update published-variants.json — replace pending: placeholder or overwrite stale id. */
    if (variantId) {
      const pvFile = readPublishedVariants();
      const idx = pvFile.entries.findIndex((e) => e.variant_id === variantId);
      if (idx >= 0) {
        pvFile.entries[idx] = { ...pvFile.entries[idx], post_id: trimmedPostId };
        pvFile.lastUpdatedAt = new Date().toISOString();
        writePublishedVariants(pvFile);
        logger.info({ variantId, trimmedPostId }, "link-fb-post: published-variants.json updated");
      } else {
        logger.warn({ variantId }, "link-fb-post: no entry found in published-variants.json for this variant — was publish() called?");
      }
    }

    /** 3. Mark blog post facebook-shared so Loop 4 doesn't re-distribute. */
    if (blogPostAssetId) {
      try {
        await markBlogPostFacebookShared(blogPostAssetId, trimmedPostId);
        logger.info({ blogPostAssetId, trimmedPostId }, "link-fb-post: blog post marked facebook-shared");
      } catch (markErr) {
        logger.warn({ err: markErr }, "link-fb-post: failed to mark blog post facebook-shared — continuing");
      }
    }

    logger.info({ variantAssetId, variantId, trimmedPostId }, "Voice variant FB post ID linked");
    res.json({ ok: true, variantAssetId, variantId, facebookPostId: trimmedPostId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "PATCH /voice-variants/:id/link-fb-post failed");
    res.status(500).json({ error: msg });
  }
});

export default router;
