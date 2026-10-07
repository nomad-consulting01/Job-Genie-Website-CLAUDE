import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export class PostingFetchError extends Error {
  constructor(message: string, public code: "blocked_url" | "fetch_failed" | "insufficient_posting") {
    super(message);
  }
}

const privateNetworks = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) privateNetworks.addSubnet(ip, prefix, "ipv4");
for (const [ip, prefix] of [
  ["2001:db8::", 32], ["2001::", 32], ["2002::", 16], ["2001:2::", 48],
] as const) privateNetworks.addSubnet(ip, prefix, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !privateNetworks.check(address, "ipv4");
  // Only global unicast: excludes loopback, link-local, unique-local and IPv4-mapped addresses.
  if (family === 6 && /^[23][0-9a-f]{3}:/i.test(address)) {
    return !privateNetworks.check(address, "ipv6");
  }
  return false;
}

export function validatePostingUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch {
    throw new PostingFetchError("Enter a complete public job URL starting with https://.", "blocked_url");
  }
  const host = url.hostname.toLowerCase();
  if (
    !["https:", "http:"].includes(url.protocol) || url.username || url.password ||
    (url.port && !["80", "443"].includes(url.port)) || isIP(host.replace(/^\[|\]$/g, "")) ||
    !host.includes(".") || /(?:^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host)
  ) {
    throw new PostingFetchError("Use a public job-board or employer URL, not a local or private address.", "blocked_url");
  }
  url.hash = "";
  return url;
}

export function decodePostingText(text: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, value: string) => {
    if (!value.startsWith("#")) return entities[value.toLowerCase()] ?? match;
    const code = value.toLowerCase().startsWith("#x") ? parseInt(value.slice(2), 16) : parseInt(value.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
  }).replace(/\s+/g, " ").trim();
}

export function htmlToPosting(html: string): string {
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  function findJob(value: unknown): Record<string, unknown> | null {
    if (Array.isArray(value)) {
      for (const item of value) { const found = findJob(item); if (found) return found; }
    } else if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;
      if (object["@type"] === "JobPosting" || (Array.isArray(object["@type"]) && object["@type"].includes("JobPosting"))) return object;
      if (object["@graph"]) return findJob(object["@graph"]);
    }
    return null;
  }
  for (const match of scripts) {
    try {
      const job = findJob(JSON.parse(match[1]));
      if (job && typeof job.description === "string" && job.description.length > 80) {
        const org = job.hiringOrganization as Record<string, unknown> | undefined;
        return decodePostingText(`${typeof job.title === "string" ? job.title : ""} ${typeof org?.name === "string" ? org.name : ""} ${job.description.replace(/<[^>]*>/g, " ")}`).slice(0, 30000);
      }
    } catch { /* Non-JSON or unrelated schema: try the visible page instead. */ }
  }
  return decodePostingText(html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")).slice(0, 30000);
}

async function readPublicPage(url: URL, timeout: number): Promise<{ body?: string; redirect?: string }> {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  // Reject mixed public/private DNS answers, then pin the checked address to defeat rebinding.
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new PostingFetchError("That URL does not resolve to a public website.", "blocked_url");
  }
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      agent: false,
      family: selected.family,
      lookup: (_host, _options, callback) => callback(null, selected.address, selected.family),
      signal: AbortSignal.timeout(timeout),
      headers: { "User-Agent": "JobGenie-PostingReader/1.0", Accept: "text/html,application/xhtml+xml,text/plain", "Accept-Encoding": "identity" },
    }, response => {
      const status = response.statusCode ?? 500;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        resolve({ redirect: response.headers.location });
        response.destroy();
        return;
      }
      if (status < 200 || status >= 300) {
        reject(new PostingFetchError("This website could not share the posting. Paste the job description instead.", "fetch_failed"));
        response.destroy();
        return;
      }
      const mime = (response.headers["content-type"] ?? "").split(";")[0];
      if (!["text/html", "application/xhtml+xml", "text/plain"].includes(mime)) {
        reject(new PostingFetchError("That link is not a readable job page. Paste the job description instead.", "fetch_failed"));
        response.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1_000_000) {
          reject(new PostingFetchError("The page is too large to read safely. Paste the posting text instead.", "fetch_failed"));
          response.destroy();
        } else chunks.push(chunk);
      });
      response.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
}

export async function fetchJobPosting(input: string): Promise<{ text: string; sourceUrl: string }> {
  let url = validatePostingUrl(input);
  const deadline = Date.now() + 20000;
  try {
    for (let hop = 0; hop < 4; hop++) {
      if (Date.now() >= deadline) break;
      const page = await readPublicPage(url, Math.min(8000, deadline - Date.now()));
      if (page.redirect) {
        url = validatePostingUrl(new URL(page.redirect, url).href);
        continue;
      }
      const text = htmlToPosting(page.body ?? "");
      if (text.length < 80) throw new PostingFetchError("There is not enough readable job detail at that URL. Paste the posting text instead.", "insufficient_posting");
      return { text, sourceUrl: url.href };
    }
  } catch (error) {
    if (error instanceof PostingFetchError) throw error;
    throw new PostingFetchError("This posting could not be read. Some job boards block automated access; paste its text instead.", "fetch_failed");
  }
  throw new PostingFetchError("The posting took too long or redirected too often. Paste its text instead.", "fetch_failed");
}
