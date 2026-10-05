import { createPortal } from 'react-dom';
import { SITE_URL, SITE_NAME, OG_IMAGE } from '@workspace/site-config';
import autopsySocial from '../data/autopsy-social.json';

const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  description: 'Recruiter-visibility platform that diagnoses why job applications go unanswered and connects candidates with specialist recruiter listings.',
  sameAs: [],
};

const SOFTWARE_APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#app`,
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free Application Autopsy — no account or credit card required.' },
    { '@type': 'Offer', name: 'Pro Monthly', price: '49.99', priceCurrency: 'USD', billingIncrement: 'P1M' },
    { '@type': 'Offer', name: 'Pro Three Months', price: '99.99', priceCurrency: 'USD', billingIncrement: 'P3M' },
  ],
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
      name: 'What is an Application Silence Score?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "An Application Silence Score is Job Genie's diagnostic of why your applications get no response — quantifying how far your profile sits from the recruiter shortlist threshold across the roles you target. Instead of guessing why you're being ghosted, you get a concrete read on what's filtering you out and what to change. It turns the black hole of silence into a fixable, measurable gap.",
      },
    },
    {
      '@type': 'Question',
      name: 'Is Job Genie free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The Free Autopsy includes your Application Silence Score, Recruiter-Fit Gap analysis, keyword gap analysis, and full blocker diagnosis — no account or credit card required.',
      },
    },
    {
      '@type': 'Question',
      name: 'Are ghost jobs real, or am I imagining it?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Ghost jobs are postings with no immediate intent to hire, including listings kept open for future pipelines. There is no reliable percentage here for how many current listings meet that definition. Job Genie checks recruiter-held listings for active signals so candidates can focus on roles that appear to be moving.",
      },
    },
    {
      '@type': 'Question',
      name: 'What is the hidden job market?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "The hidden job market is the set of roles filled through referrals, recruiter shortlists, and direct outreach without being publicly advertised. The concept dates to sociologist Mark Granovetter's 1974 research on how people actually find jobs; the popular claim that a fixed percentage of jobs are hidden is an unsupported inflation of it, but the phenomenon itself is real — most pronounced for mid-to-senior and specialist roles, where employers prefer a small, trusted talent pool over thousands of public applications. Job Genie makes you visible inside this market through specialist-recruiter listings.",
      },
    },
    {
      '@type': 'Question',
      name: 'Does my resume really get auto-rejected by ATS bots?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Mostly myth, partly true. Most recruiters don't run AI detectors or auto-reject the instant a resume arrives. But applicant tracking systems do parse, rank, and deprioritise: legacy systems on exact keyword matches, modern systems on semantic concept-matching. The real risk isn't instant deletion — it's quietly ranking below better-matched profiles. The fix is a resume written in the language of the role and the recruiter, not keyword-stuffed.",
      },
    },
    {
      '@type': 'Question',
      name: 'What is a Recruiter-Fit Gap?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "The Recruiter-Fit Gap is the distance between how you present yourself and what a specialist recruiter needs to see to put you on a client shortlist. Most qualified candidates aren't rejected on ability — they're filtered because their profile doesn't map cleanly to a recruiter brief. Job Genie measures this gap with a Recruiter-Fit Matrix and closes it, so you cross the shortlist threshold instead of stalling in Application Silence.",
      },
    },
    {
      '@type': 'Question',
      name: 'How do I find jobs that are not posted publicly?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Many mid-career and specialist roles are filled through referrals and recruiter shortlists before — or instead of — a public posting. The data backs the channel: employee referrals deliver over 30% of hires and convert far better than cold applications (about 1 in 16 vs 1 in 100, per SHRM and a Lever analysis), and referred candidates are roughly 4x more likely to be hired. You reach these roles by being recruiter-ready and discoverable to the specialist recruiters who fill them. Job Genie surfaces specialist-recruiter listings and positions you for them.",
      },
    },
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
  schemas?: Record<string, unknown>[];
  ogImage?: string;
}

export function SEO({
  title = 'Why Your Job Applications Go Silent | Free Application Autopsy | Job Genie',
  description = 'Why do job applications go silent? Job Genie diagnoses your Application Silence Score, measures your Recruiter-Fit Gap, and matches you to 300,000+ specialist recruiter listings — free, no account needed.',
  url,
  canonicalUrl,
  robots,
  pageType = 'home',
  slug,
  aeoQuestion,
  schemas: extraSchemas = [],
  ogImage,
}: SEOProps) {
  const canonical = canonicalUrl ?? url ?? SITE_URL;
  const socialSlug = slug ?? canonical.replace(`${SITE_URL}/`, '').replace(/\/$/, '');
  const social = autopsySocial[socialSlug as keyof typeof autopsySocial];
  const socialTitle = social?.title ?? title;
  const socialDescription = social?.description ?? description;
  const socialImage = ogImage ?? (social ? `${SITE_URL}${social.image}` : OG_IMAGE);

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
    ...(pageType === 'home' ? [FAQ_SCHEMA, HOW_TO_SCHEMA] : []),
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Job Genie Application Autopsy',
      provider: { '@id': `${SITE_URL}/#organization` },
      description: 'Free recruiter-visibility diagnostic — Application Silence Score, ghost-job exposure, and resume alignment analysis.',
      offers: [
        { '@type': 'Offer', name: 'Free Autopsy', price: '0', priceCurrency: 'USD' },
        { '@type': 'Offer', name: 'Pro Monthly', price: '49.99', priceCurrency: 'USD', billingIncrement: 'P1M' },
        { '@type': 'Offer', name: 'Pro Three Months', price: '99.99', priceCurrency: 'USD', billingIncrement: 'P3M' },
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
    ...extraSchemas,
  ];

  // SSR guard: document.head is unavailable during server-side prerender
  if (typeof document === 'undefined') return null;

  // Use createPortal to inject into document.head synchronously on first render
  // (not deferred like useEffect), ensuring crawlers that execute JS see metadata immediately
  return createPortal(
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={socialTitle} />
      <meta property="og:description" content={socialDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={social?.alt ?? "Job Genie — free Application Silence Score. Find out why your applications get no reply."} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={socialTitle} />
      <meta name="twitter:description" content={socialDescription} />
      <meta name="twitter:image" content={socialImage} />
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
