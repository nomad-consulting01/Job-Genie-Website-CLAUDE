import { Router } from "express";
import { SubscribeNewsletterBody } from "@workspace/api-zod";
import { getDb } from "../db/sqlite.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/newsletter", async (req, res) => {
  const parse = SubscribeNewsletterBody.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid newsletter payload" });
  }

  const body = parse.data;
  const { email } = body;

  const BEEHIIV_API_KEY = process.env["BEEHIIV_API_KEY"];
  const BEEHIIV_PUBLICATION_ID = process.env["BEEHIIV_PUBLICATION_ID"];

  if (BEEHIIV_API_KEY && BEEHIIV_PUBLICATION_ID) {
    try {
      const beehiivRes = await fetch(
        `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BEEHIIV_API_KEY}`,
          },
          body: JSON.stringify({
            email,
            reactivate_existing: true,
            send_welcome_email: false,
            utm_source: body.utm_source ?? "job-genie-website",
            utm_medium: body.utm_medium ?? "landing-page",
            utm_campaign: body.utm_campaign ?? body.page_slug ?? "homepage",
            utm_content: body.utm_content ?? null,
            utm_term: body.utm_term ?? null,
            custom_fields: [
              ...(body.first_name
                ? [{ name: "First Name", value: body.first_name }]
                : []),
              ...(body.page_slug
                ? [{ name: "page_slug", value: body.page_slug }]
                : []),
              ...(body.experiment_id
                ? [{ name: "experiment_id", value: body.experiment_id }]
                : []),
              ...(body.variant_id
                ? [{ name: "variant_id", value: body.variant_id }]
                : []),
              ...(body.visitor_id
                ? [{ name: "visitor_id", value: body.visitor_id }]
                : []),
            ],
          }),
        }
      );

      if (!beehiivRes.ok) {
        const errText = await beehiivRes.text();
        logger.warn({ status: beehiivRes.status, body: errText }, "Beehiiv API error");
        return res.status(502).json({ ok: false, error: "Newsletter provider error — try again later" });
      }
    } catch (err) {
      logger.error({ err }, "Beehiiv fetch failed");
      return res.status(502).json({ ok: false, error: "Newsletter provider unreachable — try again later" });
    }
  } else {
    logger.warn("BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID not set — skipping Beehiiv sync");
  }

  // newsletter_submit_success is tracked client-side via /api/events (with full attribution).
  // Do NOT insert server-side to avoid double-counting the conversion event.
  return res.json({ ok: true, message: "Successfully subscribed" });
});

export default router;
