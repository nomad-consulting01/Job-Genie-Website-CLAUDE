/**
 * SSR entry point for static pre-rendering.
 * Renders each route to an HTML string and provides per-route head metadata
 * for injection into the index.html template.
 * Used by prerender.mjs at build time — NOT loaded during normal Vite dev or client build.
 */
import { renderToString } from 'react-dom/server';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
import variantsData from './data/variants.json';

const SITE_URL = 'https://job-genie.ai';
const SITE_NAME = 'Job Genie';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface RouteHead {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  aeoQuestion?: string;
}

/**
 * Returns per-route head metadata for prerender injection.
 * Called by prerender.mjs for each route before writing the static HTML file.
 */
export function getRouteHead(url: string): RouteHead {
  if (url === '/' || url === '') {
    return {
      title: `${SITE_NAME} — Free Application Autopsy | Reach the Hidden Job Market`,
      description:
        "70–80% of the best roles are filled before they hit job boards. Get your free Application Silence Score and find out what's blocking your interviews.",
      canonical: `${SITE_URL}/`,
      robots: 'index, follow',
      aeoQuestion: 'Why do my job applications keep going silent?',
    };
  }

  const slug = url.replace(/^\//, '').replace(/\/$/, '');
  const variant = (variantsData.variants as Array<Record<string, string>>).find(
    (v) => v['slug'] === slug
  );

  if (variant) {
    return {
      title: `${variant['headline']} | ${SITE_NAME}`,
      description:
        variant['subheadline'] ||
        'Get your free Application Silence Score in 2 minutes — no account, no credit card.',
      canonical: variant['canonical_url'] || `${SITE_URL}/${slug}`,
      robots: variant['indexing'] === 'noindex' ? 'noindex, follow' : 'index, follow',
      aeoQuestion: variant['aeo_question'],
    };
  }

  return {
    title: SITE_NAME,
    description: 'Free recruiter-visibility diagnostic for job seekers.',
    canonical: `${SITE_URL}${url}`,
    robots: 'noindex, follow',
  };
}

/**
 * Builds the route-specific head HTML fragment to inject into the static template.
 * Replaces the home-page defaults in index.html with correct per-route values and
 * includes the full required schema set: WebPage, Service, Offer, BreadcrumbList,
 * and per-route Question (AEO).
 */
export function buildHeadHtml(head: RouteHead): string {
  const isHome = head.canonical === `${SITE_URL}/` || head.canonical === SITE_URL;
  const slug = head.canonical.replace(`${SITE_URL}/`, '').replace(/\/$/, '') || '';

  const webPageSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': isHome ? 'WebSite' : 'WebPage',
    '@id': `${head.canonical}#webpage`,
    url: head.canonical,
    name: head.title,
    description: head.description,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    ...(isHome
      ? {
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        }
      : {}),
  });

  const serviceSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Job Genie Application Autopsy',
    provider: { '@id': `${SITE_URL}/#organization` },
    description:
      'Free recruiter-visibility diagnostic — Application Silence Score, ghost-job exposure, and resume alignment analysis.',
    offers: [
      { '@type': 'Offer', name: 'Free Autopsy', price: '0', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Pro Plan', price: '49', priceCurrency: 'USD', billingIncrement: 'P1M' },
    ],
    areaServed: 'Worldwide',
    serviceType: 'Job Search Optimization',
  });

  const breadcrumbSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      ...(slug
        ? [{ '@type': 'ListItem', position: 2, name: head.title, item: head.canonical }]
        : []),
    ],
  });

  const questionSchema = head.aeoQuestion
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Question',
        name: head.aeoQuestion,
        acceptedAnswer: { '@type': 'Answer', text: head.description },
      })
    : null;

  const lines = [
    `<title>${esc(head.title)}</title>`,
    `<meta name="description" content="${esc(head.description)}" />`,
    `<meta name="robots" content="${esc(head.robots)}" />`,
    `<link rel="canonical" href="${esc(head.canonical)}" />`,
    `<meta property="og:title" content="${esc(head.title)}" />`,
    `<meta property="og:description" content="${esc(head.description)}" />`,
    `<meta property="og:url" content="${esc(head.canonical)}" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(head.title)}" />`,
    `<meta name="twitter:description" content="${esc(head.description)}" />`,
    `<script type="application/ld+json">${webPageSchema}</script>`,
    `<script type="application/ld+json">${serviceSchema}</script>`,
    `<script type="application/ld+json">${breadcrumbSchema}</script>`,
    questionSchema ? `<script type="application/ld+json">${questionSchema}</script>` : null,
  ];

  return lines.filter(Boolean).join('\n    ');
}

/** Renders the React app for a given URL to an HTML string. */
export function render(url: string): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  // Provide a static wouter hook so route matching works without a browser
  const staticHook = (): [string, (to: string) => void] => [url, () => {}];

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter hook={staticHook}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/:slug" component={LandingPage} />
          </Switch>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
