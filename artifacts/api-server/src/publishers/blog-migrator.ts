import { createBeehiivWebPost } from "../integrations/beehiiv.js";
import {
  listUnmigratedBlogPosts,
  markBlogPostMigratedToBeehiiv,
} from "../corpus/db.js";
import { mdToNewsletterHtml } from "./newsletter.js";
import { logger } from "../lib/logger.js";

const SITE_URL = "https://job-genie.ai";

// ---------------------------------------------------------------------------
// Build Beehiiv web-post HTML from a blog_post asset
// ---------------------------------------------------------------------------
export function buildBlogWebHtml(opts: {
  slug: string;
  seoTitle: string;
  content: string;
  painPointTags: string[];
  imageUrl: string;
}): string {
  const bodyHtml = mdToNewsletterHtml(opts.content);
  const tags = opts.painPointTags
    .slice(0, 4)
    .map((t) => t.replace(/_/g, " "))
    .join(" · ")
    .toUpperCase();

  const blogUrl = `${SITE_URL}/blog/${opts.slug}`;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto">

  <!-- Featured image -->
  <a href="${blogUrl}" style="display:block;margin-bottom:28px">
    <img src="${opts.imageUrl}"
         alt="${opts.seoTitle.replace(/"/g, "&quot;")}"
         width="680"
         style="width:100%;height:auto;border-radius:12px;display:block" />
  </a>

  ${tags ? `<p style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7C83FF;margin:0 0 24px">${tags}</p>` : ""}

  <!-- Article body -->
  ${bodyHtml}

  <!-- Divider -->
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:36px 0">

  <!-- CTA -->
  <div style="background:#f5f6ff;border-radius:14px;padding:28px 24px;text-align:center">
    <p style="font-weight:700;font-size:1.15rem;color:#0d0f1a;margin:0 0 8px">
      Why are your applications going silent?
    </p>
    <p style="color:#555;margin:0 0 20px;font-size:.95rem">
      Job Genie gives you a free Application Silence Score and matches you to
      300,000+ specialist recruiters — no account needed.
    </p>
    <a href="${SITE_URL}/"
       style="display:inline-block;background:#7C83FF;color:#fff;font-weight:700;
              padding:13px 26px;border-radius:10px;text-decoration:none;font-size:.95rem">
      Start my free Autopsy →
    </a>
  </div>

  <!-- Back-link -->
  <p style="font-size:11px;color:#aaa;text-align:center;margin-top:20px">
    Originally published at
    <a href="${blogUrl}" style="color:#7C83FF">${blogUrl.replace("https://", "")}</a>
  </p>

</div>`;
}

// ---------------------------------------------------------------------------
// Main migrator
// ---------------------------------------------------------------------------

export interface MigrateResult {
  assetId: number;
  slug: string;
  beehiivPostId: string;
  beehiivWebUrl: string | null;
  title: string;
}

/**
 * Migrate one blog post to Beehiiv as a web-only, backdated draft.
 * Pass assetId to pick a specific post, or omit to pick the oldest unmigrated one.
 */
export async function migrateBlogPostToBeehiiv(
  assetId?: number
): Promise<MigrateResult> {
  // 1. Pick the asset
  const rows = await listUnmigratedBlogPosts(20);
  const row = assetId ? rows.find((r) => r.asset.id === assetId) : rows[0];

  if (!row) {
    throw new Error(
      assetId
        ? `Blog post asset #${assetId} not found or already migrated`
        : "No unmigrated blog posts available"
    );
  }

  const { asset, question } = row;
  const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
  const meta = (asset.engagementMetricsJson ?? {}) as Record<string, unknown>;

  const slug = String(asset.externalId ?? "");
  if (!slug) throw new Error(`Asset #${asset.id} has no slug — run blog SEO step first`);

  const seoTitle = String(meta["seoTitle"] ?? question.normalisedQuestion);
  const metaDescription = String(meta["metaDescription"] ?? "");
  const content = String(payload["content"] ?? "");
  const painPointTags = Array.isArray(payload["pain_point_tags"])
    ? (payload["pain_point_tags"] as string[])
    : question.painPointTags ?? [];
  const imageUrl = String(
    meta["featuredImageUrl"] ??
    payload["image_dark_teal_url"] ??
    `${SITE_URL}/brand/blog-og-dark-teal.png`
  );

  // Backdate to original publication timestamp
  const publishDate = asset.scheduledFor ?? asset.publishedAt ?? new Date();
  const publishDateUnix = Math.floor(publishDate.getTime() / 1000);

  // 2. Render HTML
  const htmlContent = buildBlogWebHtml({
    slug,
    seoTitle,
    content,
    painPointTags,
    imageUrl,
  });

  // 3. Push to Beehiiv (web-only draft, backdated)
  logger.info(
    { assetId: asset.id, slug, title: seoTitle },
    "blog-migrator: creating Beehiiv web post"
  );

  const result = await createBeehiivWebPost({
    title: seoTitle,
    subtitle: metaDescription.slice(0, 280),
    htmlContent,
    slug,
    publishDate: publishDateUnix,
    contentTags: painPointTags.slice(0, 5).map((t) => t.replace(/_/g, "-")),
    thumbnailUrl: imageUrl,
  });

  if (!result) throw new Error("Beehiiv credentials not configured");

  // 4. Record Beehiiv post ID in DB (non-destructive merge)
  await markBlogPostMigratedToBeehiiv(asset.id, result.id, result.webUrl);

  logger.info(
    { assetId: asset.id, beehiivPostId: result.id, webUrl: result.webUrl },
    "blog-migrator: web post created"
  );

  return {
    assetId: asset.id,
    slug,
    beehiivPostId: result.id,
    beehiivWebUrl: result.webUrl,
    title: seoTitle,
  };
}
