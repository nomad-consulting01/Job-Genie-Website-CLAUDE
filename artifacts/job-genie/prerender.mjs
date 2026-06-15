/**
 * Static pre-render script for AEO/SEO.
 *
 * Run after the Vite client build to generate static HTML files for each landing page
 * route. Each file includes:
 *   - Full React-rendered page content (FAQ, comparison table, hero copy) in the <body>
 *   - Route-specific <title>, <meta name="description">, canonical, robots, og/twitter tags
 *   - Per-route WebPage + Question JSON-LD in <head>
 *   - The shared static JSON-LD schemas from index.html (Org, FAQ, HowTo, SoftwareApp)
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
  '/why-job-applications-go-silent',
  '/application-silence-score',
  '/resume-not-getting-interviews',
  '/recruiter-fit-gap',
  '/ghost-jobs',
  '/hidden-job-market',
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

  console.log('[prerender] Done — all routes pre-rendered with route-specific head.');
}

main().catch((err) => {
  console.error('[prerender] FAILED:', err);
  process.exit(1);
});
