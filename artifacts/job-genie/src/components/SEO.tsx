import { useEffect } from 'react';

const SITE_URL = 'https://job-genie.ai';
const SITE_NAME = 'Job Genie';

const ORG_SCHEMA = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  description: 'Recruiter-visibility platform helping job seekers reach the hidden job market via specialist recruiters.',
  sameAs: [],
};

const SOFTWARE_APP_SCHEMA = {
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
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'Why do my job applications keep going silent?', acceptedAnswer: { '@type': 'Answer', text: 'Applications go silent for three fixable reasons: wrong channel (70–80% of the best roles are filled through specialist recruiters before they reach job boards), ghost job exposure (31% of job board listings are already filled), and resume misalignment (your CV does not match the keywords specialist recruiters search for).' } },
    { '@type': 'Question', name: 'What is an Application Silence Score?', acceptedAnswer: { '@type': 'Answer', text: 'An Application Silence Score (HIGH, MEDIUM, or LOW) quantifies exactly why your job search is losing interviews — diagnosing channel mismatch, ghost job exposure, and resume-to-brief alignment gaps in under 2 minutes.' } },
    { '@type': 'Question', name: 'Is Job Genie free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The Free Autopsy includes your Application Silence Score, Recruiter-Fit Score, keyword gap analysis, and full blocker diagnosis — no account or credit card required.' } },
    { '@type': 'Question', name: 'What percentage of jobs are filled through specialist recruiters?', acceptedAnswer: { '@type': 'Answer', text: '70–80% of the best roles — particularly senior, specialist, and high-compensation positions — are filled before they ever appear on public job boards.' } },
    { '@type': 'Question', name: 'What are ghost jobs?', acceptedAnswer: { '@type': 'Answer', text: 'Ghost jobs are listings that remain visible online but are no longer actively being filled. Research estimates approximately 31% of job board listings at any given time are ghost jobs. Job Genie validates every listing URL in real time.' } },
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
  useEffect(() => {
    document.title = title;

    const setMeta = (sel: string, val: string) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute('content', val);
    };

    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:site_name"]', SITE_NAME);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:card"]', 'summary_large_image');

    const canonical = canonicalUrl ?? url ?? SITE_URL;
    setMeta('meta[property="og:url"]', canonical);

    let linkCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.href = canonical;

    if (robots) {
      let metaRobots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (!metaRobots) {
        metaRobots = document.createElement('meta');
        metaRobots.name = 'robots';
        document.head.appendChild(metaRobots);
      }
      metaRobots.content = robots;
    }

    const schemas: Record<string, unknown>[] = [
      { '@context': 'https://schema.org', ...ORG_SCHEMA },
      { '@context': 'https://schema.org', ...SOFTWARE_APP_SCHEMA },
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
      { '@context': 'https://schema.org', ...FAQ_SCHEMA },
      { '@context': 'https://schema.org', ...HOW_TO_SCHEMA },
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

    document.querySelectorAll('script[data-jg-ld]').forEach(s => s.remove());
    schemas.forEach((schema, i) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-jg-ld', String(i));
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });

    return () => {
      document.querySelectorAll('script[data-jg-ld]').forEach(s => s.remove());
    };
  }, [title, description, canonicalUrl, url, robots, pageType, slug, aeoQuestion]);

  return null;
}
