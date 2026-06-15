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
    "SELECT COUNT(*) as c FROM conversion_events WHERE event_name='newsletter_submit_success'"
  ).get() as { c: number }).c;

  // Site-wide scroll depth rates
  const scrollAgg = db.prepare(
    `SELECT
      SUM(CASE WHEN event_name='scroll_25' THEN 1 ELSE 0 END) as s25,
      SUM(CASE WHEN event_name='scroll_50' THEN 1 ELSE 0 END) as s50,
      SUM(CASE WHEN event_name='scroll_75' THEN 1 ELSE 0 END) as s75,
      SUM(CASE WHEN event_name='scroll_90' THEN 1 ELSE 0 END) as s90
    FROM conversion_events`
  ).get() as { s25: number; s50: number; s75: number; s90: number };

  // Site-wide time on page / engagement rates
  const engagementAgg = db.prepare(
    `SELECT
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as t30,
      SUM(CASE WHEN event_name='time_on_page_60s' THEN 1 ELSE 0 END) as t60,
      SUM(CASE WHEN event_name='exit_intent' THEN 1 ELSE 0 END) as exits,
      SUM(CASE WHEN event_name='faq_open' THEN 1 ELSE 0 END) as faq_opens,
      SUM(CASE WHEN event_name='comparison_section_view' THEN 1 ELSE 0 END) as comparison_views,
      SUM(CASE WHEN event_name='newsletter_form_view' THEN 1 ELSE 0 END) as newsletter_views,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_cta_clicks
    FROM conversion_events`
  ).get() as {
    t30: number; t60: number; exits: number; faq_opens: number;
    comparison_views: number; newsletter_views: number; hero_cta_clicks: number;
  };

  // Bounce proxy: visitors with a page_view but zero scroll events
  const bouncedVisitors = (db.prepare(
    `SELECT COUNT(DISTINCT visitor_id) as c
     FROM conversion_events
     WHERE event_name='page_view' AND visitor_id IS NOT NULL
       AND visitor_id NOT IN (
         SELECT DISTINCT visitor_id FROM conversion_events
         WHERE event_name LIKE 'scroll_%' AND visitor_id IS NOT NULL
       )`
  ).get() as { c: number }).c;

  // By-slug breakdown
  const bySlugRaw = db.prepare(
    `SELECT
      page_slug as slug,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      COUNT(DISTINCT CASE WHEN event_name='page_view' AND visitor_id IS NOT NULL THEN visitor_id END) as unique_visitors,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as free_autopsy_clicks,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_cta_clicks,
      SUM(CASE WHEN event_name='newsletter_submit_success' THEN 1 ELSE 0 END) as newsletter_signups,
      SUM(CASE WHEN event_name='scroll_50' THEN 1 ELSE 0 END) as scroll_50,
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as engaged_30s,
      SUM(CASE WHEN event_name='faq_open' THEN 1 ELSE 0 END) as faq_opens
    FROM conversion_events
    GROUP BY page_slug
    ORDER BY page_views DESC`
  ).all() as Array<{
    slug: string; page_views: number; unique_visitors: number;
    free_autopsy_clicks: number; hero_cta_clicks: number; newsletter_signups: number;
    scroll_50: number; engaged_30s: number; faq_opens: number;
  }>;

  const bySlug = bySlugRaw.map((row) => ({
    slug: row.slug,
    page_views: row.page_views,
    unique_visitors: row.unique_visitors,
    free_autopsy_clicks: row.free_autopsy_clicks,
    hero_cta_clicks: row.hero_cta_clicks,
    newsletter_signups: row.newsletter_signups,
    conversion_rate: rate(row.free_autopsy_clicks, row.page_views),
    autopsy_rate: rate(row.free_autopsy_clicks, row.page_views),
    newsletter_rate: rate(row.newsletter_signups, row.page_views),
    hero_ctr: rate(row.hero_cta_clicks, row.page_views),
    scroll_50_rate: rate(row.scroll_50, row.page_views),
    engagement_30s_rate: rate(row.engaged_30s, row.page_views),
    faq_engagement_rate: rate(row.faq_opens, row.page_views),
  }));

  // By-variant site-wide breakdown
  const byVariant = db.prepare(
    `SELECT variant_id,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as free_autopsy_clicks,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_cta_clicks,
      SUM(CASE WHEN event_name='newsletter_submit_success' THEN 1 ELSE 0 END) as newsletter_signups,
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as engaged_30s,
      SUM(CASE WHEN event_name='scroll_50' THEN 1 ELSE 0 END) as scroll_50
    FROM conversion_events
    WHERE variant_id IS NOT NULL
    GROUP BY variant_id
    ORDER BY page_views DESC`
  ).all() as Array<{
    variant_id: string; page_views: number; free_autopsy_clicks: number;
    hero_cta_clicks: number; newsletter_signups: number; engaged_30s: number; scroll_50: number;
  }>;

  // By UTM source
  const topUtmSources = db.prepare(
    `SELECT COALESCE(traffic_source, utm_source, 'direct') as source,
      COUNT(*) as visits,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as conversions
     FROM conversion_events
     WHERE event_name='page_view'
     GROUP BY source ORDER BY visits DESC LIMIT 10`
  ).all() as Array<{ source: string; visits: number; conversions: number }>;

  const topUtmCampaigns = db.prepare(
    `SELECT utm_campaign, COUNT(*) as visits
     FROM conversion_events
     WHERE event_name='page_view' AND utm_campaign IS NOT NULL
     GROUP BY utm_campaign ORDER BY visits DESC LIMIT 5`
  ).all();

  const pv = totalViews;
  const topSlug = bySlug[0]?.slug ?? null;
  const worstSlug = bySlug.length > 1 ? bySlug[bySlug.length - 1]?.slug ?? null : null;

  return res.json({
    total_page_views: pv,
    total_unique_visitors: uniqueVisitors,
    total_free_autopsy_clicks: autopsyClicks,
    total_newsletter_signups: newsletterSignups,
    overall_conversion_rate: rate(autopsyClicks, pv),

    // Site-wide scroll depth (% of page_views that reached each depth)
    scroll_depth: {
      pct_25: rate(scrollAgg?.s25 ?? 0, pv),
      pct_50: rate(scrollAgg?.s50 ?? 0, pv),
      pct_75: rate(scrollAgg?.s75 ?? 0, pv),
      pct_90: rate(scrollAgg?.s90 ?? 0, pv),
    },

    // Site-wide engagement rates
    engagement: {
      time_on_page_30s_rate: rate(engagementAgg?.t30 ?? 0, pv),
      time_on_page_60s_rate: rate(engagementAgg?.t60 ?? 0, pv),
      exit_intent_rate: rate(engagementAgg?.exits ?? 0, pv),
      faq_engagement_rate: rate(engagementAgg?.faq_opens ?? 0, pv),
      comparison_section_rate: rate(engagementAgg?.comparison_views ?? 0, pv),
      newsletter_form_view_rate: rate(engagementAgg?.newsletter_views ?? 0, pv),
      hero_ctr: rate(engagementAgg?.hero_cta_clicks ?? 0, pv),
    },

    // Bounce proxy: % visitors with no scroll (saw page but didn't engage)
    bounce_proxy_rate: rate(bouncedVisitors, uniqueVisitors),

    // Top/worst slug
    top_slug: topSlug,
    worst_slug: worstSlug,

    // Per-slug breakdown
    by_slug: bySlug,

    // Per-variant site-wide breakdown
    by_variant: byVariant.map(v => ({
      ...v,
      conversion_rate: rate(v.free_autopsy_clicks, v.page_views),
      hero_ctr: rate(v.hero_cta_clicks, v.page_views),
      engagement_30s_rate: rate(v.engaged_30s, v.page_views),
      scroll_50_rate: rate(v.scroll_50, v.page_views),
    })),

    // UTM attribution
    top_utm_sources: topUtmSources.map(s => ({
      ...s,
      conversion_rate: rate(s.conversions, s.visits),
    })),
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
      SUM(CASE WHEN event_name='newsletter_submit_success' THEN 1 ELSE 0 END) as newsletter_signups,
      SUM(CASE WHEN event_name='scroll_25' THEN 1 ELSE 0 END) as scroll_25,
      SUM(CASE WHEN event_name='scroll_50' THEN 1 ELSE 0 END) as scroll_50,
      SUM(CASE WHEN event_name='scroll_75' THEN 1 ELSE 0 END) as scroll_75,
      SUM(CASE WHEN event_name='scroll_90' THEN 1 ELSE 0 END) as scroll_90,
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as engaged_30s,
      SUM(CASE WHEN event_name='time_on_page_60s' THEN 1 ELSE 0 END) as engaged_60s,
      SUM(CASE WHEN event_name='comparison_section_view' THEN 1 ELSE 0 END) as comparison_views,
      SUM(CASE WHEN event_name='truth_layer_section_view' THEN 1 ELSE 0 END) as truth_layer_views,
      SUM(CASE WHEN event_name='faq_open' THEN 1 ELSE 0 END) as faq_opens,
      SUM(CASE WHEN event_name='exit_intent' THEN 1 ELSE 0 END) as exits
    FROM conversion_events WHERE page_slug = ?`
  ).get(slug) as {
    slug: string; page_views: number; unique_visitors: number;
    free_autopsy_clicks: number; hero_cta_clicks: number; newsletter_signups: number;
    scroll_25: number; scroll_50: number; scroll_75: number; scroll_90: number;
    engaged_30s: number; engaged_60s: number;
    comparison_views: number; truth_layer_views: number; faq_opens: number; exits: number;
  } | null;

  if (!base || base.page_views === 0) {
    const variantRow = db.prepare("SELECT * FROM landing_page_variants WHERE slug = ?").get(slug);
    if (!variantRow) return res.status(404).json({ error: "Slug not found" });
    return res.json({
      slug, page_views: 0, unique_visitors: 0, free_autopsy_clicks: 0,
      hero_cta_clicks: 0, newsletter_signups: 0,
      conversion_rate: 0, autopsy_rate: 0, newsletter_rate: 0, hero_ctr: 0,
      scroll_depth: { pct_25: 0, pct_50: 0, pct_75: 0, pct_90: 0 },
      engagement: { time_on_page_30s_rate: 0, time_on_page_60s_rate: 0, exit_intent_rate: 0 },
      section_views: { comparison: 0, truth_layer: 0, faq_opens: 0 },
      top_variant: null, worst_variant: null,
      by_variant: [], by_traffic_source: [],
    });
  }

  const byVariant = db.prepare(
    `SELECT variant_id, experiment_id,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as free_autopsy_clicks,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_cta_clicks,
      SUM(CASE WHEN event_name='newsletter_submit_success' THEN 1 ELSE 0 END) as newsletter_signups,
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as engaged_30s,
      SUM(CASE WHEN event_name='scroll_50' THEN 1 ELSE 0 END) as scroll_50
    FROM conversion_events WHERE page_slug = ? AND variant_id IS NOT NULL
    GROUP BY variant_id, experiment_id
    ORDER BY page_views DESC`
  ).all(slug) as Array<{
    variant_id: string; experiment_id: string | null;
    page_views: number; free_autopsy_clicks: number; hero_cta_clicks: number;
    newsletter_signups: number; engaged_30s: number; scroll_50: number;
  }>;

  const byTrafficSource = db.prepare(
    `SELECT COALESCE(traffic_source, utm_source, 'direct') as source,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as conversions,
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as engaged_30s
    FROM conversion_events WHERE page_slug = ? GROUP BY source ORDER BY page_views DESC`
  ).all(slug) as Array<{ source: string; page_views: number; conversions: number; engaged_30s: number }>;

  const pv = base.page_views;
  const variantsSorted = byVariant.map((v) => ({
    ...v,
    conversion_rate: rate(v.free_autopsy_clicks, v.page_views || 1),
    autopsy_rate: rate(v.free_autopsy_clicks, v.page_views || 1),
    hero_ctr: rate(v.hero_cta_clicks, v.page_views || 1),
    engagement_30s_rate: rate(v.engaged_30s, v.page_views || 1),
    scroll_50_rate: rate(v.scroll_50, v.page_views || 1),
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
    hero_ctr: rate(base.hero_cta_clicks, pv),
    scroll_depth: {
      pct_25: rate(base.scroll_25, pv),
      pct_50: rate(base.scroll_50, pv),
      pct_75: rate(base.scroll_75, pv),
      pct_90: rate(base.scroll_90, pv),
    },
    engagement: {
      time_on_page_30s_rate: rate(base.engaged_30s, pv),
      time_on_page_60s_rate: rate(base.engaged_60s, pv),
      exit_intent_rate: rate(base.exits, pv),
    },
    section_views: {
      comparison: rate(base.comparison_views, pv),
      truth_layer: rate(base.truth_layer_views, pv),
      faq_opens: base.faq_opens,
      faq_engagement_rate: rate(base.faq_opens, pv),
    },
    top_variant: bestVariant,
    worst_variant: worstVariant,
    by_variant: variantsSorted,
    by_traffic_source: byTrafficSource.map(s => ({
      ...s,
      conversion_rate: rate(s.conversions, s.page_views),
      engagement_30s_rate: rate(s.engaged_30s, s.page_views),
    })),
  });
});

export default router;
