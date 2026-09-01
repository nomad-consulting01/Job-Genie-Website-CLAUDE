import { logger } from "../lib/logger.js";

const GRAPH_API = "https://graph.facebook.com/v19.0";

export interface FacebookPostResult {
  postId: string | null;
  error?: string;
}

/**
 * Publish a Facebook link-share card through the /feed endpoint.
 *
 * Facebook scrapes the supplied blog URL's Open Graph metadata to build the
 * clickable image, title, and description card. Do not switch to /photos when
 * an image URL is available: that creates a native photo post with the blog
 * URL only in the caption, which is a different presentation from a link card.
 *
 * `imageUrl` remains in the public function signature because other callers
 * already provide it, but the canonical blog page's og:image is the source of
 * truth for the link preview.
 */
export async function postToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  caption: string,
  link: string,
  _imageUrl?: string | null
): Promise<FacebookPostResult> {
  return postLinkToFacebookPage(pageId, pageAccessToken, caption, link);
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
