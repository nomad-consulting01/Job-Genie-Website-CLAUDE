import { Router } from "express";
import { getDb } from "../db/sqlite.js";

const router = Router();

function rate(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 10000) / 100;
}

router.get("/metrics", (_req, res) => {
  const db = getDb();

  const totalViews = (db.prepare(
    "SELECT COUNT(*) as c FROM conversion_events WHERE event_name='page_view'"
  ).get() as { c: number }).c;

  const uniqueVisitors = (db.prepare(
    "SELECT COUNT(DISTINCT visitor_id) as c FROM conversion_events WHERE event_name='page_view' AND visitor_id IS NOT NULL"
  ).get() as { c: number }).c;

  const autopsyClicks = (db.prepare(
    "SELECT COUNT(*) as c FROM conversion_events WHERE event_name='free_autopsy_click'"
  ).get() as { c: number }).c;

  const newsletterSignups = (db.prepare(
    "SELECT COUNT(*) as c FROM conversion_events WHERE event_name='newsletter_signup_complete'"
  ).get() as { c: number }).c;

  const bySlugRaw = db.prepare(
    `SELECT
      page_slug as slug,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      COUNT(DISTINCT CASE WHEN event_name='page_view' AND visitor_id IS NOT NULL THEN visitor_id END) as unique_visitors,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as free_autopsy_clicks,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_cta_clicks,
      SUM(CASE WHEN event_name='newsletter_signup_complete' THEN 1 ELSE 0 END) as newsletter_signups
    FROM conversion_events
    GROUP BY page_slug
    ORDER BY page_views DESC`
  ).all() as Array<{
    slug: string; page_views: number; unique_visitors: number;
    free_autopsy_clicks: number; hero_cta_clicks: number; newsletter_signups: number;
  }>;

  const bySlug = bySlugRaw.map((row) => ({
    ...row,
    conversion_rate: rate(row.free_autopsy_clicks, row.page_views),
    autopsy_rate: rate(row.free_autopsy_clicks, row.page_views),
    newsletter_rate: rate(row.newsletter_signups, row.page_views),
    hero_ctr: rate(row.hero_cta_clicks, row.page_views),
  }));

  const topUtmCampaigns = db.prepare(
    `SELECT utm_campaign, COUNT(*) as visits
     FROM conversion_events
     WHERE event_name='page_view' AND utm_campaign IS NOT NULL
     GROUP BY utm_campaign ORDER BY visits DESC LIMIT 5`
  ).all();

  return res.json({
    total_page_views: totalViews,
    total_unique_visitors: uniqueVisitors,
    total_free_autopsy_clicks: autopsyClicks,
    total_newsletter_signups: newsletterSignups,
    overall_conversion_rate: rate(autopsyClicks, totalViews),
    by_slug: bySlug,
    top_slug: bySlug[0]?.slug ?? null,
    worst_slug: bySlug.length > 1 ? bySlug[bySlug.length - 1]?.slug ?? null : null,
    top_utm_campaigns: topUtmCampaigns,
  });
});

router.get("/metrics/:slug", (req, res) => {
  const { slug } = req.params;
  const db = getDb();

  const base = db.prepare(
    `SELECT
      page_slug as slug,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      COUNT(DISTINCT CASE WHEN event_name='page_view' AND visitor_id IS NOT NULL THEN visitor_id END) as unique_visitors,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as free_autopsy_clicks,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_cta_clicks,
      SUM(CASE WHEN event_name='newsletter_signup_complete' THEN 1 ELSE 0 END) as newsletter_signups,
      SUM(CASE WHEN event_name='scroll_25' THEN 1 ELSE 0 END) as scroll_25,
      SUM(CASE WHEN event_name='scroll_50' THEN 1 ELSE 0 END) as scroll_50,
      SUM(CASE WHEN event_name='scroll_75' THEN 1 ELSE 0 END) as scroll_75,
      SUM(CASE WHEN event_name='scroll_90' THEN 1 ELSE 0 END) as scroll_90,
      SUM(CASE WHEN event_name='comparison_section_view' THEN 1 ELSE 0 END) as comparison_views,
      SUM(CASE WHEN event_name='truth_layer_section_view' THEN 1 ELSE 0 END) as truth_layer_views,
      SUM(CASE WHEN event_name='faq_open' THEN 1 ELSE 0 END) as faq_opens
    FROM conversion_events WHERE page_slug = ?`
  ).get(slug) as {
    slug: string; page_views: number; unique_visitors: number;
    free_autopsy_clicks: number; hero_cta_clicks: number; newsletter_signups: number;
    scroll_25: number; scroll_50: number; scroll_75: number; scroll_90: number;
    comparison_views: number; truth_layer_views: number; faq_opens: number;
  } | null;

  if (!base || base.page_views === 0) {
    const variantRow = db.prepare("SELECT * FROM landing_page_variants WHERE slug = ?").get(slug);
    if (!variantRow) return res.status(404).json({ error: "Slug not found" });
    return res.json({
      slug, page_views: 0, unique_visitors: 0, free_autopsy_clicks: 0,
      hero_cta_clicks: 0, newsletter_signups: 0, conversion_rate: 0,
      autopsy_rate: 0, newsletter_rate: 0,
      scroll_depth: { pct_25: 0, pct_50: 0, pct_75: 0, pct_90: 0 },
      section_views: { comparison: 0, truth_layer: 0, faq_opens: 0 },
      by_variant: [], by_traffic_source: [],
    });
  }

  const byVariant = db.prepare(
    `SELECT variant_id, experiment_id,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as free_autopsy_clicks,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_cta_clicks,
      SUM(CASE WHEN event_name='newsletter_signup_complete' THEN 1 ELSE 0 END) as newsletter_signups
    FROM conversion_events WHERE page_slug = ? AND variant_id IS NOT NULL
    GROUP BY variant_id, experiment_id
    ORDER BY page_views DESC`
  ).all(slug) as Array<{
    variant_id: string; experiment_id: string | null;
    page_views: number; free_autopsy_clicks: number; hero_cta_clicks: number; newsletter_signups: number;
  }>;

  const byTrafficSource = db.prepare(
    `SELECT COALESCE(traffic_source, utm_source, 'direct') as source,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as conversions
    FROM conversion_events WHERE page_slug = ? GROUP BY source ORDER BY page_views DESC`
  ).all(slug);

  const pv = base.page_views;
  const variantsSorted = byVariant.map((v) => ({
    ...v,
    autopsy_rate: rate(v.free_autopsy_clicks, v.page_views || 1),
    hero_ctr: rate(v.hero_cta_clicks, v.page_views || 1),
  }));
  const bestVariant = variantsSorted.length > 0 ? variantsSorted[0]?.variant_id ?? null : null;
  const worstVariant = variantsSorted.length > 1 ? variantsSorted[variantsSorted.length - 1]?.variant_id ?? null : null;

  return res.json({
    slug: base.slug,
    page_views: pv,
    unique_visitors: base.unique_visitors,
    free_autopsy_clicks: base.free_autopsy_clicks,
    hero_cta_clicks: base.hero_cta_clicks,
    newsletter_signups: base.newsletter_signups,
    conversion_rate: rate(base.free_autopsy_clicks, pv),
    autopsy_rate: rate(base.free_autopsy_clicks, pv),
    newsletter_rate: rate(base.newsletter_signups, pv),
    scroll_depth: {
      pct_25: rate(base.scroll_25, pv),
      pct_50: rate(base.scroll_50, pv),
      pct_75: rate(base.scroll_75, pv),
      pct_90: rate(base.scroll_90, pv),
    },
    section_views: {
      comparison: rate(base.comparison_views, pv),
      truth_layer: rate(base.truth_layer_views, pv),
      faq_opens: base.faq_opens,
    },
    top_variant: bestVariant,
    worst_variant: worstVariant,
    by_variant: variantsSorted,
    by_traffic_source: byTrafficSource,
  });
});

export default router;
