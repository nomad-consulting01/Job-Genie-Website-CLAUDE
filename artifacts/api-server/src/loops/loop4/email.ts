import { listUnpublishedNewsletterAssets, markAssetDistributed } from "../../corpus/db.js";
import { createBeehiivDraft, isBeehiivConfigured } from "../../integrations/beehiiv.js";
import { logger } from "../../lib/logger.js";

export interface EmailResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

const FROM_EMAIL = process.env["EMAIL_FROM"] ?? "Job Genie <newsletter@job-genie.ai>";
const SUBSCRIBER_LIST = (process.env["EMAIL_SUBSCRIBER_LIST"] ?? "").split(",").map((e) => e.trim()).filter(Boolean);
const SITE_URL = process.env["SITE_URL"] ?? "https://job-genie.ai";

async function sendViaResend(subject: string, html: string, to: string[]): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return false;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    logger.warn({ status: resp.status, body: text }, "Loop 4 Email: Resend send failed");
    return false;
  }

  return true;
}

function buildEmailHtml(payload: Record<string, unknown>): string {
  const subject = String(payload["subject"] ?? "Job Genie Newsletter");
  const content = String(payload["content"] ?? payload["body"] ?? "");
  const ctaText = "Get Your Free Application Autopsy";
  const ctaUrl = `${SITE_URL}/?utm_source=email&utm_medium=newsletter`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .header { background: #0f172a; padding: 24px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 700; }
  .header span { color: #2dd4bf; }
  .body { padding: 32px; color: #374151; line-height: 1.7; font-size: 15px; }
  .body h2 { color: #111827; font-size: 18px; margin-top: 24px; }
  .cta { text-align: center; padding: 24px 32px 32px; }
  .cta a { background: #0d9488; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; }
  .footer { background: #f9fafb; padding: 16px 32px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>
<div class="container">
  <div class="header"><h1>Job <span>Genie</span></h1></div>
  <div class="body">${content.replace(/\n/g, "<br>")}</div>
  <div class="cta"><a href="${ctaUrl}">${ctaText} →</a></div>
  <div class="footer">Job Genie · <a href="${SITE_URL}/blog" style="color:#6b7280">Read the blog</a> · You received this because you signed up for Job Genie insights.</div>
</div>
</body>
</html>`;
}

export async function runEmail(limit: number): Promise<EmailResult> {
  const beehiivEnabled = isBeehiivConfigured();
  const resendKey = process.env["RESEND_API_KEY"];

  if (!beehiivEnabled && !resendKey) {
    logger.info("Loop 4 Email: skipping — neither BEEHIIV_API_KEY nor RESEND_API_KEY configured");
    return {
      processed: 0, succeeded: 0, failed: 0, skipped: 0,
      errors: ["No email provider configured — set BEEHIIV_API_KEY (recommended) or RESEND_API_KEY"],
    };
  }

  if (!beehiivEnabled && SUBSCRIBER_LIST.length === 0) {
    logger.info("Loop 4 Email: skipping — Resend mode but EMAIL_SUBSCRIBER_LIST is empty");
    return {
      processed: 0, succeeded: 0, failed: 0, skipped: 0,
      errors: ["Resend mode requires EMAIL_SUBSCRIBER_LIST (comma-separated emails)"],
    };
  }

  const pending = await listUnpublishedNewsletterAssets(limit);
  logger.info({ count: pending.length, mode: beehiivEnabled ? "beehiiv" : "resend" }, "Loop 4 Email: newsletter assets to process");

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const { asset, question } of pending) {
    const payload = (asset.payloadJson ?? {}) as Record<string, unknown>;
    const subject = String(payload["subject"] ?? `Job Search Intelligence: ${question.normalisedQuestion.slice(0, 60)}`);
    const html = buildEmailHtml(payload);
    const subtitle = String(payload["previewText"] ?? payload["subtitle"] ?? question.normalisedQuestion);

    try {
      if (beehiivEnabled) {
        // Primary: push to Beehiiv as a draft newsletter post
        const draft = await createBeehiivDraft({
          title: subject,
          subtitle,
          htmlContent: html,
          contentTags: (question.painPointTags ?? []).slice(0, 5),
        });

        if (draft) {
          await markAssetDistributed(asset.id, `beehiiv:draft:${draft.id}`, "email");
          succeeded++;
          logger.info(
            { assetId: asset.id, beehiivPostId: draft.id, webUrl: draft.webUrl },
            "Loop 4 Email: Beehiiv draft created"
          );
        } else {
          failed++;
          errors.push(`Asset ${asset.id}: Beehiiv draft returned null`);
        }
      } else {
        // Fallback: send via Resend
        const ok = await sendViaResend(subject, html, SUBSCRIBER_LIST);
        if (ok) {
          const dateKey = new Date().toISOString().split("T")[0];
          await markAssetDistributed(asset.id, `email:sent:${dateKey}:${asset.id}`, "email");
          succeeded++;
          logger.info({ assetId: asset.id, subject, recipients: SUBSCRIBER_LIST.length }, "Loop 4 Email: newsletter sent via Resend");
        } else {
          failed++;
          errors.push(`Asset ${asset.id}: Resend API returned error`);
        }
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Asset ${asset.id}: ${msg}`);
      logger.error({ assetId: asset.id, err: msg }, "Loop 4 Email: error");
    }
  }

  return { processed: pending.length, succeeded, failed, skipped, errors };
}
