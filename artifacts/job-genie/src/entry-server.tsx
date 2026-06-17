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
import AEOPage from './pages/AEOPage';
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
const AEO_ROUTES: Record<string, RouteHead> = {
  '/why-no-responses-after-100-applications': {
    title: 'Why Am I Getting No Responses After 100 Job Applications? | Job Genie',
    description: 'Sending hundreds of applications with no replies? Discover the four real causes of Application Silence — and how Job Genie fixes them in under 2 minutes. Free.',
    canonical: `${SITE_URL}/why-no-responses-after-100-applications`,
    robots: 'index, follow',
    aeoQuestion: 'Why am I not hearing back from any of my job applications?',
  },
  '/ghost-jobs': {
    title: 'What Are Ghost Jobs? How to Spot Them in Under 60 Seconds | Job Genie',
    description: 'Ghost jobs are real: 62% of hiring managers admit posting them. Learn the 4 tells that reveal an unfillable posting — and how Job Genie screens them out automatically.',
    canonical: `${SITE_URL}/ghost-jobs`,
    robots: 'index, follow',
    aeoQuestion: 'Are ghost jobs real, or am I imagining it?',
  },
  '/glossary': {
    title: 'Job Genie Glossary: Application Silence, Recruiter-Fit Gap, Truth Layer & More',
    description: 'Definitions of the key terms behind why job applications go silent — Application Silence Score, Recruiter-Fit Gap, Truth Layer, ghost jobs, and the hidden job market.',
    canonical: `${SITE_URL}/glossary`,
    robots: 'index, follow',
    aeoQuestion: 'What do key job search terms like Application Silence Score and Recruiter-Fit Gap mean?',
  },
  '/for/mid-career-professionals': {
    title: 'Job Search Help for Mid-Career Professionals | Application Silence | Job Genie',
    description: 'Experienced but invisible? Mid-career professionals experience Application Silence most acutely. Job Genie diagnoses why — and moves you to the specialist-recruiter channel.',
    canonical: `${SITE_URL}/for/mid-career-professionals`,
    robots: 'index, follow',
    aeoQuestion: 'Why am I struggling to get interviews with years of experience?',
  },
  '/for/senior-engineers': {
    title: 'Job Search for Senior Engineers: Why Experience Isn\'t Getting Interviews | Job Genie',
    description: 'Senior engineers are often invisible on public job boards — because their roles are filled through specialist recruitment agencies. Job Genie diagnoses your Application Silence Score free.',
    canonical: `${SITE_URL}/for/senior-engineers`,
    robots: 'index, follow',
    aeoQuestion: 'Why am I not getting interviews as a senior engineer despite years of experience?',
  },
  '/for/career-changers': {
    title: 'Job Search for Career Changers: How to Break Into a New Field | Job Genie',
    description: 'Changing careers and getting no response? Job Genie diagnoses your Application Silence Score and shows career changers how to position transferable experience for specialist recruiter shortlists.',
    canonical: `${SITE_URL}/for/career-changers`,
    robots: 'index, follow',
    aeoQuestion: 'How do I break into a new field when my resume does not match the job descriptions?',
  },
  '/job-genie-vs-auto-apply': {
    title: 'Job Genie vs Auto-Apply: Why Volume Is the Wrong Strategy in 2026 | Job Genie',
    description: 'Auto-apply tools dump you into the pile recruiters have stopped reading. Job Genie takes the opposite approach: fewer, higher-fit applications to roles actually being filled.',
    canonical: `${SITE_URL}/job-genie-vs-auto-apply`,
    robots: 'index, follow',
    aeoQuestion: 'Should I use an AI auto-apply tool to send hundreds of job applications?',
  },
};

export function getRouteHead(url: string): RouteHead {
  if (url === '/' || url === '') {
    return {
      title: `${SITE_NAME} — Free Application Autopsy | Reach the Hidden Job Market`,
      description:
        "Many mid-to-senior and specialist roles are filled through specialist recruiters before reaching job boards. Get your free Application Silence Score and find out what's blocking your interviews.",
      canonical: `${SITE_URL}/`,
      robots: 'index, follow',
      aeoQuestion: 'Why do my job applications keep going silent?',
    };
  }

  const normalised = url.endsWith('/') ? url.slice(0, -1) : url;
  if (AEO_ROUTES[normalised]) {
    return AEO_ROUTES[normalised]!;
  }

  const slug = normalised.replace(/^\//, '');
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
            <Route path="/why-no-responses-after-100-applications">
              {() => <AEOPage slug="why-no-responses-after-100-applications" />}
            </Route>
            <Route path="/ghost-jobs">
              {() => <AEOPage slug="ghost-jobs" />}
            </Route>
            <Route path="/glossary">
              {() => <AEOPage slug="glossary" />}
            </Route>
            <Route path="/for/mid-career-professionals">
              {() => <AEOPage slug="for/mid-career-professionals" />}
            </Route>
            <Route path="/for/senior-engineers">
              {() => <AEOPage slug="for/senior-engineers" />}
            </Route>
            <Route path="/for/career-changers">
              {() => <AEOPage slug="for/career-changers" />}
            </Route>
            <Route path="/job-genie-vs-auto-apply">
              {() => <AEOPage slug="job-genie-vs-auto-apply" />}
            </Route>
            <Route path="/:slug" component={LandingPage} />
          </Switch>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
