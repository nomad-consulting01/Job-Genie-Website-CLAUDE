/**
 * One-off script: regenerates a unique, content-specific hero image for every
 * already-published blog post, replacing the two generic reused brand
 * templates. Run manually with:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/regenerate-blog-hero-images.ts
 */
import { listAllPublishedBlogPostsForImageGen, setFeaturedImageUrl } from "../corpus/db.js";
import { generateBlogHeroImage } from "../lib/blogImages.js";
import { logger } from "../lib/logger.js";

async function main() {
  const rows = await listAllPublishedBlogPostsForImageGen();
  logger.info({ count: rows.length }, "Regenerating unique hero images for published blog posts");

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    const slug = row.asset.externalId ?? `post-${row.asset.id}`;
    try {
      const url = await generateBlogHeroImage(
        { title: row.question.normalisedQuestion, summary: row.answer.answerFirstBlock },
        slug
      );
      await setFeaturedImageUrl(row.asset.id, url);
      success += 1;
      logger.info({ slug, assetId: row.asset.id, url }, "Regenerated hero image");
    } catch (err) {
      failed += 1;
      logger.error(
        { slug, assetId: row.asset.id, err: err instanceof Error ? err.message : String(err) },
        "Failed to regenerate hero image"
      );
    }
  }

  logger.info({ success, failed, total: rows.length }, "Hero image regeneration complete");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "Script failed");
    process.exit(1);
  });
