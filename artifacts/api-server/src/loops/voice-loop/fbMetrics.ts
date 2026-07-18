import { logger } from "../../lib/logger.js";
import { readFbMetrics, writeFbMetrics, readPublishedVariants } from "./fileStore.js";
import type { FbMetricRow } from "./types.js";

const FB_GRAPH_VERSION = process.env["FB_GRAPH_API_VERSION"] ?? "v19.0";
const GRAPH_API = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

const DEFAULT_PAGE_METRICS = [
  "page_impressions",
  "page_impressions_unique",
  "page_post_engagements",
  "page_fan_adds",
  "page_views_total",
];

const DEFAULT_POST_METRICS = [
  "post_impressions",
  "post_impressions_unique",
  "post_engaged_users",
  "post_clicks",
  "post_reactions_by_type_total",
];

/** Instagram media-level metrics fetched for every published variant that has an instagram_post_id.
 *  Stored with an "ig_" prefix so they are distinct from FB metric names in the same file. */
const DEFAULT_IG_METRICS = ["impressions", "reach", "total_interactions"];
const IG_METRICS = resolveMetrics("IG_POST_METRICS", DEFAULT_IG_METRICS);

/** Read metric lists from env so operators can update without a redeploy. */
function resolveMetrics(envKey: string, defaults: string[]): string[] {
  const raw = process.env[envKey];
  if (!raw) return defaults;
  return raw.split(",").map((m) => m.trim()).filter(Boolean);
}

const PAGE_METRIC_FAMILIES = resolveMetrics("FB_PAGE_METRICS", DEFAULT_PAGE_METRICS);
const POST_METRIC_FAMILIES = resolveMetrics("FB_POST_METRICS", DEFAULT_POST_METRICS);

/**
 * Validate metric names against the live Graph API at call time.
 * Tries the batch; if it fails with code 100 (invalid metric), retries each
 * metric individually and returns only the ones the API accepts.
 * This prevents silent data loss when FB renames or removes a metric.
 */
async function resolveWorkingMetrics(
  metricList: string[],
  endpoint: string,
  extraParams: Record<string, string>,
  token: string,
  invalidMetrics: string[]
): Promise<string[]> {
  const batchResult = await graphGet(endpoint, { ...extraParams, metric: metricList.join(",") }, token);
  if (!batchResult.error) return metricList;

  /** FB error code 100 = invalid parameter (bad metric name). Retry each individually. */
  if (batchResult.error.code !== 100) return metricList;

  logger.warn({ code: batchResult.error.code, msg: batchResult.error.message }, "FB metric batch invalid — testing each metric individually");

  const working: string[] = [];
  for (const metric of metricList) {
    const r = await graphGet(endpoint, { ...extraParams, metric }, token);
    if (!r.error) {
      working.push(metric);
    } else {
      invalidMetrics.push(`${metric}: ${r.error.message}`);
      logger.warn({ metric, code: r.error.code, msg: r.error.message }, "FB metric unavailable — excluding from ingest");
    }
  }
  return working;
}

export interface FbMetricsIngestResult {
  rowsWritten: number;
  rowsSkipped: number;
  missingPermissions: string[];
  errors: string[];
  dryRun?: boolean;
  mockMode?: boolean;
  credsMissing?: boolean;
}

async function graphGet(
  endpoint: string,
  params: Record<string, string>,
  token: string
): Promise<{ data?: unknown[]; error?: { message: string; code: number; type: string } }> {
  const url = new URL(`${GRAPH_API}/${endpoint}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString());
  return resp.json() as Promise<{ data?: unknown[]; error?: { message: string; code: number; type: string } }>;
}

function isPermissionError(error: { code: number; type: string } | undefined): boolean {
  if (!error) return false;
  return error.code === 10 || error.code === 200 || error.type === "OAuthException";
}

function makeMockRows(pageId: string, date: string): FbMetricRow[] {
  const rows: FbMetricRow[] = [];
  const now = new Date().toISOString();
  const mockPageMetrics: Record<string, number> = {
    page_impressions: 4200,
    page_impressions_unique: 3100,
    page_post_engagements: 180,
    page_fan_adds: 12,
    page_views_total: 890,
  };
  for (const [metric, value] of Object.entries(mockPageMetrics)) {
    rows.push({ post_id: `page:${pageId}`, metric, date, value, ingestedAt: now });
  }
  return rows;
}

export async function runFbMetricsIngest(
  opts: { dryRun?: boolean } = {}
): Promise<FbMetricsIngestResult> {
  const pageId = process.env["FACEBOOK_PAGE_ID"];
  const token = process.env["FACEBOOK_PAGE_ACCESS_TOKEN"];
  const today = new Date().toISOString().slice(0, 10);
  const missingPermissions: string[] = [];
  const errors: string[] = [];
  let rowsWritten = 0;
  let rowsSkipped = 0;

  if (!pageId || !token) {
    if (opts.dryRun) {
      /** Dry-run with no creds: generate mock rows in-memory only (never written to disk). */
      const mockRows = makeMockRows("mock_page", today);
      logger.info({ rowsWouldBeWritten: mockRows.length }, "Voice Loop Station ①: dry-run mock mode — no creds, mock rows generated in-memory only");
      return {
        rowsWritten: mockRows.length,
        rowsSkipped: 0,
        missingPermissions: [],
        errors: [],
        dryRun: true,
        mockMode: true,
      };
    }
    /** Live run with no creds: log and skip — do NOT fabricate metrics into production files. */
    logger.warn("Voice Loop Station ①: FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN not set — skipping ingest (no fabricated data written)");
    return { rowsWritten: 0, rowsSkipped: 0, missingPermissions: [], errors: ["FB credentials not configured — set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN"], credsMissing: true };
  }

  const file = readFbMetrics();
  const now = new Date().toISOString();

  /** Upsert: overwrite existing row for same (post_id, metric, date) or push new. */
  function upsertRow(row: FbMetricRow): "written" | "updated" {
    const idx = file.rows.findIndex((r) => r.post_id === row.post_id && r.metric === row.metric && r.date === row.date);
    if (idx >= 0) { file.rows[idx] = row; return "updated"; }
    file.rows.push(row);
    return "written";
  }

  /** When dryRun=true with credentials, perform a FULL shadow ingest:
   *  fetch real metrics from the Graph API but suppress writeFbMetrics() at the end.
   *  This exercises the complete Station ① ingest path in read-only mode. */

  const since = Math.floor(new Date(today).getTime() / 1000);
  const until = since + 86400;

  /** Resolve working metrics at call time — filters out any renamed/removed metrics. */
  const workingPageMetrics = await resolveWorkingMetrics(
    PAGE_METRIC_FAMILIES,
    `${pageId}/insights`,
    { period: "day", since: String(since), until: String(until) },
    token,
    missingPermissions
  );

  const pageResult = workingPageMetrics.length > 0
    ? await graphGet(`${pageId}/insights`, {
        metric: workingPageMetrics.join(","),
        period: "day",
        since: String(since),
        until: String(until),
      }, token)
    : { data: [] };

  if ("error" in pageResult && pageResult.error) {
    if (isPermissionError(pageResult.error)) {
      missingPermissions.push(`page_insights: ${pageResult.error.message}`);
      logger.warn({ err: pageResult.error.message }, "Voice Loop Station ①: missing page_insights permission");
    } else {
      errors.push(`page_insights: ${pageResult.error.message}`);
      logger.error({ err: pageResult.error.message }, "Voice Loop Station ①: page insights error");
    }
  } else if (Array.isArray(pageResult.data)) {
    for (const item of pageResult.data as Array<{ name: string; values?: Array<{ value: number; end_time: string }> }>) {
      for (const v of (item.values ?? [])) {
        const row: FbMetricRow = {
          post_id: `page:${pageId}`,
          metric: item.name,
          date: v.end_time.slice(0, 10),
          value: typeof v.value === "number" ? v.value : 0,
          ingestedAt: now,
        };
        const result = upsertRow(row);
        if (result === "written") rowsWritten++; else rowsSkipped++;
      }
    }
  }

  const postsResult = await graphGet(`${pageId}/posts`, {
    fields: "id,created_time",
    limit: "25",
  }, token);

  if (!postsResult.error && Array.isArray(postsResult.data)) {
    /** Resolve working post metrics once before the loop to avoid N×M individual probes. */
    const firstPostId = (postsResult.data as Array<{ id: string }>)[0]?.id;
    const workingPostMetrics = firstPostId
      ? await resolveWorkingMetrics(
          POST_METRIC_FAMILIES,
          `${firstPostId}/insights`,
          { period: "lifetime" },
          token,
          missingPermissions
        )
      : POST_METRIC_FAMILIES;

    for (const post of postsResult.data as Array<{ id: string }>) {
      const postId = post.id;
      const insightsResult = workingPostMetrics.length > 0
        ? await graphGet(`${postId}/insights`, {
            metric: workingPostMetrics.join(","),
            period: "lifetime",
          }, token)
        : { data: [] };

      if (insightsResult.error) {
        if (isPermissionError(insightsResult.error)) {
          missingPermissions.push(`post_insights(${postId}): ${insightsResult.error.message}`);
          logger.warn({ postId, err: insightsResult.error.message }, "Voice Loop Station ①: missing post_insights permission");
        } else {
          errors.push(`post_insights(${postId}): ${insightsResult.error.message}`);
        }
        continue;
      }

      if (Array.isArray(insightsResult.data)) {
        for (const item of insightsResult.data as Array<{ name: string; values?: Array<{ value: number | Record<string, number>; end_time?: string }> }>) {
          const val = item.values?.[0]?.value;
          const numVal = typeof val === "number" ? val : typeof val === "object" && val !== null ? Object.values(val).reduce((a, b) => a + b, 0) : 0;
          const row: FbMetricRow = {
            post_id: postId,
            metric: item.name,
            date: today,
            value: numVal,
            ingestedAt: now,
          };
          const result = upsertRow(row);
          if (result === "written") rowsWritten++; else rowsSkipped++;
        }
      }
    }
  }

  /** ── Instagram post-level insights ──────────────────────────────────────────
   *  For every published variant that has an instagram_post_id, fetch media
   *  insights from the Instagram Graph API endpoint.  The same Page Access Token
   *  is used — it must belong to a Facebook Page connected to an IG Business /
   *  Creator account.
   *
   *  Metrics are stored with an "ig_" prefix so they are unambiguously distinct
   *  from FB metric names in the shared fb-metrics-daily.json file, and the
   *  post_id stored is the instagram_post_id (not the FB post_id).
   */
  const publishedFile = readPublishedVariants();
  const igPostIds = Array.from(
    new Set(
      publishedFile.entries
        .map((e) => e.instagram_post_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let igRowsWritten = 0;
  let igRowsSkipped = 0;

  if (igPostIds.length > 0) {
    /** Validate IG metrics against the first post ID before looping. */
    const workingIgMetrics = await resolveWorkingMetrics(
      IG_METRICS,
      `${igPostIds[0]}/insights`,
      {},
      token,
      missingPermissions
    );

    for (const igPostId of igPostIds) {
      if (workingIgMetrics.length === 0) break;

      const igResult = await graphGet(`${igPostId}/insights`, {
        metric: workingIgMetrics.join(","),
      }, token);

      if (igResult.error) {
        if (isPermissionError(igResult.error)) {
          missingPermissions.push(`ig_post_insights(${igPostId}): ${igResult.error.message}`);
          logger.warn({ igPostId, err: igResult.error.message }, "Voice Loop Station ①: missing IG post_insights permission");
        } else {
          errors.push(`ig_post_insights(${igPostId}): ${igResult.error.message}`);
          logger.warn({ igPostId, err: igResult.error.message }, "Voice Loop Station ①: IG post insights error");
        }
        continue;
      }

      if (Array.isArray(igResult.data)) {
        for (const item of igResult.data as Array<{ name: string; values?: Array<{ value: number; end_time?: string }> }>) {
          const val = item.values?.[0]?.value ?? 0;
          const row: FbMetricRow = {
            post_id: igPostId,
            metric: `ig_${item.name}`,
            date: today,
            value: typeof val === "number" ? val : 0,
            ingestedAt: now,
            channel: "instagram",
          };
          const result = upsertRow(row);
          if (result === "written") igRowsWritten++; else igRowsSkipped++;
        }
      }
    }

    logger.info(
      { igPostIds: igPostIds.length, igRowsWritten, igRowsSkipped },
      "Voice Loop Station ①: Instagram metrics ingest complete"
    );
    rowsWritten += igRowsWritten;
    rowsSkipped += igRowsSkipped;
  } else {
    logger.debug("Voice Loop Station ①: no instagram_post_ids found in published variants — skipping IG ingest");
  }

  file.lastIngestAt = now;
  if (!opts.dryRun) {
    writeFbMetrics(file);
  }

  if (missingPermissions.length > 0) {
    logger.warn({ missingPermissions }, "Voice Loop Station ①: some metrics unavailable due to missing permissions");
  }

  logger.info({ rowsWritten, rowsSkipped, missingPermissions: missingPermissions.length, errors: errors.length, dryRun: opts.dryRun }, "Voice Loop Station ①: FB metrics ingest complete");

  return { rowsWritten, rowsSkipped, missingPermissions, errors, dryRun: opts.dryRun };
}
