/**
 * Static pre-render script for AEO/SEO.
 *
 * Run after the Vite client build to generate static HTML files for each landing page
 * route. Each file includes:
 *   - Full React-rendered page content (FAQ, comparison table, hero copy) in the <body>
 *   - Route-specific <title>, <meta name="description">, canonical, robots, og/twitter tags
 *   - Per-route WebPage + Question JSON-LD in <head>
 *   - The shared static JSON-LD schemas from index.html (Organization + SoftwareApp only — site-wide)
 *   - Homepage-only FAQPage, HowTo, and Question schemas injected for the / route only
 *
 * Usage (run automatically via `pnpm build`):
 *   BASE_PATH=/ node prerender.mjs
 */
import { build } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROUTES = [
  '/',
  '/why-no-responses-after-100-applications',
  '/ghost-jobs',
  '/glossary',
  '/for/mid-career-professionals',
  '/for/senior-engineers',
  '/for/career-changers',
  '/job-genie-vs-auto-apply',
  '/terms',
  '/privacy',
  '/data-deletion',
];

async function main() {
  console.log('[prerender] Building SSR server bundle…');

  await build({
    configFile: path.resolve(__dirname, 'vite.ssr.config.ts'),
    build: {
      ssr: path.resolve(__dirname, 'src/entry-server.tsx'),
      outDir: path.resolve(__dirname, 'dist/server'),
      emptyOutDir: true,
      rollupOptions: {
        output: { format: 'esm', entryFileNames: 'entry-server.mjs' },
      },
    },
  });

  console.log('[prerender] Loading SSR render functions…');
  const { render, getRouteHead, buildHeadHtml } = await import(
    './dist/server/entry-server.mjs'
  );

  const templatePath = path.resolve(__dirname, 'dist/public/index.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error(
      'dist/public/index.html not found — run the client build first:\n' +
        '  pnpm --filter @workspace/job-genie build:client'
    );
  }
  const template = fs.readFileSync(templatePath, 'utf-8');

  for (const url of ROUTES) {
    console.log(`[prerender] Rendering ${url}…`);

    // 1. Render React app to HTML string
    const appHtml = render(url);

    // 2. Get route-specific head metadata
    const head = getRouteHead(url);
    const routeHeadHtml = buildHeadHtml(head);

    // 3. Build the final HTML:
    //    - Remove static home-page duplicates FIRST (so cleanup never touches routeHeadHtml)
    //    - Then inject the route-specific head block in place of <title>
    //    - Keep the shared JSON-LD schemas (Org, FAQ, HowTo, SoftwareApp)
    //    - Inject the pre-rendered React HTML into #root
    let html = template;

    // Step 3a: Strip old static tags BEFORE injecting any route-specific content.
    // These regexes only touch the original index.html template text, which has no
    // route-specific block yet, so they cannot accidentally remove the new tags.
    html = html.replace(/<meta name="description"[^>]*(\/?>)/g, '');
    html = html.replace(/<meta name="robots"[^>]*(\/?>)/g, '');
    html = html.replace(/<link rel="canonical"[^>]*(\/?>)/g, '');
    html = html.replace(/<meta property="og:title"[^>]*(\/?>)/g, '');
    html = html.replace(/<meta property="og:description"[^>]*(\/?>)/g, '');
    html = html.replace(/<meta property="og:url"[^>]*(\/?>)/g, '');
    html = html.replace(/<meta property="og:site_name"[^>]*(\/?>)/g, '');
    html = html.replace(/<meta property="og:type"[^>]*(\/?>)/g, '');
    html = html.replace(/<meta name="twitter:card"[^>]*(\/?>)/g, '');
    html = html.replace(/<meta name="twitter:title"[^>]*(\/?>)/g, '');
    html = html.replace(/<meta name="twitter:description"[^>]*(\/?>)/g, '');

    // Step 3b: Replace the now-isolated <title> tag with the full route-specific
    // head block (title + description + robots + canonical + og + twitter + JSON-LD).
    // Done AFTER cleanup so routeHeadHtml is never touched by the removals above.
    html = html.replace(
      /<title>[^<]*<\/title>/,
      `<!-- Route-specific head for ${url} -->\n    ${routeHeadHtml}\n    <!-- End route-specific head -->`
    );

    // 4. Inject pre-rendered HTML into the root div
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root" data-ssr="true">${appHtml}</div>`
    );

    // 5. Write to output file
    const outFile =
      url === '/'
        ? path.resolve(__dirname, 'dist/public/index.html')
        : path.resolve(__dirname, `dist/public${url}/index.html`);

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, 'utf-8');
    console.log(`[prerender] ✓ Written → ${outFile}`);
  }

  console.log('[prerender] Done — all static routes pre-rendered with route-specific head.');

  // ── Blog posts ─────────────────────────────────────────────────────────────
  // Dynamically fetch all published internal blog posts from the running API
  // server and generate a per-post static HTML file in dist/public/blog/:slug/.
  //
  // Gracefully skips if the API server is unreachable (cold first-build) — those
  // posts will be served by the api-server dynamic SSR fallback instead.

  // Resolve which API to pull blog posts from. Prefer an explicit override;
  // otherwise try the local dev API first (fast, reflects the working DB during
  // local builds) and fall back to the live production API for deploy builds,
  // where localhost:8080 isn't running. Without this fallback the deploy build
  // pre-renders ZERO blog posts, so crawlers (e.g. Facebook) receive the generic
  // homepage OG tags for every /blog/:slug URL instead of the post's own title
  // and featured image.
  const API_BASES = process.env['BLOG_PRERENDER_API']
    ? [process.env['BLOG_PRERENDER_API']]
    : ['http://localhost:8080', 'https://job-genie.ai'];

  let API_BASE = null;
  let blogPosts = [];

  for (const base of API_BASES) {
    try {
      console.log(`[prerender] Fetching blog post list from ${base}/api/blog…`);
      const listResp = await fetch(`${base}/api/blog?limit=500&offset=0`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!listResp.ok) {
        console.warn(`[prerender] ${base} returned ${listResp.status} — trying next source`);
        continue;
      }
      const listData = await listResp.json();
      blogPosts = (listData.posts ?? []).filter((p) => p.source === 'internal');
      API_BASE = base;
      console.log(`[prerender] ${blogPosts.length} internal blog posts to pre-render (source: ${base})`);
      break;
    } catch (err) {
      console.warn(`[prerender] Could not reach ${base} — trying next source:`, err.message);
    }
  }

  if (!API_BASE) {
    console.warn('[prerender] No API source reachable — skipping blog prerender');
  }

  // Import blog-specific render functions from the SSR bundle built above
  const { renderBlogPost, getBlogPostHeadHtml } = await import('./dist/server/entry-server.mjs');

  // Canonical site URL — static images are served from here (no /api/ prefix)
  const SITE_URL = 'https://www.job-genie.ai';

  // Ensure static blog-images directory exists
  const staticImagesDir = path.resolve(__dirname, 'dist/public/blog-images');
  fs.mkdirSync(staticImagesDir, { recursive: true });

  /**
   * Downloads a hero image from the local API and saves it as a static file
   * in dist/public/blog-images/. Returns the new absolute static URL so og:image
   * points directly to the static file instead of the API proxy.
   *
   * Why: Replit's GCP load balancer injects a GAESA session-affinity Set-Cookie
   * header on every API response. Browsers/CDNs interpret any Set-Cookie as
   * user-specific content and force Cache-Control: private, which breaks
   * Facebook's social crawler (it cannot use images marked private).
   * Static files bypass Express entirely — no cookie, no private override.
   */
  async function downloadHeroImageAsStatic(featuredImageUrl) {
    if (!featuredImageUrl || !featuredImageUrl.includes('/api/blog-images/')) {
      return featuredImageUrl;
    }
    const filename = featuredImageUrl.split('/api/blog-images/').pop();
    if (!filename || !/^[a-z0-9-]+\.(png|jpg)$/i.test(filename)) {
      return featuredImageUrl;
    }
    const outFile = path.join(staticImagesDir, filename);
    if (fs.existsSync(outFile)) {
      return `${SITE_URL}/blog-images/${filename}`;
    }
    try {
      const imgResp = await fetch(`http://localhost:8080/api/blog-images/${filename}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!imgResp.ok) {
        console.warn(`[prerender]   image download failed (${imgResp.status}) for ${filename} — keeping API URL`);
        return featuredImageUrl;
      }
      const buffer = Buffer.from(await imgResp.arrayBuffer());
      fs.writeFileSync(outFile, buffer);
      console.log(`[prerender]   ✓ saved static hero image: /blog-images/${filename}`);
      return `${SITE_URL}/blog-images/${filename}`;
    } catch (err) {
      console.warn(`[prerender]   image download error for ${filename}: ${err.message} — keeping API URL`);
      return featuredImageUrl;
    }
  }

  for (const postSummary of blogPosts) {
    const slug = postSummary.slug;
    console.log(`[prerender] Rendering /blog/${slug}…`);

    try {
      const postResp = await fetch(`${API_BASE}/api/blog/${slug}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!postResp.ok) {
        console.warn(`[prerender]   /api/blog/${slug} → ${postResp.status} — skipping`);
        continue;
      }
      const postData = await postResp.json();

      // Download hero image as static file and rewrite og:image to static URL
      // so it bypasses Replit's GCP proxy (which forces Cache-Control: private).
      if (postData.post?.featuredImageUrl) {
        postData.post.featuredImageUrl = await downloadHeroImageAsStatic(postData.post.featuredImageUrl);
      }

      // 1. Render article body via SSR
      const appHtml = renderBlogPost(postData);

      // 2. Build per-post head HTML fragment
      const headHtml = getBlogPostHeadHtml(postData);

      // 3. Start from the shared index.html template
      let html = template;

      // 4. Strip homepage-level meta tags (same pattern as static routes)
      html = html.replace(/<meta name="description"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta name="robots"[^>]*(\/?>)/g, '');
      html = html.replace(/<link rel="canonical"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta property="og:title"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta property="og:description"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta property="og:url"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta property="og:site_name"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta property="og:type"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta name="twitter:card"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta name="twitter:title"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta name="twitter:description"[^>]*(\/?>)/g, '');
      // Strip the homepage image tags too, otherwise the generic og-image.png
      // lingers alongside the per-post featured image and crawlers (Facebook)
      // treat the two og:image tags as a gallery / pick the wrong one.
      html = html.replace(/<meta property="og:image[^"]*"[^>]*(\/?>)/g, '');
      html = html.replace(/<meta name="twitter:image"[^>]*(\/?>)/g, '');

      // 5. Replace <title> with per-post head block
      html = html.replace(
        /<title>[^<]*<\/title>/,
        `<!-- Blog post head for /blog/${slug} -->\n    ${headHtml}\n    <!-- End blog post head -->`
      );

      // 6. Inject SSR-rendered article body into #root
      html = html.replace(
        '<div id="root"></div>',
        `<div id="root" data-ssr="true">${appHtml}</div>`
      );

      // 7. Write to dist/public/blog/:slug/index.html
      const outFile = path.resolve(__dirname, `dist/public/blog/${slug}/index.html`);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, html, 'utf-8');
      console.log(`[prerender] ✓ /blog/${slug}`);
    } catch (err) {
      console.warn(`[prerender] Failed /blog/${slug}:`, err.message);
    }
  }

  if (blogPosts.length > 0) {
    console.log(`[prerender] Blog posts done — ${blogPosts.length} posts pre-rendered.`);
  }
}

main().catch((err) => {
  console.error('[prerender] FAILED:', err);
  process.exit(1);
});
