import { useEffect } from "react";
import { Link } from "wouter";
import { SEO } from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import { landingPages, type LandingPage } from "../data/landing-pages";
import { SITE_URL } from "@workspace/site-config";

interface AEOPageProps {
  slug: string;
}

function buildArticleSchema(page: LandingPage) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${page.canonicalUrl}#article`,
    headline: page.h1,
    description: page.metaDescription,
    url: page.canonicalUrl,
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": page.canonicalUrl },
  };
}

function buildFAQSchema(page: LandingPage) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function buildHowToSchema(page: LandingPage) {
  const steps = page.sections.flatMap((s) => s.howToSteps ?? []);
  if (steps.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: page.h1,
    description: page.directAnswer,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

function buildBreadcrumbSchema(page: LandingPage) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: page.h1, item: page.canonicalUrl },
    ],
  };
}

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
        <li><Link href="/glossary">Glossary</Link></li>
        <li><Link href="/blog">Blog</Link></li>
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

function PageFooter({ page }: { page: LandingPage }) {
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
            <Link href="/why-no-responses-after-100-applications">Application Silence</Link>
            <Link href="/ghost-jobs">Ghost Jobs</Link>
            <Link href="/glossary">Glossary</Link>
            <Link href="/job-genie-vs-auto-apply">vs Auto-Apply</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/data-deletion">Request Data Deletion</Link>
          </nav>
          <p className="footc">© 2026 Job-Genie.ai · <Link href="/glossary">Glossary</Link> · <Link href="/for/mid-career-professionals">Mid-Career</Link> · <Link href="/for/senior-engineers">Senior Engineers</Link> · <Link href="/for/career-changers">Career Changers</Link></p>
          <p className="footc" style={{ marginTop: "8px", fontSize: "11px", opacity: 0.4 }}>
            <a href={page.canonicalUrl} style={{ color: "inherit" }}>
              {page.canonicalUrl}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function AEOPage({ slug }: AEOPageProps) {
  const page = landingPages.find((p) => p.slug === slug);

  useEffect(() => {
    const nav = document.getElementById("nav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("solid", window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!page) {
    return (
      <>
        <PageNav />
        <main style={{ padding: "120px 24px", textAlign: "center" }}>
          <h1>Page not found</h1>
          <Link href="/" className="btn bp" style={{ marginTop: "24px", display: "inline-flex" }}>Back to Home</Link>
        </main>
      </>
    );
  }

  const articleSchema = buildArticleSchema(page);
  const faqSchema = buildFAQSchema(page);
  const howToSchema = buildHowToSchema(page);
  const breadcrumbSchema = buildBreadcrumbSchema(page);

  const extraSchemas = [
    articleSchema,
    faqSchema,
    breadcrumbSchema,
    ...(howToSchema ? [howToSchema] : []),
  ];

  const isGlossary = slug === "glossary";

  return (
    <>
      <SEO
        title={page.metaTitle}
        description={page.metaDescription}
        url={page.canonicalUrl}
        canonicalUrl={page.canonicalUrl}
        robots={page.robots}
        pageType="article"
        slug={slug}
        aeoQuestion={page.primaryQuestion}
        schemas={extraSchemas}
      />

      <PageNav />

      <main style={{ paddingTop: "80px", minHeight: "100vh", background: "var(--nn, #080810)" }}>
        <article style={{ maxWidth: "860px", margin: "0 auto", padding: "0 24px 80px" }}>

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" style={{ paddingTop: "32px", marginBottom: "40px", fontSize: "13px", color: "var(--w40, rgba(255,255,255,0.4))" }}>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <li><Link href="/" style={{ color: "var(--w40, rgba(255,255,255,0.4))", textDecoration: "none" }}>Home</Link></li>
              <li aria-hidden="true" style={{ opacity: 0.4 }}>›</li>
              <li style={{ color: "var(--w60, rgba(255,255,255,0.6))" }}>{page.h1}</li>
            </ol>
          </nav>

          <header>
            <h1 style={{ fontSize: "clamp(28px,5vw,52px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "32px", color: "var(--wh, #fff)" }}>
              {page.h1}
            </h1>

            {/* Direct answer block — AEO extraction target */}
            <section
              className="direct-answer"
              aria-label="Direct answer"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderLeft: "4px solid var(--indigo, #818cf8)",
                borderRadius: "0 12px 12px 0",
                padding: "24px 28px",
                marginBottom: "32px",
              }}
            >
              <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--indigo, #818cf8)", marginBottom: "12px" }}>
                Direct Answer
              </h2>
              <p style={{ fontSize: "17px", lineHeight: 1.7, color: "var(--w80, rgba(255,255,255,0.8))", margin: 0 }}>
                {page.directAnswer}
              </p>
            </section>

            {/* Key takeaways */}
            <section
              className="key-takeaways"
              style={{
                background: "rgba(45,212,191,0.06)",
                border: "1px solid rgba(45,212,191,0.15)",
                borderRadius: "12px",
                padding: "24px 28px",
                marginBottom: "56px",
              }}
            >
              <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--teal, #2dd4bf)", marginBottom: "16px" }}>
                Key Takeaways
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                {page.keyTakeaways.map((item, i) => (
                  <li key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", color: "var(--w80, rgba(255,255,255,0.8))", lineHeight: 1.6, fontSize: "15px" }}>
                    <span style={{ color: "var(--teal, #2dd4bf)", flexShrink: 0, fontWeight: 700, fontSize: "13px", marginTop: "2px" }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </header>

          {/* Content sections */}
          {page.sections.map((section, i) => (
            <section key={i} style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 700, color: "var(--wh, #fff)", marginBottom: "16px", lineHeight: 1.3 }}>
                {section.heading}
              </h2>
              <p style={{ color: "var(--w80, rgba(255,255,255,0.8))", lineHeight: 1.8, fontSize: "16px", marginBottom: section.list || section.howToSteps || section.comparisonTable ? "16px" : 0 }}>
                {section.body}
              </p>

              {/* Bullet list */}
              {section.list && (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {section.list.map((item, j) => (
                    <li key={j} style={{ display: "flex", gap: "12px", alignItems: "flex-start", color: "var(--w80, rgba(255,255,255,0.8))", lineHeight: 1.7, fontSize: "15px", padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ color: "var(--indigo, #818cf8)", flexShrink: 0, fontWeight: 700, fontSize: "13px", marginTop: "2px" }}>→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {/* How-to steps */}
              {section.howToSteps && (
                <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "16px" }}>
                  {section.howToSteps.map((step, j) => (
                    <li key={j} itemScope itemType="https://schema.org/HowToStep" style={{ display: "flex", gap: "16px", padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ flexShrink: 0, width: "32px", height: "32px", borderRadius: "50%", background: "var(--indigo, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "13px", color: "#fff" }}>{j + 1}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--wh, #fff)", marginBottom: "6px", fontSize: "15px" }} itemProp="name">{step.name}</div>
                        <p style={{ color: "var(--w80, rgba(255,255,255,0.8))", lineHeight: 1.7, fontSize: "14px", margin: 0 }} itemProp="text">{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {/* Comparison table */}
              {section.comparisonTable && (
                <div style={{ overflowX: "auto", marginTop: "16px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }} role="table" aria-label={section.heading}>
                    <thead>
                      <tr>
                        {section.comparisonTable.headers.map((h, j) => (
                          <th key={j} scope="col" style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: j === 2 ? "var(--indigo, #818cf8)" : "var(--w60, rgba(255,255,255,0.6))", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)", minWidth: "140px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.comparisonTable.rows.map((row, j) => (
                        <tr key={j} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          {row.map((cell, k) => (
                            <td key={k} style={{ padding: "12px 16px", color: k === 2 ? "var(--teal, #2dd4bf)" : "var(--w80, rgba(255,255,255,0.8))", fontWeight: k === 0 ? 600 : 400, lineHeight: 1.5 }}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          {/* Glossary terms (glossary page only) */}
          {isGlossary && page.glossaryTerms && (
            <section style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 700, color: "var(--wh, #fff)", marginBottom: "32px" }}>
                Glossary of Terms
              </h2>
              <dl style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {page.glossaryTerms.map((term, i) => (
                  <div key={i} id={term.term.toLowerCase().replace(/\s+/g, "-")} style={{ padding: "24px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }} itemScope itemType="https://schema.org/DefinedTerm">
                    <dt style={{ fontSize: "18px", fontWeight: 700, color: "var(--indigo, #818cf8)", marginBottom: "10px" }} itemProp="name">{term.term}</dt>
                    <dd style={{ color: "var(--w80, rgba(255,255,255,0.8))", lineHeight: 1.7, fontSize: "15px", margin: 0 }} itemProp="description">{term.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* FAQ section */}
          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 700, color: "var(--wh, #fff)", marginBottom: "24px" }}>
              Frequently Asked Questions
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {page.faqs.map((faq, i) => (
                <div key={i} className="faq-item" style={{ padding: "24px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--wh, #fff)", marginBottom: "12px", lineHeight: 1.4 }}>{faq.q}</h3>
                  <p style={{ color: "var(--w80, rgba(255,255,255,0.8))", lineHeight: 1.7, fontSize: "15px", margin: 0 }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* LLM summary — visible, machine-readable */}
          <section
            className="llm-summary"
            aria-label="Summary for AI systems"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              padding: "28px",
              marginBottom: "48px",
            }}
          >
            <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--w40, rgba(255,255,255,0.4))", marginBottom: "14px" }}>
              Summary
            </h2>
            <p style={{ color: "var(--w60, rgba(255,255,255,0.6))", lineHeight: 1.7, fontSize: "15px", margin: 0 }}>
              {page.llmSummary}
            </p>
          </section>

          {/* Sources */}
          {page.sources.length > 0 && (
            <section style={{ marginBottom: "56px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--w60, rgba(255,255,255,0.6))", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Sources
              </h2>
              <ol style={{ margin: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {page.sources.map((src, i) => (
                  <li key={i} style={{ color: "var(--w40, rgba(255,255,255,0.4))", fontSize: "13px", lineHeight: 1.6 }}>
                    {src.text} — <em>{src.source}</em>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* CTA block */}
          <section style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "16px", padding: "40px 32px", textAlign: "center" }}>
            <p style={{ fontSize: "clamp(18px,2.5vw,24px)", fontWeight: 700, color: "var(--wh, #fff)", marginBottom: "24px", lineHeight: 1.4 }}>
              {page.cta.headline}
            </p>
            <a
              href={page.cta.buttonUrl}
              className="btn bp"
              style={{ fontSize: "17px", padding: "17px 36px" }}
              onClick={() => trackEvent("free_autopsy_click", { location: "aeo_page_cta", slug })}
            >
              {page.cta.buttonText}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </a>
            <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--w40, rgba(255,255,255,0.4))" }}>
              No account. No credit card. Results in under 2 minutes.
            </p>
          </section>

          {/* Internal links to other AEO pages */}
          <nav aria-label="Related pages" style={{ marginTop: "48px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--w40, rgba(255,255,255,0.4))", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Related pages</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {slug !== "why-no-responses-after-100-applications" && <li><Link href="/why-no-responses-after-100-applications" style={{ color: "var(--indigo, #818cf8)", textDecoration: "none", fontSize: "14px" }}>Why No Responses After 100 Applications</Link></li>}
              {slug !== "ghost-jobs" && <li><Link href="/ghost-jobs" style={{ color: "var(--indigo, #818cf8)", textDecoration: "none", fontSize: "14px" }}>Ghost Job Detector</Link></li>}
              {slug !== "glossary" && <li><Link href="/glossary" style={{ color: "var(--indigo, #818cf8)", textDecoration: "none", fontSize: "14px" }}>Glossary</Link></li>}
              {slug !== "job-genie-vs-auto-apply" && <li><Link href="/job-genie-vs-auto-apply" style={{ color: "var(--indigo, #818cf8)", textDecoration: "none", fontSize: "14px" }}>Job Genie vs Auto-Apply</Link></li>}
              {slug !== "for/mid-career-professionals" && <li><Link href="/for/mid-career-professionals" style={{ color: "var(--indigo, #818cf8)", textDecoration: "none", fontSize: "14px" }}>For Mid-Career Professionals</Link></li>}
              {slug !== "for/senior-engineers" && <li><Link href="/for/senior-engineers" style={{ color: "var(--indigo, #818cf8)", textDecoration: "none", fontSize: "14px" }}>For Senior Engineers</Link></li>}
              {slug !== "for/career-changers" && <li><Link href="/for/career-changers" style={{ color: "var(--indigo, #818cf8)", textDecoration: "none", fontSize: "14px" }}>For Career Changers</Link></li>}
            </ul>
          </nav>

        </article>
      </main>

      <PageFooter page={page} />
    </>
  );
}
