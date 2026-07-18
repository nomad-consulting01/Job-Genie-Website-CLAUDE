import { useEffect } from "react";
import { Link } from "wouter";
import { SEO } from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import { SITE_URL } from "@workspace/site-config";

const GUIDES = [
  {
    href: "/why-no-responses-after-100-applications",
    title: "Why No Responses After 100 Applications?",
    description:
      "Sending hundreds of applications with no replies? Discover the four real causes of Application Silence and how to fix them in under 2 minutes.",
    tag: "Application Silence",
  },
  {
    href: "/ghost-jobs",
    title: "What Are Ghost Jobs?",
    description:
      "62% of hiring managers admit posting ghost jobs. Learn the 4 tells that reveal an unfillable posting — and how to screen them out automatically.",
    tag: "Ghost Jobs",
  },
  {
    href: "/glossary",
    title: "Job Search Glossary",
    description:
      "Definitions of the key terms behind why job applications go silent — Application Silence Score, Recruiter-Fit Gap, Truth Layer, and more.",
    tag: "Reference",
  },
  {
    href: "/job-genie-vs-auto-apply",
    title: "Job Genie vs Auto-Apply Tools",
    description:
      "Auto-apply tools dump you into the pile recruiters have stopped reading. See why quality beats volume in the 2026 job market.",
    tag: "Strategy",
  },
  {
    href: "/for/mid-career-professionals",
    title: "For Mid-Career Professionals",
    description:
      "Experienced but invisible? Mid-career professionals experience Application Silence most acutely. Learn why and how to break through.",
    tag: "For Professionals",
  },
  {
    href: "/for/senior-engineers",
    title: "For Senior Engineers",
    description:
      "Senior engineering roles are often filled through specialist recruiters before appearing on job boards. Find out why experience isn't getting you interviews.",
    tag: "For Professionals",
  },
  {
    href: "/for/career-changers",
    title: "For Career Changers",
    description:
      "Changing careers and getting no response? Learn how to position transferable experience so specialist recruiters put you on their shortlist.",
    tag: "For Professionals",
  },
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "Application Silence": { bg: "rgba(99,102,241,0.12)", text: "var(--indigo, #818cf8)" },
  "Ghost Jobs": { bg: "rgba(239,68,68,0.1)", text: "#f87171" },
  Reference: { bg: "rgba(45,212,191,0.1)", text: "var(--teal, #2dd4bf)" },
  Strategy: { bg: "rgba(251,191,36,0.1)", text: "#fbbf24" },
  "For Professionals": { bg: "rgba(167,139,250,0.1)", text: "#a78bfa" },
};

function PageNav() {
  return (
    <nav className="nav" id="nav" aria-label="Main navigation">
      <Link href="/" className="nlogo">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="28" height="28">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--inl)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Job Genie
      </Link>
      <ul className="nlinks">
        <li><Link href="/#how">How It Works</Link></li>
        <li><Link href="/#feat">Features</Link></li>
        <li><Link href="/resources" aria-current="page">Resources</Link></li>
        <li><Link href="/blog">Blog</Link></li>
        <li><Link href="/qa">FAQ</Link></li>
        <li>
          <a
            href="https://modular-pipeline.replit.app/?upload=true"
            className="btn bg bsm"
            style={{ color: "var(--wh)" }}
            onClick={() => trackEvent("free_autopsy_click", { location: "nav" })}
          >
            Get Free Autopsy
          </a>
        </li>
      </ul>
    </nav>
  );
}

function PageFooter() {
  return (
    <footer className="foot" role="contentinfo">
      <div className="w">
        <div className="footi">
          <div className="footl">
            <div style={{ background: "var(--inl)", width: "40px", height: "40px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--nn)" }}>
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            <span style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: "16px" }}>Job Genie</span>
          </div>
          <nav className="footlk" aria-label="Footer navigation">
            <Link href="/">Home</Link>
            <Link href="/resources">All Resources</Link>
            <Link href="/glossary">Glossary</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/qa">FAQ</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/data-deletion">Request Data Deletion</Link>
          </nav>
          <p className="footc">© 2026 Job-Genie.ai · <Link href="/for/mid-career-professionals">Mid-Career</Link> · <Link href="/for/senior-engineers">Senior Engineers</Link> · <Link href="/for/career-changers">Career Changers</Link></p>
        </div>
      </div>
    </footer>
  );
}

const canonical = `${SITE_URL}/resources`;

const collectionSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": `${canonical}#webpage`,
  url: canonical,
  name: "Job Search Resources & Guides | Job Genie",
  description:
    "All Job Genie educational guides in one place — Application Silence, ghost jobs, glossary, career-changer advice, and more.",
  isPartOf: { "@id": `${SITE_URL}/#website` },
  publisher: { "@id": `${SITE_URL}/#organization` },
  mainEntity: {
    "@type": "ItemList",
    itemListElement: GUIDES.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}${g.href}`,
      name: g.title,
    })),
  },
});

const breadcrumbSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Resources", item: canonical },
  ],
});

export default function ResourcesPage() {
  useEffect(() => {
    const nav = document.getElementById("nav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("solid", window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <SEO
        title="Job Search Resources & Guides | Job Genie"
        description="All Job Genie educational guides in one place — Application Silence, ghost jobs, glossary, career-changer advice, and comparisons. Start here."
        url={canonical}
        canonicalUrl={canonical}
        robots="index, follow"
        pageType="article"
        slug="resources"
        schemas={[JSON.parse(collectionSchema), JSON.parse(breadcrumbSchema)]}
      />

      <PageNav />

      <main style={{ paddingTop: "80px", minHeight: "100vh", background: "var(--nn, #080810)" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 24px 80px" }}>

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" style={{ paddingTop: "32px", marginBottom: "40px", fontSize: "13px", color: "var(--w40, rgba(255,255,255,0.4))" }}>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <li><Link href="/" style={{ color: "var(--w40, rgba(255,255,255,0.4))", textDecoration: "none" }}>Home</Link></li>
              <li aria-hidden="true" style={{ opacity: 0.4 }}>›</li>
              <li style={{ color: "var(--w60, rgba(255,255,255,0.6))" }}>Resources</li>
            </ol>
          </nav>

          {/* Header */}
          <header style={{ marginBottom: "56px" }}>
            <h1 style={{ fontSize: "clamp(28px,5vw,52px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "20px", color: "var(--wh, #fff)" }}>
              Start Here
            </h1>
            <p style={{ fontSize: "clamp(16px,2vw,20px)", color: "var(--w60, rgba(255,255,255,0.6))", lineHeight: 1.7, maxWidth: "640px", margin: 0 }}>
              Everything you need to understand why your job applications go silent — and what to do about it. Pick the guide most relevant to your situation.
            </p>
          </header>

          {/* Guide cards */}
          <section aria-label="All guides">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {GUIDES.map((guide) => {
                const tagStyle = TAG_COLORS[guide.tag] ?? TAG_COLORS["Reference"];
                return (
                  <Link
                    key={guide.href}
                    href={guide.href}
                    style={{ textDecoration: "none" }}
                    onClick={() => trackEvent("resources_guide_click", { href: guide.href })}
                  >
                    <article
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        padding: "24px 28px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "14px",
                        cursor: "pointer",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.35)";
                        (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between", flexWrap: "wrap" }}>
                        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--wh, #fff)", margin: 0, lineHeight: 1.3 }}>
                          {guide.title}
                        </h2>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            background: tagStyle.bg,
                            color: tagStyle.text,
                            flexShrink: 0,
                          }}
                        >
                          {guide.tag}
                        </span>
                      </div>
                      <p style={{ color: "var(--w60, rgba(255,255,255,0.6))", lineHeight: 1.7, fontSize: "15px", margin: 0 }}>
                        {guide.description}
                      </p>
                      <span style={{ fontSize: "13px", color: "var(--indigo, #818cf8)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        Read guide
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                      </span>
                    </article>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Also explore section */}
          <section style={{ marginTop: "56px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--w40, rgba(255,255,255,0.4))", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Also explore
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <Link href="/blog" style={{ padding: "10px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "var(--w80, rgba(255,255,255,0.8))", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>
                Blog →
              </Link>
              <Link href="/answers" style={{ padding: "10px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "var(--w80, rgba(255,255,255,0.8))", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>
                Q&amp;A Answers →
              </Link>
              <Link href="/qa" style={{ padding: "10px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "var(--w80, rgba(255,255,255,0.8))", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>
                FAQ →
              </Link>
            </div>
          </section>

          {/* CTA block */}
          <section style={{ marginTop: "64px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "16px", padding: "40px 32px", textAlign: "center" }}>
            <p style={{ fontSize: "clamp(18px,2.5vw,24px)", fontWeight: 700, color: "var(--wh, #fff)", marginBottom: "24px", lineHeight: 1.4 }}>
              Ready to see why your applications are going silent?
            </p>
            <a
              href="https://modular-pipeline.replit.app/?upload=true"
              className="btn bp"
              style={{ fontSize: "17px", padding: "17px 36px" }}
              onClick={() => trackEvent("free_autopsy_click", { location: "resources_cta" })}
            >
              Get Free Autopsy
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </a>
            <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--w40, rgba(255,255,255,0.4))" }}>
              No account. No credit card. Results in under 2 minutes.
            </p>
          </section>

        </div>
      </main>

      <PageFooter />
    </>
  );
}
