import { Router } from "express";
import { getDb } from "../db/sqlite.js";
import { TrackEventBody } from "@workspace/api-zod";
import { createHash } from "crypto";

const router = Router();

router.post("/events", (req, res) => {
  const parse = TrackEventBody.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid event payload" });
  }

  const body = parse.data;

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
