import { logger } from "../lib/logger.js";

const GRAPH_API = "https://graph.facebook.com/v19.0";

export interface FacebookPostResult {
  postId: string | null;
  error?: string;
}

/**
 * Post a native photo to a Facebook Page using the /photos endpoint.
 * Facebook downloads the image from `imageUrl`, attaches it as a real
 * photo (satisfying the "contains a photo" content requirement), and
 * displays `message` as the caption — which should include the blog URL
 * as plain text so readers can click through.
 *
 * This replaces the previous /feed + link approach, which created a
 * "link share" post that Facebook flags as having no photo/reel.
 *
 * Falls back to /feed (link post) when no imageUrl is provided.
 */
export async function postToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  caption: string,
  link: string,
  imageUrl?: string | null
): Promise<FacebookPostResult> {
  if (imageUrl) {
    return postPhotoToFacebookPage(pageId, pageAccessToken, caption, imageUrl);
  }
  return postLinkToFacebookPage(pageId, pageAccessToken, caption, link);
}

async function postPhotoToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  message: string,
  imageUrl: string
): Promise<FacebookPostResult> {
  const params = new URLSearchParams({
    url: imageUrl,
    message,
    access_token: pageAccessToken,
  });

  const resp = await fetch(`${GRAPH_API}/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = (await resp.json()) as { id?: string; post_id?: string; error?: { message: string } };

  if (!resp.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${resp.status}`;
    logger.warn({ pageId, imageUrl: imageUrl.slice(0, 80), msg }, "Facebook Graph API: photo post failed");
    return { postId: null, error: msg };
  }

  return { postId: json.post_id ?? json.id ?? `fb:photo:${Date.now()}` };
}

async function postLinkToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  caption: string,
  link: string
): Promise<FacebookPostResult> {
  const params = new URLSearchParams({
    message: caption,
    link,
    access_token: pageAccessToken,
  });

  const resp = await fetch(`${GRAPH_API}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = (await resp.json()) as { id?: string; error?: { message: string } };

  if (!resp.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${resp.status}`;
    logger.warn({ pageId, link, msg }, "Facebook Graph API: link post failed");
    return { postId: null, error: msg };
  }

  return { postId: json.id ?? `fb:post:${Date.now()}` };
}
