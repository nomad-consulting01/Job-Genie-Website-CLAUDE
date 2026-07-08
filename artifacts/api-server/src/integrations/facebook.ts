import { logger } from "../lib/logger.js";

const GRAPH_API = "https://graph.facebook.com/v19.0";

export interface FacebookPostResult {
  postId: string | null;
  error?: string;
}

/**
 * Post a link + caption to a Facebook Page feed.
 * Uses the /feed endpoint so Facebook auto-scrapes the og:image from the URL.
 */
export async function postToFacebookPage(
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
    logger.warn({ pageId, link, msg }, "Facebook Graph API: post failed");
    return { postId: null, error: msg };
  }

  return { postId: json.id ?? `fb:post:${Date.now()}` };
}
