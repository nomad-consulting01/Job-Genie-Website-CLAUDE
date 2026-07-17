import landingPagesData from "@content/landing-pages.json";

export interface FAQItem {
  q: string;
  a: string;
}

export interface PageSection {
  heading: string;
  body: string;
  list?: string[];
  howToSteps?: Array<{ name: string; text: string }>;
  comparisonTable?: {
    headers: string[];
    rows: string[][];
  };
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface SourceItem {
  text: string;
  source: string;
}

export interface LandingPage {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  robots: string;
  primaryQuestion: string;
  h1: string;
  directAnswer: string;
  keyTakeaways: string[];
  sections: PageSection[];
  glossaryTerms?: GlossaryTerm[];
  faqs: FAQItem[];
  sources: SourceItem[];
  llmSummary: string;
  cta: { headline: string; buttonText: string; buttonUrl: string };
  schemas: string[];
}

export const landingPages: LandingPage[] = landingPagesData.pages as LandingPage[];
