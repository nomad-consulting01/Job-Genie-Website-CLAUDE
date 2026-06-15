// Uses Node.js built-in sqlite (available in Node 22.5+, Node 24+)
// No native compilation needed — pure built-in

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — node:sqlite types land in @types/node 22+; suppress if missing
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "job-genie.db");

let _db: InstanceType<typeof DatabaseSync> | null = null;

export function getDb(): InstanceType<typeof DatabaseSync> {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new DatabaseSync(DB_PATH);
  runMigrations(_db);
  return _db;
}

function runMigrations(db: InstanceType<typeof DatabaseSync>) {
  // Migration 0: initial schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversion_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      session_id TEXT,
      visitor_id TEXT,
      page_slug TEXT NOT NULL DEFAULT '/',
      experiment_id TEXT,
      variant_id TEXT,
      traffic_source TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,
      referrer TEXT,
      device_type TEXT,
      browser TEXT,
      conversion_value REAL,
      metadata TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS optimization_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      experiment_id TEXT,
      recommendation TEXT NOT NULL,
      reasoning TEXT,
      confidence REAL,
      action TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS variant_change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      changed_by TEXT,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_slug ON conversion_events(page_slug);
    CREATE INDEX IF NOT EXISTS idx_events_name ON conversion_events(event_name);
    CREATE INDEX IF NOT EXISTS idx_events_created ON conversion_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_events_visitor ON conversion_events(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_events_experiment ON conversion_events(experiment_id);
  `);

  // Migration 1: create landing_page_variants without slug UNIQUE constraint.
  // If old table exists with UNIQUE constraint, recreate it.
  const existingTableSql = (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='landing_page_variants'"
  ).get() as { sql: string } | null)?.sql ?? '';

  const hasUniqueSlug =
    existingTableSql.includes('slug TEXT NOT NULL UNIQUE') ||
    existingTableSql.includes('UNIQUE(slug)') ||
    (existingTableSql.length === 0); // table doesn't exist yet

  if (hasUniqueSlug) {
    // Recreate without UNIQUE on slug (allows multiple variants/experiments per slug)
    db.exec(`
      CREATE TABLE IF NOT EXISTS landing_page_variants_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        experiment_id TEXT,
        variant_id TEXT NOT NULL DEFAULT 'control',
        headline TEXT,
        subheadline TEXT,
        eyebrow TEXT,
        hero_quote TEXT,
        cta_primary TEXT,
        cta_secondary TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        traffic_weight REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    if (existingTableSql.length > 0) {
      // Copy existing data and drop old table
      db.exec(`INSERT OR IGNORE INTO landing_page_variants_v2 SELECT * FROM landing_page_variants`);
      db.exec(`DROP TABLE landing_page_variants`);
    }
    db.exec(`ALTER TABLE landing_page_variants_v2 RENAME TO landing_page_variants`);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_variants_slug ON landing_page_variants(slug)`);
  }

  // Seed initial variants if empty
  const count = (db.prepare("SELECT COUNT(*) as c FROM landing_page_variants").get() as { c: number }).c;
  if (count === 0) {
    const insert = db.prepare(
      `INSERT INTO landing_page_variants (slug, headline, variant_id, experiment_id, status)
       VALUES (?, ?, ?, ?, 'active')`
    );
    const seeds = [
      ["why-job-applications-go-silent", "Why Your Job Applications Go Silent", "control", "lp_why-job-applications-go-silent"],
      ["hidden-job-market", "The Hidden Job Market Is Real — And You're Missing It", "variant_b", "home_headline_test"],
      ["resume-not-getting-interviews", "Your Resume Isn't The Problem. Your Channel Is.", "control", "lp_resume-not-getting-interviews"],
      ["ghost-jobs", "31% of Job Board Listings Are Ghost Jobs", "control", "lp_ghost-jobs"],
      ["recruiter-fit-gap", "Your Recruiter-Fit Gap Is Why You're Not Getting Shortlisted", "control", "lp_recruiter-fit-gap"],
      ["application-silence-score", "Your Application Silence Score: Why Recruiters Skip Your CV", "control", "lp_application-silence-score"],
    ];
    for (const [slug, headline, variantId, expId] of seeds) {
      insert.run(slug, headline, variantId, expId);
    }
  }
}

export default getDb;
