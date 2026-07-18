import { Router } from "express";
import { getDb } from "../db/sqlite.js";

const router = Router();

const COOKIE_NAME = "jg_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years in seconds
const VISITOR_ID_RE = /^[a-zA-Z0-9_\-]{8,64}$/;

function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k.trim() === name) {
      return decodeURIComponent(rest.join("=").trim()) || null;
    }
  }
  return null;
}

function setCookieHeader(visitorId: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(visitorId)}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

router.post("/visitors/sync", (req, res) => {
  const db = getDb();
  const cookieId = parseCookieValue(req.headers.cookie, COOKIE_NAME);
  const bodyId: unknown = req.body?.visitor_id;

  const providedId = typeof bodyId === "string" && VISITOR_ID_RE.test(bodyId) ? bodyId : null;

  if (providedId) {
    db.prepare(
      `INSERT OR IGNORE INTO visitors (visitor_id) VALUES (?)`
    ).run(providedId);

    res.setHeader("Set-Cookie", setCookieHeader(providedId));
    return res.json({ visitor_id: providedId, restored: false });
  }

  if (cookieId && VISITOR_ID_RE.test(cookieId)) {
    const row = db.prepare(
      `SELECT visitor_id FROM visitors WHERE visitor_id = ?`
    ).get(cookieId) as { visitor_id: string } | null;

    if (row) {
      res.setHeader("Set-Cookie", setCookieHeader(row.visitor_id));
      return res.json({ visitor_id: row.visitor_id, restored: true });
    }
  }

  return res.json({ visitor_id: null, restored: false });
});

export default router;
