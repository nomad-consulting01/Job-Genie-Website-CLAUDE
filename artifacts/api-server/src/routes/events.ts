import { Router } from "express";
import { getDb } from "../db/sqlite.js";
import { TrackEventBody } from "@workspace/api-zod";
import { createHash } from "crypto";

const router = Router();

const ALLOWED_EVENTS = new Set([
  "page_view",
  "scroll_25", "scroll_50", "scroll_75", "scroll_90",
  "time_on_page_30s", "time_on_page_60s",
  "exit_intent",
  "faq_open",
  "free_autopsy_click",
  "hero_cta_click",
  "secondary_cta_click",
  "truth_layer_cta_click",
  "truth_layer_section_view",
  "comparison_section_view",
  "newsletter_form_view",
  "newsletter_signup_intent",
  "newsletter_submit_attempt",
  "newsletter_submit_success",
  "newsletter_submit_error",
  "pricing_cta_click",
  "experiment_assigned",
]);

router.post("/events", (req, res) => {
  const parse = TrackEventBody.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid event payload" });
  }

  const body = parse.data;

  if (!ALLOWED_EVENTS.has(body.event_name)) {
    return res.status(400).json({ error: `Unknown event: ${body.event_name}` });
  }

  const ip = String(
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || ""
  );
  const ipHash = ip
    ? createHash("sha256").update(ip).digest("hex").slice(0, 16)
    : null;

  const db = getDb();
  db.prepare(
    `INSERT INTO conversion_events
      (event_name, session_id, visitor_id, page_slug, experiment_id, variant_id,
       traffic_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
       referrer, device_type, browser, conversion_value, metadata, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    body.event_name,
    body.session_id ?? null,
    body.visitor_id ?? null,
    body.page_slug,
    body.experiment_id ?? null,
    body.variant_id ?? null,
    body.traffic_source ?? null,
    body.utm_source ?? null,
    body.utm_medium ?? null,
    body.utm_campaign ?? null,
    body.utm_content ?? null,
    body.utm_term ?? null,
    body.referrer ?? null,
    body.device_type ?? null,
    body.browser ?? null,
    body.conversion_value ?? null,
    body.metadata ? JSON.stringify(body.metadata) : null,
    ipHash
  );

  return res.json({ ok: true });
});

export default router;
