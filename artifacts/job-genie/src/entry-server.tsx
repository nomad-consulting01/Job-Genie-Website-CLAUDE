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
import AutopsyPage from './pages/AutopsyPage';
import FreeAutopsy2Page from './pages/FreeAutopsy2Page';
import FreeAutopsy3Page from './pages/FreeAutopsy3Page';
import FreeAutopsy4Page from './pages/FreeAutopsy4Page';
import AEOPage from './pages/AEOPage';
import ResourcesPage from './pages/ResourcesPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import DataDeletion from './pages/DataDeletion';
import MethodologyPage from './pages/MethodologyPage';
import variantsData from './data/variants.json';
import ReactMarkdown from 'react-markdown';
import { DirectResponseTabs, type PublicDirectResponse } from '@/components/DirectResponseTabs';

import { SITE_URL, SITE_NAME } from '@workspace/site-config';

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
  '/free-autopsy': {
    title: 'Free Application Autopsy — Find Out Why Your Applications Go Silent | Job Genie',
    description:
      'Get your free Application Silence Score in 2 minutes — no account, no credit card. Discover your ghost-job exposure and what is blocking recruiter callbacks.',
    canonical: `${SITE_URL}/free-autopsy`,
    robots: 'index, follow',
    aeoQuestion: 'How do I find out why my job applications never get a response?',
  },
  '/free-autopsy2': {
    title: 'Free Application Autopsy — Find Out Why Your Applications Go Silent | Job Genie',
    description:
      'A private, specific read on where your applications are disappearing — the résumé screen, the recruiter pass, or a ghost posting that was never really hiring.',
    canonical: `${SITE_URL}/free-autopsy2`,
    robots: 'index, follow',
    aeoQuestion: 'How can I find out where my job applications are breaking down?',
  },
  '/free-autopsy3': {
    title: 'Free Application Autopsy — See Where Your Job Search Is Stalling | Job Genie',
    description:
      'Tell us what you want to change, how long you have been searching, and where you apply. Start your free Application Autopsy with a private, guided first step.',
    canonical: `${SITE_URL}/free-autopsy3`,
    robots: 'index, follow',
    aeoQuestion: 'How do I find out which part of my job search needs to change?',
  },
  '/free-autopsy4': {
    title: 'Free Application Autopsy — Explore the Score, Evidence & Silence Ledger | Job Genie',
    description:
      'Explore Job Genie’s Application Autopsy through an interactive preview: score breakdown, reusable evidence, and a reply-focused application ledger.',
    canonical: `${SITE_URL}/free-autopsy4`,
    robots: 'index, follow',
    aeoQuestion: 'What does Job Genie’s Application Autopsy show?',
  },
  '/resources': {
    title: 'Job Search Resources & Guides | Job Genie',
    description: 'All Job Genie educational guides in one place — Application Silence, ghost jobs, glossary, career-changer advice, and more. Start here.',
    canonical: `${SITE_URL}/resources`,
    robots: 'index, follow',
    aeoQuestion: 'Where can I find all the Job Genie job search guides?',
  },
  '/methodology': {
    title: 'How the Application Silence Score works | Job Genie',
    description: 'The methodology behind the Application Silence Score: why hiring screens rank rather than reject, the eight causes of application silence, and every source we rely on.',
    canonical: `${SITE_URL}/methodology`,
    robots: 'index, follow',
  },
  '/terms': {
    title: 'Terms of Service | Job Genie',
    description: 'Terms of Service for Job-Genie.ai — the rules governing your access to and use of the Job Genie platform.',
    canonical: `${SITE_URL}/terms`,
    robots: 'index, follow',
  },
  '/privacy': {
    title: 'Privacy Policy | Job Genie',
    description: 'How Job-Genie.ai collects, uses, and protects your information when you use our platform.',
    canonical: `${SITE_URL}/privacy`,
    robots: 'index, follow',
  },
  '/data-deletion': {
    title: 'Request Data Deletion | Job Genie',
    description: 'Request deletion of your personal data from Job-Genie.ai. CCPA and GDPR compliant, processed within 30 days.',
    canonical: `${SITE_URL}/data-deletion`,
    robots: 'index, follow',
  },
};

export function getRouteHead(url: string): RouteHead {
  if (url === '/' || url === '') {
    return {
      title: 'Why Your Job Applications Go Silent | Free Application Autopsy | Job Genie',
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
      { '@type': 'Offer', name: 'Pro Monthly', price: '49.99', priceCurrency: 'USD', billingIncrement: 'P1M' },
      { '@type': 'Offer', name: 'Pro Three Months', price: '99.99', priceCurrency: 'USD', billingIncrement: 'P3M' },
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

  const methodologyFaqSchema = slug === 'methodology' ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What does the Application Silence Score measure?',
        acceptedAnswer: { '@type': 'Answer', text: 'It estimates why your job applications get no response at all. It rests on one documented fact: modern hiring screens rank candidates rather than reject them. Recruiters contact people from the top of a ranked list down, and anyone below the point where they stop receives nothing, because no rejection decision was ever made.' },
      },
      {
        '@type': 'Question',
        name: 'Do applicant tracking systems reject candidates automatically?',
        acceptedAnswer: { '@type': 'Answer', text: "Usually not. Screening platforms document that they score and rank candidates, and at least one vendor explicitly refuses to auto-reject on its score. 'Ranked and never reached' is more accurate than 'robots reject you'." },
      },
      {
        '@type': 'Question',
        name: 'What are the causes of application silence?',
        acceptedAnswer: { '@type': 'Answer', text: "Job Genie's Autopsy can name eight: achievement legibility, professional footprint, trajectory and internal displacement, title lineage and seniority, role economics and geography, channel mismatch, target mismatch, and the active-candidate penalty. Several cannot be fixed by editing a résumé." },
      },
      {
        '@type': 'Question',
        name: 'Why does it matter whether I applied through a job board, an in-house recruiter or an agency?',
        acceptedAnswer: { '@type': 'Answer', text: 'Each channel is paid differently and evaluates candidates differently. Job boards earn from employers on engagement, in-house recruiters handle many roles at once, and specialist recruiters earn on placement. Silence from each is a different failure with a different fix.' },
      },
      {
        '@type': 'Question',
        name: 'Does the Application Silence Score guarantee interviews?',
        acceptedAnswer: { '@type': 'Answer', text: 'No. It tells you why your applications are going silent and what to change. Whether you get an interview depends on employers and a labour market Job Genie does not control.' },
      },
    ],
  }) : null;

  const homeFaqSchema = isHome ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Why am I not hearing back from any of my job applications?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "If you've sent dozens or hundreds of applications and heard nothing back — not even rejections — you're experiencing Application Silence, and it's rarely about your qualifications. A single role now draws thousands of near-identical, AI-optimised applications, so most are filtered or deprioritised before a human opens them. The fix isn't more volume; it's becoming a candidate a specialist recruiter can shortlist. Job Genie diagnoses why you're being filtered with an Application Silence Score and rewrites your profile to clear the recruiter shortlist threshold.",
        },
      },
      {
        '@type': 'Question',
        name: 'Is it normal to apply to 100+ jobs and get no response in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Unfortunately, yes — and it is a signal the channel is broken, not that you are. With auto-apply tools pushing some roles past thousands of submissions, interview rates on public postings have collapsed into the low single digits, while referred and recruiter-shortlisted candidates convert many times higher. The public-application channel now has the worst odds of any route into a job. Job Genie redirects your effort toward the channels that still work.",
        },
      },
      {
        '@type': 'Question',
        name: 'Why do recruiters ghost candidates, even after interviews?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Recruiters usually ghost because of volume and broken process, not personal rejection. A single recruiter may long-list hundreds of names, phone-screen 10 to 20, and present only 3 to 4 to the client — and roles get put on hold, filled internally, or reassigned without anyone updating applicants. It feels personal; it almost never is. The way out is to stop competing inside the silent pile and instead become recruiter-ready, so a recruiter has a reason to keep you on the list.",
        },
      },
    ],
  }) : null;

  const homeHowToSchema = isHome ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to get your free Application Autopsy',
    description: 'Upload your resume to get your Application Silence Score, Recruiter-Fit Gap, and channel diagnosis in under 2 minutes.',
    step: [
      { '@type': 'HowToStep', position: 1, name: 'Upload your resume', text: 'Upload your current CV — PDF, Word, or plain text.' },
      { '@type': 'HowToStep', position: 2, name: 'Receive your Autopsy', text: 'Job Genie diagnoses your Application Silence Score, ghost-job exposure, and Recruiter-Fit Gap in under 2 minutes.' },
      { '@type': 'HowToStep', position: 3, name: 'See your matched roles', text: 'Review your closest matches from 300,000+ specialist recruiter-held listings — roles never posted on LinkedIn or Indeed.' },
    ],
  }) : null;

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
    methodologyFaqSchema ? `<script type="application/ld+json">${methodologyFaqSchema}</script>` : null,
    homeFaqSchema ? `<script type="application/ld+json">${homeFaqSchema}</script>` : null,
    homeHowToSchema ? `<script type="application/ld+json">${homeHowToSchema}</script>` : null,
  ];

  return lines.filter(Boolean).join('\n    ');
}

// ─── Blog Post SSR ───────────────────────────────────────────────────────────

export interface BlogPostSSRData {
  post: {
    id: number;
    slug: string;
    seoTitle: string;
    metaDescription: string;
    readTimeMinutes: number | null;
    faqJsonLd: Record<string, unknown> | null;
    featuredImageUrl: string | null;
    content: string;
    publishedAt: string | null;
  };
  question: {
    normalisedQuestion: string;
    painPointTags: string[];
    sourceUrl: string | null;
  };
  answer: {
    id: number;
    answerFirstBlock: string;
  };
  directResponse?: PublicDirectResponse | null;
}

function StaticBlogPost({ post, question, answer, directResponse }: BlogPostSSRData) {
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <div>
      <header>
        <div>
          <a href="/">Job Genie</a>
          <a href="/blog">← All posts</a>
        </div>
      </header>
      <main>
        <nav aria-label="breadcrumb">
          <a href="/">Home</a> › <a href="/blog">Blog</a> ›{' '}
          <span>{post.seoTitle.replace(' | Job Genie', '')}</span>
        </nav>
        <div>
          {date && <time dateTime={post.publishedAt ?? undefined}>{date}</time>}
          {post.readTimeMinutes && <span>{post.readTimeMinutes} min read</span>}
        </div>
        <h1>{post.seoTitle.replace(' | Job Genie', '')}</h1>
        {answer.answerFirstBlock && (
          <section aria-label="Quick Answer">
            <p>{answer.answerFirstBlock}</p>
          </section>
        )}
        <article>
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </article>
        {question.painPointTags.length > 0 && (
          <footer>
            <ul aria-label="Topics">
              {question.painPointTags.map((t) => (
                <li key={t}>{t.replace(/_/g, ' ')}</li>
              ))}
            </ul>
          </footer>
        )}
        <DirectResponseTabs directResponse={directResponse ?? null} />
      </main>
    </div>
  );
}

/** Renders a blog post to an HTML string for SSR prerender. */
export function renderBlogPost(data: BlogPostSSRData): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <StaticBlogPost {...data} />
    </QueryClientProvider>
  );
}

/** Serialises an object as JSON-LD, escaping `<` so DB content can't break out of the script tag. */
function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

/** Returns the full <head> HTML fragment for a blog post, ready to inject into index.html. */
export function getBlogPostHeadHtml(data: BlogPostSSRData): string {
  const { post, question, answer } = data;
  const canonical = `${SITE_URL}/blog/${post.slug}`;
  const title = post.seoTitle.includes('| Job Genie') ? post.seoTitle : `${post.seoTitle} | Job Genie`;
  const description = post.metaDescription;
  const OG_IMAGE = post.featuredImageUrl ?? `${SITE_URL}/brand/blog-og-dark-teal.png`;

  const articleSchema = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${canonical}#article`,
    headline: post.seoTitle.replace(' | Job Genie', ''),
    description,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    image: OG_IMAGE,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.publishedAt ?? undefined,
    author: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME },
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en-GB',
    about: question.painPointTags.map((tag) => ({
      '@type': 'Thing',
      name: tag.replace(/_/g, ' '),
    })),
  });

  const breadcrumbSchema = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.seoTitle.replace(' | Job Genie', ''),
        item: canonical,
      },
    ],
  });

  // Use the full answerFirstBlock for AEO citability — richer than the truncated description.
  const questionSchema = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Question',
    name: question.normalisedQuestion,
    acceptedAnswer: { '@type': 'Answer', text: answer.answerFirstBlock || description },
  });

  const faqSchema = post.faqJsonLd ? jsonLd(post.faqJsonLd) : null;

  const lines: (string | null)[] = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<script type="application/ld+json">${articleSchema}</script>`,
    `<script type="application/ld+json">${breadcrumbSchema}</script>`,
    `<script type="application/ld+json">${questionSchema}</script>`,
    faqSchema ? `<script type="application/ld+json">${faqSchema}</script>` : null,
  ];

  return lines.filter(Boolean).join('\n    ');
}

// ─── Original render ──────────────────────────────────────────────────────────

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
            <Route path="/free-autopsy" component={AutopsyPage} />
            <Route path="/free-autopsy2" component={FreeAutopsy2Page} />
            <Route path="/free-autopsy3" component={FreeAutopsy3Page} />
            <Route path="/free-autopsy4" component={FreeAutopsy4Page} />
            <Route path="/resources" component={ResourcesPage} />
            <Route path="/methodology" component={MethodologyPage} />
            <Route path="/terms" component={TermsOfService} />
            <Route path="/privacy" component={PrivacyPolicy} />
            <Route path="/data-deletion" component={DataDeletion} />
            <Route path="/:slug" component={LandingPage} />
          </Switch>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
