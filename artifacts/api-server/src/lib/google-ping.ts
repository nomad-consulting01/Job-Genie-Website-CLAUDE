import { SITE_URL } from "@workspace/site-config";
import { logger } from "./logger.js";

const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

/**
 * Fire-and-forget ping to Google's sitemap submission endpoint.
 * Tells Google to re-crawl the sitemap and discover newly published pages.
 * Errors are logged but never thrown — this must not block publishing.
 */
export function pingGoogleSitemap(): void {
  const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;

  fetch(pingUrl, { method: "GET", signal: AbortSignal.timeout(10_000) })
    .then((res) => {
      if (res.ok) {
        logger.info({ pingUrl, status: res.status }, "Google sitemap ping succeeded");
      } else {
        logger.warn({ pingUrl, status: res.status }, "Google sitemap ping returned non-OK status");
      }
    })
    .catch((err: unknown) => {
      logger.error({ pingUrl, err }, "Google sitemap ping failed — publishing continues normally");
    });
}
