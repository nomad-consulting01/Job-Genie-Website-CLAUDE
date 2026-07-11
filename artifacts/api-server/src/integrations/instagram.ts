import { logger } from "../lib/logger.js";

const GRAPH_API = "https://graph.facebook.com/v19.0";

export interface InstagramPostResult {
  postId: string | null;
  error?: string;
}

/**
 * Resolve the Instagram Business Account ID from a connected Facebook Page.
 * Cached per process since it never changes within a run.
 */
let cachedIgUserId: string | null | undefined = undefined;

export async function getInstagramUserId(
  pageId: string,
  pageAccessToken: string
): Promise<string | null> {
  if (cachedIgUserId !== undefined) return cachedIgUserId;

  const url = `${GRAPH_API}/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(pageAccessToken)}`;
  try {
    const resp = await fetch(url);
    const json = (await resp.json()) as {
      instagram_business_account?: { id: string };
      error?: { message: string };
    };
    if (json.error) {
      logger.warn({ msg: json.error.message }, "Instagram: failed to fetch IG user id");
      cachedIgUserId = null;
      return null;
    }
    cachedIgUserId = json.instagram_business_account?.id ?? null;
    if (!cachedIgUserId) logger.warn("Instagram: no instagram_business_account linked to this Page");
    return cachedIgUserId;
  } catch (err) {
    logger.error({ err }, "Instagram: exception fetching IG user id");
    cachedIgUserId = null;
    return null;
  }
}

/**
 * Post an image + caption to Instagram via the Graph API (two-step: create container → publish).
 * imageUrl must be a publicly accessible URL (the blog post's featured image works perfectly).
 */
export async function postToInstagram(
  igUserId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string
): Promise<InstagramPostResult> {
  // Step 1: create media container
  const createParams = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: pageAccessToken,
  });

  const createResp = await fetch(`${GRAPH_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createParams.toString(),
  });

  const createJson = (await createResp.json()) as { id?: string; error?: { message: string } };

  if (!createResp.ok || createJson.error || !createJson.id) {
    const msg = createJson.error?.message ?? `HTTP ${createResp.status}`;
    logger.warn({ igUserId, imageUrl, msg }, "Instagram Graph API: create container failed");
    return { postId: null, error: msg };
  }

  const containerId = createJson.id;

  // Step 2: publish container
  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: pageAccessToken,
  });

  const publishResp = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishParams.toString(),
  });

  const publishJson = (await publishResp.json()) as { id?: string; error?: { message: string } };

  if (!publishResp.ok || publishJson.error) {
    const msg = publishJson.error?.message ?? `HTTP ${publishResp.status}`;
    logger.warn({ igUserId, containerId, msg }, "Instagram Graph API: publish failed");
    return { postId: null, error: msg };
  }

  return { postId: publishJson.id ?? containerId };
}
