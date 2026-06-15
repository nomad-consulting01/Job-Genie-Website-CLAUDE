import { createPortal } from 'react-dom';

const SITE_URL = 'https://job-genie.ai';
const SITE_NAME = 'Job Genie';

const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  description: 'Recruiter-visibility platform helping job seekers reach the hidden job market via specialist recruiters.',
  sameAs: [],
};

const SOFTWARE_APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#app`,
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free Application Autopsy — no account or credit card required.',
  },
  provider: { '@id': `${SITE_URL}/#organization` },
};

const HOW_TO_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to get your free Application Autopsy',
  description: 'Upload your resume to get your Application Silence Score, Recruiter-Fit Gap, and channel diagnosis in under 2 minutes.',
  step: [
    { '@type': 'HowToStep', position: 1, name: 'Upload your resume', text: 'Upload your current CV — PDF, Word, or plain text.' },
    { '@type': 'HowToStep', position: 2, name: 'Receive your Autopsy', text: 'Job Genie diagnoses your Application Silence Score, ghost-job exposure, and Recruiter-Fit Gap in under 2 minutes.' },
    { '@type': 'HowToStep', position: 3, name: 'See your matched roles', text: 'Review your closest matches from 300,000+ specialist recruiter-held listings — roles never posted on LinkedIn or Indeed.' },
  ],
};

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'Why do my job applications keep going silent?', acceptedAnswer: { '@type': 'Answer', text: 'Applications go silent for three fixable reasons: wrong channel (70–80% of the best roles are filled through specialist recruiters before they reach job boards), ghost job exposure (31% of job board listings are already filled), and resume misalignment (your CV does not match the keywords specialist recruiters search for).' } },
    { '@type': 'Question', name: 'What is an Application Silence Score?', acceptedAnswer: { '@type': 'Answer', text: 'An Application Silence Score (HIGH, MEDIUM, or LOW) quantifies exactly why your job search is losing interviews — diagnosing channel mismatch, ghost job exposure, and resume-to-brief alignment gaps in under 2 minutes.' } },
    { '@type': 'Question', name: 'Is Job Genie free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The Free Autopsy includes your Application Silence Score, Recruiter-Fit Score, keyword gap analysis, and full blocker diagnosis — no account or credit card required.' } },
    { '@type': 'Question', name: 'What percentage of jobs are filled through specialist recruiters?', acceptedAnswer: { '@type': 'Answer', text: '70–80% of the best roles — particularly senior, specialist, and high-compensation positions — are filled before they ever appear on public job boards.' } },
    { '@type': 'Question', name: 'What are ghost jobs?', acceptedAnswer: { '@type': 'Answer', text: 'Ghost jobs are listings that remain visible online but are no longer actively being filled. Research estimates approximately 31% of job board listings at any given time are ghost jobs. Job Genie validates every listing URL in real time.' } },
    { '@type': 'Question', name: 'What is the hidden job market?', acceptedAnswer: { '@type': 'Answer', text: 'The hidden job market refers to the 70–80% of roles — especially specialist, senior, and well-compensated positions — that are filled through specialist recruiters and never posted publicly on job boards like LinkedIn or Indeed.' } },
    { '@type': 'Question', name: 'Why is my resume not getting interviews?', acceptedAnswer: { '@type': 'Answer', text: 'Your resume may not be getting interviews because of three fixable factors: you are applying through the wrong channel (job boards miss 70–80% of the market), some listings you apply to are ghost jobs, or your resume is missing the specific keywords and signals specialist recruiters search for.' } },
    { '@type': 'Question', name: 'What is a Recruiter-Fit Gap?', acceptedAnswer: { '@type': 'Answer', text: 'A Recruiter-Fit Gap is the difference between what your resume currently signals and what a specialist recruiter\'s client brief requires. Job Genie measures this gap precisely and shows you exactly which keywords and signals are missing.' } },
  ],
};

export interface SEOProps {
  title?: string;
  description?: string;
  url?: string;
  canonicalUrl?: string;
  robots?: string;
  pageType?: 'home' | 'landing' | 'article';
  slug?: string;
  aeoQuestion?: string;
}

export function SEO({
  title = `${SITE_NAME} — Free Application Autopsy | Reach the Hidden Job Market`,
  description = '70–80% of the best roles are filled before they hit job boards. Get your free Application Silence Score and find out what\'s blocking your interviews.',
  url,
  canonicalUrl,
  robots,
  pageType = 'home',
  slug,
  aeoQuestion,
}: SEOProps) {
  const canonical = canonicalUrl ?? url ?? SITE_URL;

  const schemas: Record<string, unknown>[] = [
    ORG_SCHEMA,
    SOFTWARE_APP_SCHEMA,
    {
      '@context': 'https://schema.org',
      '@type': pageType === 'home' ? 'WebSite' : 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      ...(pageType === 'home' ? { potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } } : {}),
    },
    FAQ_SCHEMA,
    HOW_TO_SCHEMA,
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Job Genie Application Autopsy',
      provider: { '@id': `${SITE_URL}/#organization` },
      description: 'Free recruiter-visibility diagnostic — Application Silence Score, ghost-job exposure, and resume alignment analysis.',
      offers: [
        { '@type': 'Offer', name: 'Free Autopsy', price: '0', priceCurrency: 'USD' },
        { '@type': 'Offer', name: 'Pro Plan', price: '49', priceCurrency: 'USD', billingIncrement: 'P1M' },
      ],
      areaServed: 'Worldwide',
      serviceType: 'Job Search Optimization',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        ...(slug ? [{ '@type': 'ListItem', position: 2, name: title, item: canonical }] : []),
      ],
    },
    ...(aeoQuestion ? [{
      '@context': 'https://schema.org',
      '@type': 'Question',
      name: aeoQuestion,
      acceptedAnswer: { '@type': 'Answer', text: description },
    }] : []),
  ];

  // SSR guard: document.head is unavailable during server-side prerender
  if (typeof document === 'undefined') return null;

  // Use createPortal to inject into document.head synchronously on first render
  // (not deferred like useEffect), ensuring crawlers that execute JS see metadata immediately
  return createPortal(
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <link rel="canonical" href={canonical} />
      {robots && <meta name="robots" content={robots} />}
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>,
    document.head
  );
}
