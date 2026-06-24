import { createBeehiivDraft } from "../integrations/beehiiv.js";
import {
  listUnpublishedNewsletterAssets,
  markAssetDistributed,
} from "../corpus/db.js";
import { logger } from "../lib/logger.js";

const SITE_URL = "https://job-genie.ai";

// ---------------------------------------------------------------------------
// Markdown → email-safe HTML
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code style=\"background:#f0f0f0;padding:1px 5px;border-radius:3px;font-size:.92em;\">$1</code>");
}

export function mdToNewsletterHtml(md: string): string {
  const lines = md.split("\n");
  const blocks: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushList() {
    if (!listItems.length) return;
    const tag = listType === "ol" ? "ol" : "ul";
    const items = listItems.map((li) => `<li style="margin:.35rem 0">${inlineFormat(li)}</li>`).join("\n");
    blocks.push(`<${tag} style="margin:0 0 1rem;padding-left:1.4rem;color:#333">\n${items}\n</${tag}>`);
    listItems = [];
    listType = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Headings
    const hMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (hMatch) {
      flushList();
      const level = Math.min(hMatch[1]!.length + 1, 4); // h2–h4
      const text = inlineFormat(esc(hMatch[2] ?? ""));
      const sz = level === 2 ? "1.25rem" : level === 3 ? "1.1rem" : "1rem";
      const mt = level === 2 ? "2rem" : "1.2rem";
      blocks.push(`<h${level} style="font-size:${sz};font-weight:700;color:#0d0f1a;margin:${mt} 0 .5rem;line-height:1.25">${text}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.*)/);
    if (ulMatch) {
      if (listType === "ol") flushList();
      listType = "ul";
      listItems.push(ulMatch[1] ?? "");
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.*)/);
    if (olMatch) {
      if (listType === "ul") flushList();
      listType = "ol";
      listItems.push(olMatch[1] ?? "");
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushList();
      blocks.push(`<hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0">`);
      continue;
    }

    // Blank line — flush list, skip otherwise
    if (!line.trim()) {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    blocks.push(`<p style="margin:0 0 1rem;line-height:1.7;color:#333">${inlineFormat(esc(line))}</p>`);
  }

  flushList();
  return blocks.join("\n");
}

// ---------------------------------------------------------------------------
// Full newsletter HTML wrapper
// ---------------------------------------------------------------------------

export function buildNewsletterEmailHtml(opts: {
  question: string;
  content: string;
  painPointTags: string[];
  imageUrl: string;
  sourceUrl?: string | null;
}): string {
  const bodyHtml = mdToNewsletterHtml(opts.content);
  const tags = opts.painPointTags
    .slice(0, 4)
    .map((t) => t.replace(/_/g, " "))
    .join(" · ")
    .toUpperCase();

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto">

  <!-- Banner -->
  <a href="${SITE_URL}/" style="display:block;margin-bottom:24px">
    <img src="${opts.imageUrl}"
         alt="Job Genie"
         width="600"
         style="width:100%;height:auto;border-radius:12px;display:block" />
  </a>

  <!-- Tag line -->
  ${tags ? `<p style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7C83FF;margin:0 0 20px">${esc(tags)}</p>` : ""}

  <!-- Body -->
  ${bodyHtml}

  <!-- Divider -->
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">

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

  <!-- Footer -->
  <p style="font-size:11px;color:#aaa;text-align:center;margin-top:24px">
    Job Genie · Practical, evidence-led answers for the job search ·
    <a href="${SITE_URL}/" style="color:#aaa">${SITE_URL.replace("https://", "")}</a>
  </p>

</div>`;
}

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

export interface PublishResult {
  assetId: number;
  beehiivPostId: string;
  webUrl: string | null;
  title: string;
  status: "draft";
}

/** Publish one newsletter asset to Beehiiv as a draft.
 *  Pass assetId to pick a specific asset, or omit to pick the oldest unpublished one. */
export async function publishNewsletterAsset(
  assetId?: number
): Promise<PublishResult> {
  // 1. Fetch the candidate
  const rows = await listUnpublishedNewsletterAssets(20);
  const row = assetId
    ? rows.find((r) => r.asset.id === assetId)
    : rows[0];

  if (!row) {
    throw new Error(
      assetId
        ? `Newsletter asset #${assetId} not found or already published`
        : "No unpublished newsletter assets available"
    );
  }

  const { asset, question } = row;
  const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;

  const questionText = String(payload["question"] ?? question.normalisedQuestion);
  const content = String(payload["content"] ?? "");
  const painPointTags = Array.isArray(payload["pain_point_tags"])
    ? (payload["pain_point_tags"] as string[])
    : question.painPointTags ?? [];
  const imageUrl = String(
    payload["image_dark_teal_url"] ?? `${SITE_URL}/brand/newsletter-dark-teal.png`
  );

  // 2. Build a clean title
  const title = questionText.replace(/[*_`]/g, "").replace(/\?+$/, "").trim() + "?";

  // 3. Build subtitle (first non-empty paragraph after any heading/bold intro)
  const lines = content.split("\n").map((l) => l.trim());
  const subtitle =
    lines.find(
      (l) =>
        l.length > 40 &&
        !l.startsWith("#") &&
        !l.startsWith("**") &&
        !l.startsWith("-") &&
        !l.startsWith("*")
    ) ?? painPointTags.map((t) => t.replace(/_/g, " ")).join(", ");

  // 4. Render HTML
  const htmlContent = buildNewsletterEmailHtml({
    question: questionText,
    content,
    painPointTags,
    imageUrl,
    sourceUrl: String(payload["source_url"] ?? ""),
  });

  // 5. Push to Beehiiv
  logger.info({ assetId: asset.id, title }, "newsletter-publisher: creating Beehiiv draft");

  const result = await createBeehiivDraft({
    title,
    subtitle: String(subtitle).slice(0, 280),
    htmlContent,
    contentTags: painPointTags.slice(0, 5).map((t) => t.replace(/_/g, "-")),
    thumbnailUrl: imageUrl,
  });

  if (!result) {
    throw new Error("Beehiiv credentials not configured");
  }

  // 6. Record the Beehiiv post ID back in the DB
  await markAssetDistributed(asset.id, result.id, "newsletter", {
    beehiivWebUrl: result.webUrl,
    publishedTitle: title,
  });

  logger.info(
    { assetId: asset.id, beehiivPostId: result.id, webUrl: result.webUrl },
    "newsletter-publisher: draft created"
  );

  return {
    assetId: asset.id,
    beehiivPostId: result.id,
    webUrl: result.webUrl,
    title,
    status: "draft",
  };
}
