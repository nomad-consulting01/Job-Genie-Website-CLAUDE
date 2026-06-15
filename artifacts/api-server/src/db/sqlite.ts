// Uses Node.js built-in sqlite (available in Node 22.5+, Node 24+)
// No native compilation needed — pure built-in

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — node:sqlite types land in @types/node 22+; suppress if missing
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";
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
  initSchema(_db);
  return _db;
}

function initSchema(db: InstanceType<typeof DatabaseSync>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_page_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
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
    );

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

  // Seed initial variants
  const count = (db.prepare("SELECT COUNT(*) as c FROM landing_page_variants").get() as { c: number }).c;
  if (count === 0) {
    const insert = db.prepare(
      `INSERT OR IGNORE INTO landing_page_variants (slug, headline, variant_id, experiment_id)
       VALUES (?, ?, ?, ?)`
    );
    const slugs = [
      ["silent-applications", "Why Your Job Applications Go Silent", "control", "home_headline_test"],
      ["hidden-job-market", "The Hidden Job Market Is Real — And You're Missing It", "variant_b", "home_headline_test"],
      ["resume-not-working", "Your Resume Isn't The Problem. Your Channel Is.", "control", null],
      ["ghost-jobs", "31% of Job Board Listings Are Ghost Jobs", "control", null],
      ["specialist-recruiters", "Specialist Recruiters Hold The Roles You Actually Want", "control", null],
    ];
    for (const [slug, headline, variantId, expId] of slugs) {
      insert.run(slug, headline, variantId, expId);
    }
  }
}

export default getDb;
