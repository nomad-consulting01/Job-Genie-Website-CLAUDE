/**
 * Static pre-render script for AEO/SEO.
 *
 * Run after the Vite client build to generate static HTML files for each
 * landing page route. Output is written into dist/public/ so the static
 * HTML serves full page content (FAQ, comparison, hero copy) to crawlers
 * without requiring JavaScript execution.
 *
 * Usage (run automatically via `pnpm build`):
 *   PORT=0 BASE_PATH=/ node prerender.mjs
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

  console.log('[prerender] Loading SSR render function…');
  const { render } = await import('./dist/server/entry-server.mjs');

  const templatePath = path.resolve(__dirname, 'dist/public/index.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error(
      'dist/public/index.html not found — run the client build first:\n  pnpm --filter @workspace/job-genie build'
    );
  }
  const template = fs.readFileSync(templatePath, 'utf-8');

  for (const url of ROUTES) {
    console.log(`[prerender] Rendering ${url}…`);
    const appHtml = render(url);

    // Inject pre-rendered HTML into the root div and mark as SSR'd
    const html = template
      .replace('<div id="root"></div>', `<div id="root" data-ssr="true">${appHtml}</div>`);

    const outFile =
      url === '/'
        ? path.resolve(__dirname, 'dist/public/index.html')
        : path.resolve(__dirname, `dist/public${url}/index.html`);

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, 'utf-8');
    console.log(`[prerender] ✓ ${outFile}`);
  }

  console.log('[prerender] Done — all routes pre-rendered.');
}

main().catch((err) => {
  console.error('[prerender] FAILED:', err);
  process.exit(1);
});
