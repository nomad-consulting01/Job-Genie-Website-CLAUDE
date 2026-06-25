const BASE = "https://api.beehiiv.com/v2";

function creds() {
  const key = process.env["BEEHIIV_API_KEY"];
  const pub = process.env["BEEHIIV_PUBLICATION_ID"];
  return key && pub ? { key, pub } : null;
}

export interface BeehiivPost {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  status: string;
  publishDate: number | null;
  webUrl: string | null;
  thumbnailUrl: string | null;
  contentTags: string[];
}

/** Fetch published posts from Beehiiv, newest first */
export async function listBeehiivPosts(limit = 50, page = 1): Promise<BeehiivPost[]> {
  const c = creds();
  if (!c) return [];

  const url = `${BASE}/publications/${c.pub}/posts?status=confirmed&limit=${limit}&page=${page}&order_by=publish_date&direction=desc`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${c.key}`, Accept: "application/json" },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Beehiiv listPosts ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { data?: unknown[] };
  return ((data.data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: String(p["id"] ?? ""),
    title: String(p["title"] ?? ""),
    subtitle: p["subtitle"] ? String(p["subtitle"]) : null,
    slug: String(p["slug"] ?? p["id"] ?? ""),
    status: String(p["status"] ?? ""),
    publishDate: p["publish_date"] ? Number(p["publish_date"]) : null,
    webUrl: p["web_url"] ? String(p["web_url"]) : null,
    thumbnailUrl: p["thumbnail_url"] ? String(p["thumbnail_url"]) : null,
    contentTags: Array.isArray(p["content_tags"]) ? (p["content_tags"] as string[]) : [],
  }));
}

/** Create a draft newsletter post in Beehiiv — returns the new post ID and web URL */
export async function createBeehiivDraft(opts: {
  title: string;
  subtitle: string;
  htmlContent: string;
  contentTags?: string[];
  thumbnailUrl?: string;
}): Promise<{ id: string; webUrl: string | null } | null> {
  const c = creds();
  if (!c) return null;

  const resp = await fetch(`${BASE}/publications/${c.pub}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: opts.title,
      subtitle: opts.subtitle,
      status: "draft",
      content_tags: opts.contentTags ?? [],
      platform: "both",
      audience: "all",
      ...(opts.thumbnailUrl ? { thumbnail_url: opts.thumbnailUrl } : {}),
      free_web_content: opts.htmlContent,
      free_email_content: opts.htmlContent,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Beehiiv createDraft ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { data?: Record<string, unknown> };
  return {
    id: String(data.data?.["id"] ?? ""),
    webUrl: data.data?.["web_url"] ? String(data.data["web_url"]) : null,
  };
}

/** Create a web-only post in Beehiiv (no email sent) — for blog post migration */
export async function createBeehiivWebPost(opts: {
  title: string;
  subtitle: string;
  htmlContent: string;
  slug: string;
  publishDate: number;
  contentTags?: string[];
  thumbnailUrl?: string;
}): Promise<{ id: string; webUrl: string | null } | null> {
  const c = creds();
  if (!c) return null;

  const resp = await fetch(`${BASE}/publications/${c.pub}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: opts.title,
      subtitle: opts.subtitle,
      status: "draft",
      platform: "both",
      audience: "all",
      content_tags: opts.contentTags ?? [],
      ...(opts.thumbnailUrl ? { thumbnail_url: opts.thumbnailUrl } : {}),
      free_web_content: opts.htmlContent,
      free_email_content: opts.htmlContent,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Beehiiv createWebPost ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { data?: Record<string, unknown> };
  return {
    id: String(data.data?.["id"] ?? ""),
    webUrl: data.data?.["web_url"] ? String(data.data["web_url"]) : null,
  };
}

/** Subscribe an email to the Beehiiv publication */
export async function subscribeBeehiiv(opts: {
  email: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  customFields?: { name: string; value: string }[];
}): Promise<boolean> {
  const c = creds();
  if (!c) return false;

  const resp = await fetch(`${BASE}/publications/${c.pub}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: opts.email,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: opts.utmSource ?? "job-genie-website",
      utm_medium: opts.utmMedium ?? "organic",
      utm_campaign: opts.utmCampaign ?? "signup",
      custom_fields: opts.customFields ?? [],
    }),
  });

  return resp.ok;
}

export function isBeehiivConfigured(): boolean {
  return !!creds();
}
