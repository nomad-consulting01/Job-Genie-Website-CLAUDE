import { Router, type Request, type Response, type NextFunction } from "express";
import { getDb } from "../db/sqlite.js";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const ADMIN_TOKEN = process.env["ADMIN_TOKEN"];
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: "Admin not configured — set ADMIN_TOKEN env var" });
    return;
  }
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(requireAdmin);

router.get("/metrics", (_req, res) => {
  const db = getDb();
  const total = db.prepare(
    `SELECT
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as total_page_views,
      COUNT(DISTINCT CASE WHEN event_name='page_view' AND visitor_id IS NOT NULL THEN visitor_id END) as total_unique_visitors,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as total_free_autopsy_clicks,
      SUM(CASE WHEN event_name='newsletter_signup_complete' THEN 1 ELSE 0 END) as total_newsletter_signups
    FROM conversion_events`
  ).get() as { total_page_views: number; total_unique_visitors: number; total_free_autopsy_clicks: number; total_newsletter_signups: number };

  const bySlugs = db.prepare(
    `SELECT page_slug as slug,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      COUNT(DISTINCT CASE WHEN event_name='page_view' AND visitor_id IS NOT NULL THEN visitor_id END) as unique_visitors,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as free_autopsy_clicks,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_cta_clicks,
      SUM(CASE WHEN event_name='newsletter_signup_complete' THEN 1 ELSE 0 END) as newsletter_signups
    FROM conversion_events GROUP BY page_slug ORDER BY page_views DESC`
  ).all() as Array<{ slug: string; page_views: number; unique_visitors: number; free_autopsy_clicks: number; hero_cta_clicks: number; newsletter_signups: number }>;

  const pv = Number(total?.total_page_views ?? 0);
  const ac = Number(total?.total_free_autopsy_clicks ?? 0);

  return res.json({
    total_page_views: pv,
    total_unique_visitors: Number(total?.total_unique_visitors ?? 0),
    total_free_autopsy_clicks: ac,
    total_newsletter_signups: Number(total?.total_newsletter_signups ?? 0),
    overall_conversion_rate: pv > 0 ? parseFloat(((ac / pv) * 100).toFixed(2)) : 0,
    by_slug: bySlugs.map(row => ({
      ...row,
      conversion_rate: row.page_views > 0 ? parseFloat(((row.free_autopsy_clicks / row.page_views) * 100).toFixed(2)) : 0,
    })),
  });
});

router.get("/optimization-report", (_req, res) => {
  const db = getDb();
  const slugStats = db.prepare(
    `SELECT page_slug as slug,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as views,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as conversions,
      SUM(CASE WHEN event_name='newsletter_signup_complete' THEN 1 ELSE 0 END) as newsletter,
      SUM(CASE WHEN event_name='scroll_50' THEN 1 ELSE 0 END) as scroll50,
      SUM(CASE WHEN event_name='scroll_75' THEN 1 ELSE 0 END) as scroll75,
      SUM(CASE WHEN event_name='exit_intent' THEN 1 ELSE 0 END) as exits,
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as engaged30s
    FROM conversion_events GROUP BY page_slug ORDER BY views DESC`
  ).all() as Array<{ slug: string; views: number; conversions: number; newsletter: number; scroll50: number; scroll75: number; exits: number; engaged30s: number }>;

  const savedRecs = db.prepare(
    "SELECT * FROM optimization_recommendations ORDER BY created_at DESC LIMIT 50"
  ).all();

  const insights = slugStats.map((row) => {
    const cvr = row.views > 0 ? row.conversions / row.views : 0;
    const scrollRate = row.views > 0 ? row.scroll50 / row.views : 0;
    const engagementRate = row.views > 0 ? row.engaged30s / row.views : 0;
    const exitRate = row.views > 0 ? row.exits / row.views : 0;

    const diagnostics: string[] = [];
    if (row.views > 30 && cvr < 0.02) diagnostics.push(`Low CVR ${(cvr*100).toFixed(1)}% — test a stronger headline or CTA copy.`);
    if (scrollRate < 0.3 && row.views > 20) diagnostics.push(`Only ${(scrollRate*100).toFixed(0)}% scroll past 50% — hero section may be losing users; test shorter copy above the fold.`);
    if (engagementRate < 0.4 && row.views > 20) diagnostics.push(`Only ${(engagementRate*100).toFixed(0)}% stay 30s+ — consider faster load and sharper opening hook.`);
    if (exitRate > 0.5 && row.views > 20) diagnostics.push(`High exit-intent rate ${(exitRate*100).toFixed(0)}% — consider an exit-intent popup or stronger sticky bar.`);
    if (cvr > 0.08) diagnostics.push(`High-performing slug (${(cvr*100).toFixed(1)}% CVR) — scale traffic to this variant.`);

    if (diagnostics.length > 0) {
      const recentRec = db.prepare(
        `SELECT id FROM optimization_recommendations WHERE slug = ? AND created_at > datetime('now', '-24 hours') LIMIT 1`
      ).get(row.slug);
      if (!recentRec) {
        db.prepare(
          `INSERT INTO optimization_recommendations (slug, recommendation, status) VALUES (?, ?, 'draft')`
        ).run(row.slug, diagnostics.join(' | '));
      }
    }

    return {
      slug: row.slug,
      views: row.views,
      conversions: row.conversions,
      newsletter: row.newsletter,
      conversion_rate: cvr,
      scroll_rate_50pct: scrollRate,
      engagement_rate_30s: engagementRate,
      exit_intent_rate: exitRate,
      diagnostics,
    };
  });

  return res.json({ insights, saved_recommendations: savedRecs });
});

router.get("/variants", (_req, res) => {
  const db = getDb();
  const variants = db.prepare("SELECT * FROM landing_page_variants ORDER BY created_at DESC").all();
  return res.json({ variants });
});

router.post("/variants", (req, res) => {
  const { slug, headline, subheadline, eyebrow, hero_quote, cta_primary, cta_secondary, variant_id, experiment_id } = req.body;
  if (!slug) return res.status(400).json({ error: "slug is required" });

  const db = getDb();
  try {
    const result = db.prepare(
      `INSERT INTO landing_page_variants
        (slug, headline, subheadline, eyebrow, hero_quote, cta_primary, cta_secondary, variant_id, experiment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(slug, headline ?? null, subheadline ?? null, eyebrow ?? null, hero_quote ?? null, cta_primary ?? null, cta_secondary ?? null, variant_id ?? "control", experiment_id ?? null);
    return res.status(201).json({ id: (result as { lastInsertRowid: number }).lastInsertRowid });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Slug already exists" });
    }
    throw err;
  }
});

router.post("/variants/:id/activate", (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const variant = db.prepare("SELECT * FROM landing_page_variants WHERE id = ?").get(id) as { slug: string; status: string } | null;
  if (!variant) return res.status(404).json({ error: "Variant not found" });

  db.prepare("UPDATE landing_page_variants SET status='active', updated_at=datetime('now') WHERE id=?").run(id);
  db.prepare(
    `INSERT INTO variant_change_log (slug, variant_id, action, previous_status, new_status) VALUES (?, ?, 'activate', ?, 'active')`
  ).run(variant.slug, id, variant.status);

  return res.json({ ok: true, status: "active" });
});

router.post("/variants/:id/pause", (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const variant = db.prepare("SELECT * FROM landing_page_variants WHERE id = ?").get(id) as { slug: string; status: string } | null;
  if (!variant) return res.status(404).json({ error: "Variant not found" });

  db.prepare("UPDATE landing_page_variants SET status='paused', updated_at=datetime('now') WHERE id=?").run(id);
  db.prepare(
    `INSERT INTO variant_change_log (slug, variant_id, action, previous_status, new_status) VALUES (?, ?, 'pause', ?, 'paused')`
  ).run(variant.slug, id, variant.status);

  return res.json({ ok: true, status: "paused" });
});

router.get("/export/events.csv", (_req, res) => {
  const db = getDb();
  const events = db.prepare(
    `SELECT id, event_name, session_id, visitor_id, page_slug, experiment_id, variant_id,
            traffic_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            referrer, device_type, browser, conversion_value, created_at
     FROM conversion_events ORDER BY created_at DESC LIMIT 10000`
  ).all() as Record<string, unknown>[];

  const headers = events[0] ? Object.keys(events[0]) : [
    "id","event_name","session_id","visitor_id","page_slug","experiment_id","variant_id",
    "traffic_source","utm_source","utm_medium","utm_campaign","utm_content","utm_term",
    "referrer","device_type","browser","conversion_value","created_at"
  ];

  const csv = [
    headers.join(","),
    ...events.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=events.csv");
  return res.send(csv);
});

router.get("/export/metrics.csv", (_req, res) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT page_slug,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      COUNT(DISTINCT CASE WHEN event_name='page_view' AND visitor_id IS NOT NULL THEN visitor_id END) as unique_visitors,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as autopsy_clicks,
      SUM(CASE WHEN event_name='newsletter_signup_complete' THEN 1 ELSE 0 END) as newsletter_signups
    FROM conversion_events GROUP BY page_slug ORDER BY page_views DESC`
  ).all() as Record<string, unknown>[];

  const headers = ["page_slug","page_views","unique_visitors","autopsy_clicks","newsletter_signups","conversion_rate"];
  const csv = [
    headers.join(","),
    ...rows.map((row) => {
      const v = Number(row["page_views"] ?? 0), c = Number(row["autopsy_clicks"] ?? 0);
      return [JSON.stringify(row["page_slug"] ?? ""), v, row["unique_visitors"] ?? 0, c, row["newsletter_signups"] ?? 0, v > 0 ? ((c/v)*100).toFixed(2) : "0.00"].join(",");
    }),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=metrics.csv");
  return res.send(csv);
});

export default router;
