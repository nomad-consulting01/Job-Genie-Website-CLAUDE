import { listUnpublishedLinkedInAssets, markAssetDistributed } from "../../corpus/db.js";
import { logger } from "../../lib/logger.js";

export interface LinkedInResult {
  processed: number;
  succeeded: number;
  failed: number;
  queued: number;
  errors: string[];
}

/**
 * LinkedIn posting API is restricted to approved partners.
 * This sub-engine queues LinkedIn assets for manual posting by marking them
 * with externalId = "linkedin:queued:{id}" so they surface in the admin Blog/Content tab.
 *
 * When a LinkedIn API token is provided via LINKEDIN_ACCESS_TOKEN, it attempts
 * to post via the ugcPosts endpoint using the Member URN from LINKEDIN_MEMBER_URN.
 */
async function postViaLinkedInApi(content: string, _token: string, _memberUrn: string): Promise<string | null> {
  // LinkedIn API: POST /v2/ugcPosts
  const resp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${_memberUrn}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!resp.ok) {
    logger.warn({ status: resp.status }, "Loop 4 LinkedIn: post failed");
    return null;
  }

  const id = resp.headers.get("x-restli-id");
  return id ?? `li:post:${Date.now()}`;
}

export async function runLinkedIn(limit: number): Promise<LinkedInResult> {
  const pending = await listUnpublishedLinkedInAssets(limit);
  logger.info({ count: pending.length }, "Loop 4 LinkedIn: assets to process");

  const accessToken = process.env["LINKEDIN_ACCESS_TOKEN"];
  const memberUrn = process.env["LINKEDIN_MEMBER_URN"];
  const useApi = Boolean(accessToken && memberUrn);

  let succeeded = 0;
  let failed = 0;
  let queued = 0;
  const errors: string[] = [];

  for (const { asset, question } of pending) {
    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    const content = String(payload["content"] ?? payload["post"] ?? question.normalisedQuestion);

    try {
      if (useApi) {
        const postId = await postViaLinkedInApi(content, accessToken!, memberUrn!);
        if (postId) {
          await markAssetDistributed(asset.id, postId, "linkedin");
          succeeded++;
          logger.info({ assetId: asset.id, postId }, "Loop 4 LinkedIn: post published via API");
        } else {
          // Fall back to queued if API fails
          const queuedId = `linkedin:queued:${asset.id}`;
          await markAssetDistributed(asset.id, queuedId, "linkedin");
          queued++;
          logger.info({ assetId: asset.id }, "Loop 4 LinkedIn: queued for manual posting (API failed)");
        }
      } else {
        // No credentials — queue for manual posting
        const queuedId = `linkedin:queued:${asset.id}`;
        await markAssetDistributed(asset.id, queuedId, "linkedin");
        queued++;
        logger.info({ assetId: asset.id }, "Loop 4 LinkedIn: queued for manual posting");
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Asset ${asset.id}: ${msg}`);
      logger.error({ assetId: asset.id, err: msg }, "Loop 4 LinkedIn: error");
    }
  }

  if (!useApi) {
    errors.push("LinkedIn API not configured — set LINKEDIN_ACCESS_TOKEN + LINKEDIN_MEMBER_URN to auto-post. Assets queued for manual posting.");
  }

  return { processed: pending.length, succeeded, failed, queued, errors };
}
