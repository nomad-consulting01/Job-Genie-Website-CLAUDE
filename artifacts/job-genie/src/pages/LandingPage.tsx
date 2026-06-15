import { useParams } from "wouter";
import { PageContent } from "./Home";
import variantsData from "../data/variants.json";
import NotFound from "./not-found";
import { SEO } from "../components/SEO";
import { getSlugExperiment } from "../lib/abtest";

interface VariantConfig {
  slug: string;
  status: string;
  indexing: string;
  canonical_url: string;
  audience: string;
  traffic_source: string;
  primary_keyword: string;
  aeo_question: string;
  headline: string;
  subheadline: string;
  eyebrow: string;
  quote: string;
  cta_primary: string;
  cta_secondary: string;
}

export default function LandingPage() {
  const params = useParams();
  const slug = params.slug ?? "";

  const variantConfig = variantsData.variants.find(v => v.slug === slug) as VariantConfig | undefined;

  if (!variantConfig) {
    return <NotFound />;
  }

  const exp = getSlugExperiment(slug);
  const overrides = (exp?.overrides ?? {}) as Record<string, string>;
  const variant = {
    ...variantConfig,
    ...(overrides.headline ? { headline: overrides.headline } : {}),
    ...(overrides.cta_primary ? { cta_primary: overrides.cta_primary } : {}),
  };

  const robots = variantConfig.indexing === 'noindex' ? 'noindex, nofollow' : 'index, follow';

  return (
    <>
      <SEO
        title={`${variant.headline} — Job Genie`}
        description={variant.subheadline}
        canonicalUrl={variantConfig.canonical_url}
        robots={robots}
        pageType="landing"
        slug={slug}
        aeoQuestion={variantConfig.aeo_question}
      />
      <PageContent
        variant={variant}
        experimentId={exp?.id}
        variantId={exp?.id ?? `lp_${slug}`}
      />
    </>
  );
}
