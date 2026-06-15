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
      SUM(CASE WHEN event_name='newsletter_submit_success' THEN 1 ELSE 0 END) as total_newsletter_signups
    FROM conversion_events`
  ).get() as { total_page_views: number; total_unique_visitors: number; total_free_autopsy_clicks: number; total_newsletter_signups: number };

  const bySlugs = db.prepare(
    `SELECT page_slug as slug,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as page_views,
      COUNT(DISTINCT CASE WHEN event_name='page_view' AND visitor_id IS NOT NULL THEN visitor_id END) as unique_visitors,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as free_autopsy_clicks,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_cta_clicks,
      SUM(CASE WHEN event_name='newsletter_submit_success' THEN 1 ELSE 0 END) as newsletter_signups
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
      SUM(CASE WHEN event_name='newsletter_submit_success' THEN 1 ELSE 0 END) as newsletter,
      SUM(CASE WHEN event_name='hero_cta_click' THEN 1 ELSE 0 END) as hero_clicks,
      SUM(CASE WHEN event_name='scroll_50' THEN 1 ELSE 0 END) as scroll50,
      SUM(CASE WHEN event_name='scroll_75' THEN 1 ELSE 0 END) as scroll75,
      SUM(CASE WHEN event_name='exit_intent' THEN 1 ELSE 0 END) as exits,
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as engaged30s,
      SUM(CASE WHEN event_name='newsletter_form_view' THEN 1 ELSE 0 END) as newsletter_views,
      SUM(CASE WHEN event_name='faq_open' THEN 1 ELSE 0 END) as faq_opens,
      SUM(CASE WHEN event_name='comparison_section_view' THEN 1 ELSE 0 END) as comparison_views,
      SUM(CASE WHEN event_name='pricing_cta_click' THEN 1 ELSE 0 END) as pricing_clicks
    FROM conversion_events GROUP BY page_slug ORDER BY views DESC`
  ).all() as Array<{
    slug: string; views: number; conversions: number; newsletter: number; hero_clicks: number;
    scroll50: number; scroll75: number; exits: number; engaged30s: number;
    newsletter_views: number; faq_opens: number; comparison_views: number; pricing_clicks: number;
  }>;

  const variantStats = db.prepare(
    `SELECT variant_id,
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as views,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as conversions
    FROM conversion_events WHERE variant_id IS NOT NULL
    GROUP BY variant_id ORDER BY views DESC`
  ).all() as Array<{ variant_id: string; views: number; conversions: number }>;

  // Current active variant per slug (for report context)
  const activeVariants = db.prepare(
    `SELECT slug, variant_id FROM landing_page_variants WHERE status='active' ORDER BY created_at DESC`
  ).all() as Array<{ slug: string; variant_id: string }>;
  const currentVariantMap = new Map<string, string>();
  for (const v of activeVariants) {
    if (!currentVariantMap.has(v.slug)) currentVariantMap.set(v.slug, v.variant_id);
  }

  // Paid traffic engagement (bounce proxy)
  const paidTrafficStats = db.prepare(
    `SELECT
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as paid_views,
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as paid_engaged,
      SUM(CASE WHEN event_name='free_autopsy_click' THEN 1 ELSE 0 END) as paid_conversions
    FROM conversion_events
    WHERE utm_medium IN ('cpc','paid','ppc','paidsocial') OR traffic_source = 'paid'`
  ).get() as { paid_views: number; paid_engaged: number; paid_conversions: number } | null;

  const overallEngagementRow = db.prepare(
    `SELECT
      SUM(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) as total_views,
      SUM(CASE WHEN event_name='time_on_page_30s' THEN 1 ELSE 0 END) as total_engaged
    FROM conversion_events`
  ).get() as { total_views: number; total_engaged: number } | null;

  const savedRecs = db.prepare(
    "SELECT * FROM optimization_recommendations ORDER BY created_at DESC LIMIT 50"
  ).all();

  interface RecommendationItem {
    slug: string;
    current_variant: string;
    views: number;
    conversion_rate: number;
    issue_detected: string;
    likely_problem: string;
    recommended_test: string;
    priority: "high" | "medium" | "low";
  }

  const recommendations: RecommendationItem[] = [];

  // Overall paid traffic bounce diagnostic (site-wide, emitted once)
  if (paidTrafficStats && overallEngagementRow) {
    const paidViews = Number(paidTrafficStats.paid_views ?? 0);
    const paidEngaged = Number(paidTrafficStats.paid_engaged ?? 0);
    const overallViews = Number(overallEngagementRow.total_views ?? 0);
    const overallEngaged = Number(overallEngagementRow.total_engaged ?? 0);
    if (paidViews > 10 && overallViews > 0) {
      const paidEngRate = paidEngaged / paidViews;
      const overallEngRate = overallViews > 0 ? overallEngaged / overallViews : 0;
      if (paidEngRate < overallEngRate * 0.65) {
        recommendations.push({
          slug: "all",
          current_variant: "n/a",
          views: paidViews,
          conversion_rate: paidViews > 0 ? parseFloat(((paidTrafficStats.paid_conversions / paidViews) * 100).toFixed(2)) : 0,
          issue_detected: "paid_traffic_bounce",
          likely_problem: `Paid traffic 30s engagement rate (${(paidEngRate * 100).toFixed(0)}%) is significantly below organic average (${(overallEngRate * 100).toFixed(0)}%) — ad creative and landing page message may not be aligned.`,
          recommended_test: "Test a dedicated paid landing page that mirrors ad headline exactly; add a 'You clicked because…' confirmation hook above the fold.",
          priority: "high",
        });
      }
    }
  }

  slugStats.forEach((row) => {
    const cvr = row.views > 0 ? row.conversions / row.views : 0;
    const scrollRate = row.views > 0 ? row.scroll50 / row.views : 0;
    const engagementRate = row.views > 0 ? row.engaged30s / row.views : 0;
    const exitRate = row.views > 0 ? row.exits / row.views : 0;
    const newsletterConvRate = row.newsletter_views > 0 ? row.newsletter / row.newsletter_views : 0;
    const heroCtr = row.views > 0 ? row.hero_clicks / row.views : 0;
    const faqEngagementRate = row.views > 0 ? row.faq_opens / row.views : 0;
    const currentVariant = currentVariantMap.get(row.slug) ?? "control";

    // Diagnostic 1: low overall CTA (hero + autopsy)
    if (row.views > 30 && cvr < 0.02) {
      recommendations.push({
        slug: row.slug, current_variant: currentVariant, views: row.views,
        conversion_rate: parseFloat((cvr * 100).toFixed(2)),
        issue_detected: "low_cvr",
        likely_problem: `Only ${(cvr * 100).toFixed(1)}% of visitors click the Free Autopsy CTA — headline or offer framing may not be resonating.`,
        recommended_test: "A/B test a more specific headline (name the exact blocker) against current copy; also test CTA button colour.",
        priority: "high",
      });
    }

    // Diagnostic 2: high scroll depth but low conversion (engaged but not converting)
    if (scrollRate > 0.5 && cvr < 0.03 && row.views > 20) {
      recommendations.push({
        slug: row.slug, current_variant: currentVariant, views: row.views,
        conversion_rate: parseFloat((cvr * 100).toFixed(2)),
        issue_detected: "high_scroll_low_cvr",
        likely_problem: `${(scrollRate * 100).toFixed(0)}% of visitors scroll past 50% but only ${(cvr * 100).toFixed(1)}% convert — users are engaged but the CTA isn't closing them.`,
        recommended_test: "Add a sticky bottom CTA bar; test a more specific offer (e.g., 'See your keyword gaps') vs generic 'Free Autopsy'.",
        priority: "high",
      });
    }

    // Diagnostic 3: high newsletter form views but low signup rate
    if (row.newsletter_views > 10 && newsletterConvRate < 0.05) {
      recommendations.push({
        slug: row.slug, current_variant: currentVariant, views: row.views,
        conversion_rate: parseFloat((cvr * 100).toFixed(2)),
        issue_detected: "high_newsletter_views_low_signup",
        likely_problem: `${row.newsletter_views} visitors see the newsletter form but only ${(newsletterConvRate * 100).toFixed(1)}% sign up — the lead magnet or CTA copy may be weak.`,
        recommended_test: "Test a specific lead magnet ('7 recruiter keywords your resume is missing') vs generic newsletter pitch.",
        priority: "medium",
      });
    }

    // Diagnostic 4: high FAQ engagement but low hero CTA click (interested but not converting)
    if (faqEngagementRate > 0.12 && heroCtr < 0.04 && row.views > 20) {
      recommendations.push({
        slug: row.slug, current_variant: currentVariant, views: row.views,
        conversion_rate: parseFloat((cvr * 100).toFixed(2)),
        issue_detected: "faq_high_engagement_low_cta",
        likely_problem: `${(faqEngagementRate * 100).toFixed(0)}% of visitors open FAQs (high intent signal) but hero CTA rate is only ${(heroCtr * 100).toFixed(1)}% — users have questions that aren't being resolved into action.`,
        recommended_test: "Add a CTA button after each FAQ answer; insert a mid-page 'Ready to see your blockers?' CTA between FAQ items.",
        priority: "medium",
      });
    }

    // Diagnostic 5: low scroll (losing users before value prop)
    if (scrollRate < 0.3 && row.views > 20) {
      recommendations.push({
        slug: row.slug, current_variant: currentVariant, views: row.views,
        conversion_rate: parseFloat((cvr * 100).toFixed(2)),
        issue_detected: "low_scroll_depth",
        likely_problem: `Only ${(scrollRate * 100).toFixed(0)}% of visitors scroll past 50% — hero section may be losing users before they reach the value proposition.`,
        recommended_test: "Move the strongest social proof stat above the fold; shorten the opening paragraph; test a single-column hero.",
        priority: "high",
      });
    }

    // Bonus: low engagement (slow page or weak hook)
    if (engagementRate < 0.4 && row.views > 20) {
      recommendations.push({
        slug: row.slug, current_variant: currentVariant, views: row.views,
        conversion_rate: parseFloat((cvr * 100).toFixed(2)),
        issue_detected: "low_30s_engagement",
        likely_problem: `Only ${(engagementRate * 100).toFixed(0)}% of visitors stay 30 seconds — page may be loading slowly or the opening hook isn't holding attention.`,
        recommended_test: "Test a shorter opening sentence; check Core Web Vitals; try a 2-sentence hero subhead.",
        priority: "medium",
      });
    }

    // Bonus: high exit intent
    if (exitRate > 0.5 && row.views > 20) {
      recommendations.push({
        slug: row.slug, current_variant: currentVariant, views: row.views,
        conversion_rate: parseFloat((cvr * 100).toFixed(2)),
        issue_detected: "high_exit_intent",
        likely_problem: `${(exitRate * 100).toFixed(0)}% of visitors move to exit — high intent-to-leave suggests unmet expectation between ad/search intent and page content.`,
        recommended_test: "Add an exit-intent overlay with a free lead magnet; tighten UTM-to-headline message match.",
        priority: "medium",
      });
    }

    // Bonus: high performer — scale traffic
    if (cvr > 0.08) {
      recommendations.push({
        slug: row.slug, current_variant: currentVariant, views: row.views,
        conversion_rate: parseFloat((cvr * 100).toFixed(2)),
        issue_detected: "high_performer",
        likely_problem: `${(cvr * 100).toFixed(1)}% CVR — above benchmark. Scaling traffic here increases total conversions directly.`,
        recommended_test: "Increase paid/social traffic allocation to this slug; document winning elements for other variants.",
        priority: "low",
      });
    }

    if (recommendations.filter(r => r.slug === row.slug).length > 0) {
      const recentRec = db.prepare(
        `SELECT id FROM optimization_recommendations WHERE slug = ? AND created_at > datetime('now', '-24 hours') LIMIT 1`
      ).get(row.slug);
      if (!recentRec) {
        const topRec = recommendations.filter(r => r.slug === row.slug)[0];
        if (topRec) {
          db.prepare(
            `INSERT INTO optimization_recommendations (slug, recommendation, status) VALUES (?, ?, 'draft')`
          ).run(row.slug, `[${topRec.issue_detected}] ${topRec.recommended_test}`);
        }
      }
    }
  });

  const bySlugCvr = slugStats.map(r => ({
    slug: r.slug,
    cvr: r.views > 0 ? r.conversions / r.views : 0,
    views: r.views,
    current_variant: currentVariantMap.get(r.slug) ?? "control",
  })).filter(r => r.views > 0).sort((a, b) => b.cvr - a.cvr);

  const byVariantCvr = variantStats.map(v => ({
    variant_id: v.variant_id,
    cvr: v.views > 0 ? v.conversions / v.views : 0,
    views: v.views,
  })).filter(v => v.views > 0).sort((a, b) => b.cvr - a.cvr);

  return res.json({
    summary: {
      top_slug: bySlugCvr[0]?.slug ?? null,
      top_slug_variant: bySlugCvr[0]?.current_variant ?? null,
      worst_slug: bySlugCvr.length > 1 ? bySlugCvr[bySlugCvr.length - 1]?.slug ?? null : null,
      worst_slug_variant: bySlugCvr.length > 1 ? bySlugCvr[bySlugCvr.length - 1]?.current_variant ?? null : null,
      best_variant_id: byVariantCvr[0]?.variant_id ?? null,
      worst_variant_id: byVariantCvr.length > 1 ? byVariantCvr[byVariantCvr.length - 1]?.variant_id ?? null : null,
      total_recommendations: recommendations.length,
      high_priority_count: recommendations.filter(r => r.priority === "high").length,
    },
    recommendations: recommendations.sort((a, b) => {
      const prio = { high: 0, medium: 1, low: 2 };
      return prio[a.priority] - prio[b.priority];
    }),
    saved_recommendations: savedRecs,
  });
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
      return res.status(409).json({ error: "Slug + variant already exists" });
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
      SUM(CASE WHEN event_name='newsletter_submit_success' THEN 1 ELSE 0 END) as newsletter_signups
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
