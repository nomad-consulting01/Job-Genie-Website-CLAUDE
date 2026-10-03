import { Router } from "express";
import { SubscribeNewsletterBody } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";

const router = Router();
const AUTOPSY_PUBLICATION_ID = "pub_af7c9c60-c55a-4f88-9c44-dc48b00d147f";
const AUTOPSY_AUTOMATION_ID = "aut_badd5896-ca28-4019-9eed-a16f0aa58465";
const NEWSLETTER_HANDLER = "fork-journey-precheck";
const BEEHIIV_BASE = "https://api.beehiiv.com/v2";

async function autopsyJourneyExists(publicationId: string, subscriptionId: string, apiKey: string, attempts = 4): Promise<boolean> {
  // Beehiiv may not expose the new journey immediately after subscription creation.
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 500));
    for (let page = 1; ; page++) {
      const response = await fetch(
        `${BEEHIIV_BASE}/publications/${publicationId}/automations/${AUTOPSY_AUTOMATION_ID}/journeys?limit=100&page=${page}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok) throw new Error(`Beehiiv journey lookup failed (HTTP ${response.status})`);
      const result = await response.json() as { data?: { subscription_id?: string }[]; total_pages?: number };
      if (!Array.isArray(result.data) ||
          result.data.some((journey) => typeof journey?.subscription_id !== "string") ||
          (result.total_pages !== undefined && (!Number.isInteger(result.total_pages) || result.total_pages < 0))) {
        throw new Error("Beehiiv journey lookup returned an invalid response");
      }
      const matched = result.data.some((journey) => journey.subscription_id === subscriptionId);
      logger.info({
        automationId: AUTOPSY_AUTOMATION_ID,
        handler: NEWSLETTER_HANDLER,
        attempt: attempt + 1,
        page,
        returnedJourneys: result.data.length,
        totalPages: result.total_pages,
        matched,
      }, "Autopsy journey verification");
      if (matched) return true;
      if (page >= (result.total_pages ?? 1)) break;
    }
  }
  return false;
}

router.post("/newsletter", async (req, res) => {
  // A harmless invalid-payload probe identifies the running production handler
  // without subscribing anyone or revealing credentials/subscriber information.
  res.setHeader("X-Autopsy-Automation-Id", AUTOPSY_AUTOMATION_ID);
  res.setHeader("X-Newsletter-Handler", NEWSLETTER_HANDLER);
  res.setHeader("Cache-Control", "no-store");
  const parse = SubscribeNewsletterBody.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid newsletter payload" });
  }

  const body = parse.data;
  const { email } = body;

  const BEEHIIV_API_KEY = process.env["BEEHIIV_API_KEY"];
  const BEEHIIV_PUBLICATION_ID = process.env["BEEHIIV_PUBLICATION_ID"];
  const isAutopsySignup = /^\/free-autopsy(?:2|3|4)?\/?$/.test(body.page_slug ?? "");

  if (BEEHIIV_API_KEY && BEEHIIV_PUBLICATION_ID) {
    try {
      const publicationId = BEEHIIV_PUBLICATION_ID.startsWith("pub_")
        ? BEEHIIV_PUBLICATION_ID : `pub_${BEEHIIV_PUBLICATION_ID}`;
      if (isAutopsySignup && publicationId !== AUTOPSY_PUBLICATION_ID) {
        logger.error("Free Autopsy Beehiiv publication does not match the configured automation");
        return res.status(502).json({ ok: false, error: "Newsletter provider configuration error" });
      }
      let existingSubscriptionId: string | undefined;
      if (isAutopsySignup) {
        const lookup = await fetch(
          `${BEEHIIV_BASE}/publications/${publicationId}/subscriptions?email=${encodeURIComponent(email)}&limit=10`,
          { headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` }, signal: AbortSignal.timeout(10_000) },
        );
        if (!lookup.ok) throw new Error(`Beehiiv subscriber lookup failed (HTTP ${lookup.status})`);
        const result = await lookup.json() as { data?: { id?: string; email?: string; status?: string }[] };
        if (!Array.isArray(result.data)) throw new Error("Beehiiv subscriber lookup returned an invalid response");
        existingSubscriptionId = result.data.find((subscriber) =>
          subscriber.email?.toLowerCase() === email.toLowerCase() && subscriber.status === "active"
        )?.id;
        if (existingSubscriptionId &&
            await autopsyJourneyExists(publicationId, existingSubscriptionId, BEEHIIV_API_KEY, 1)) {
          // Never call create/enroll again when the fork already contains a
          // journey (including a completed journey). Retests must be read-only.
          return res.json({ ok: true, message: "Successfully subscribed" });
        }
      }
      const beehiivRes = await fetch(
        `${BEEHIIV_BASE}/publications/${publicationId}/subscriptions`,
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
            ...(isAutopsySignup ? { automation_ids: [AUTOPSY_AUTOMATION_ID] } : {}),
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
      if (isAutopsySignup) {
        const created = await beehiivRes.json() as { data?: { id?: string } };
        const subscriptionId = created.data?.id;
        if (!subscriptionId) {
          throw new Error("Beehiiv subscription response omitted the subscriber ID");
        }
        let hasJourney = await autopsyJourneyExists(publicationId, subscriptionId, BEEHIIV_API_KEY);
        if (!hasJourney && existingSubscriptionId === subscriptionId) {
          // API create does not re-enroll an existing subscriber. Only repair a
          // known active subscriber with no journey; never blindly re-enter one.
          const enroll = await fetch(
            `${BEEHIIV_BASE}/publications/${publicationId}/automations/${AUTOPSY_AUTOMATION_ID}/journeys`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ subscription_id: subscriptionId }),
              signal: AbortSignal.timeout(10_000),
            },
          );
          // Another request may have enrolled the same subscriber in parallel.
          // Re-read in either case; only a visible journey counts as success.
          if (!enroll.ok) logger.warn({ status: enroll.status, automationId: AUTOPSY_AUTOMATION_ID, handler: NEWSLETTER_HANDLER }, "Beehiiv existing-subscriber enrollment failed");
          hasJourney = await autopsyJourneyExists(publicationId, subscriptionId, BEEHIIV_API_KEY);
        }
        if (!hasJourney) {
          logger.error({ automationId: AUTOPSY_AUTOMATION_ID, handler: NEWSLETTER_HANDLER }, "Free Autopsy subscription created without a verified automation journey");
          return res.status(502).json({ ok: false, error: "Welcome sequence not confirmed — please contact support" });
        }
      }
    } catch (err) {
      logger.error({ err }, "Beehiiv fetch failed");
      return res.status(502).json({ ok: false, error: "Newsletter provider unreachable — try again later" });
    }
  } else {
    logger.warn("BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID not set — cannot subscribe");
    return res.status(503).json({ ok: false, error: "Newsletter provider not configured" });
  }

  // newsletter_submit_success is tracked client-side via /api/events (with full attribution).
  // Do NOT insert server-side to avoid double-counting the conversion event.
  return res.json({ ok: true, message: "Successfully subscribed" });
});

export default router;
