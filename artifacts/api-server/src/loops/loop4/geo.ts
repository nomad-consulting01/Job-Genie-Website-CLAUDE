import { listUnpublishedWebAeoAssets, markAssetDistributed } from "../../corpus/db.js";
import { logger } from "../../lib/logger.js";

export interface GeoResult {
  processed: number;
  succeeded: number;
  failed: number;
  slugs: string[];
  errors: string[];
}

export async function runGeo(limit: number): Promise<GeoResult> {
  const pending = await listUnpublishedWebAeoAssets(limit);
  logger.info({ count: pending.length }, "Loop 4 GEO: assets to publish");

  let succeeded = 0;
  let failed = 0;
  const slugs: string[] = [];
  const errors: string[] = [];

  for (const { asset } of pending) {
    try {
      const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
      const slug = payload["slug"] as string | undefined;

      if (!slug) {
        failed++;
        errors.push(`Asset ${asset.id}: missing slug in payloadJson`);
        continue;
      }

      await markAssetDistributed(asset.id, slug, "geo");
      succeeded++;
      slugs.push(slug);
      logger.info({ assetId: asset.id, slug }, "Loop 4 GEO: answer page published");
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Asset ${asset.id}: ${msg}`);
      logger.error({ assetId: asset.id, err: msg }, "Loop 4 GEO: failed");
    }
  }

  return { processed: pending.length, succeeded, failed, slugs, errors };
}
