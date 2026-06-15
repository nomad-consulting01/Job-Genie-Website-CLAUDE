import { useParams } from "wouter";
import { PageContent } from "./Home";
import variantsData from "../data/variants.json";
import NotFound from "./not-found";
import { SEO } from "../components/SEO";

export default function LandingPage() {
  const params = useParams();
  const slug = params.slug;
  
  const variant = variantsData.variants.find(v => v.slug === slug);

  if (!variant) {
    return <NotFound />;
  }

  return (
    <>
      <SEO 
        title={`${variant.headline} — Job Genie`}
        description={variant.subheadline}
      />
      <PageContent variant={variant} />
    </>
  );
}
