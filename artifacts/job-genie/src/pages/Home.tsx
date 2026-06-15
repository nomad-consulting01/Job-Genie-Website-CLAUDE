import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { trackEvent, useEngagementTracking } from "../lib/analytics";
import { getExperiment } from "../lib/abtest";
import { SEO } from "../components/SEO";
import { NewsletterForm } from "../components/NewsletterForm";

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".r");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useScrollNav() {
  useEffect(() => {
    const nav = document.getElementById("nav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("solid", window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        const t0 = performance.now();
        const d = 1800;
        const tick = (now: number) => {
          const p = Math.min((now - t0) / d, 1);
          const e2 = 1 - Math.pow(1 - p, 3);
          setCount(Math.round(e2 * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.unobserve(el);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return (
    <span className="sn" ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

function LoopAnimation() {
  const [cur, setCur] = useState(0);
  const nodes = ["Apply", "Wait 2 Wks", "Hear Nothing", "Tweak 3 Lines", "Apply Again"];
  const angles = [270, 342, 54, 126, 198];

  useEffect(() => {
    const lw = document.querySelector(".lwrap");
    if (!lw) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const lo = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          interval = setInterval(() => {
            setCur((c) => (c + 1) % nodes.length);
          }, 900);
          lo.unobserve(lw);
        }
      },
      { threshold: 0.3 }
    );
    lo.observe(lw);
    return () => {
      lo.disconnect();
      clearInterval(interval);
    };
  }, [nodes.length]);

  return (
    <div className="lwrap r" role="img" aria-label="The Broken Application Loop diagram">
      <div className="ltrack" aria-hidden="true"></div>
      {nodes.map((n, i) => (
        <div
          key={n}
          className={`ln ${cur === i ? "on" : ""}`}
          style={{ transform: `translate(-50%,-50%) rotate(${angles[i]}deg) translate(130px) rotate(-${angles[i]}deg)` }}
          aria-hidden="true"
        >
          <div className="lni">{n}</div>
        </div>
      ))}
      <div className="lctr" aria-hidden="true">
        THE<br />
        BROKEN<br />
        LOOP
      </div>
      <svg
        style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "290px", height: "290px", pointerEvents: "none" }}
        viewBox="0 0 290 290"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="145" cy="145" r="125" stroke="var(--i20)" strokeWidth="1.5" strokeDasharray="6 6" />
        <circle cx="145" cy="145" r="125" stroke="var(--ind)" strokeWidth="2" strokeDasharray="40 748" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 145 145" to="360 145 145" dur="6s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

function FAQAccordion() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => {
    if (openId !== id) {
      trackEvent('faq_open', { faq_index: id, faq_question: faqs[id]?.q?.slice(0, 80) ?? '' });
    }
    setOpenId(openId === id ? null : id);
  };

  const faqs = [
    {
      q: "Why do my job applications keep going silent?",
      a: "Applications go silent for three fixable reasons. First, wrong channel — you are applying to the 30% of roles that are publicly posted and competitive, while 70–80% of the best roles are filled through specialist recruiters before they ever reach a job board. Second, ghost job exposure — approximately 31% of job board listings are already filled when you apply. Third, resume misalignment — your resume does not contain the exact keywords, seniority signals, and role-match indicators specialist recruiters search for. Job Genie's free Autopsy identifies which blocker is affecting you in under 2 minutes."
    },
    {
      q: "What is an Application Silence Score?",
      a: "An Application Silence Score is a diagnostic rating — HIGH, MEDIUM, or LOW — that quantifies exactly why your job search is losing interviews. It identifies specific blockers: channel mismatch, ghost job exposure, and resume-to-brief alignment gaps (with a role alignment score compared against the shortlist threshold). Calculated in under 2 minutes from a resume upload. No account or credit card required."
    },
    {
      q: "What is the Truth Layer resume rewrite and how is it different from other AI resume tools?",
      a: "The Truth Layer is Job Genie's specialist recruiter shortlist optimisation system — not a general resume polish. It applies 8 non-negotiable rewrite rules (proof statements over duty descriptions, keyword placement, recency weighting, seniority calibration, sector language matching, gap pre-emption, and ATS-safe formatting), runs 4 pre-delivery audits, and applies the 90-second shortlist test before any CV is delivered. Most AI resume tools optimise for ATS keywords. The Truth Layer optimises for the moment a specialist recruiter decides whether to pick up the phone."
    },
    {
      q: "What four questions does a specialist recruiter ask in the first 30 seconds?",
      a: "Every specialist recruiter evaluates a CV against four questions: (1) Does this person do the thing I am trying to fill? (2) Can I see measurable proof they have done it well? (3) Will my client believe this person is credible? (4) Can I present this in 90 seconds without having to explain it? If the answer to any of these is not clearly yes, the CV does not make the shortlist. Job Genie's Truth Layer is built to make every answer unambiguously yes before the CV leaves the platform."
    },
    {
      q: "What percentage of jobs are filled through specialist recruiters and never posted publicly?",
      a: "Research consistently shows 70–80% of the best roles — particularly senior, specialist, and high-compensation positions — are filled before they ever appear on public job boards. Candidates known to specialist recruiters experience a 5x–10x job-search efficiency advantage over cold job-board applicants, because the recruiter advocates for them directly with hiring managers. Sources: U.S. Bureau of Labor Statistics job search research; LinkedIn Talent Surveys."
    },
    {
      q: "How is Job Genie different from LinkedIn, Indeed, or resume review tools?",
      a: "Job Genie is not a job board. It is a recruiter-visibility system. Job boards show the 20–30% of available roles that are publicly posted. Job Genie accesses 300,000+ listings from 150+ specialist staffing agencies — roles that never appear on LinkedIn or Indeed. Generic resume tools polish your CV. Job Genie diagnoses why it's being filtered out, applies the Truth Layer rewrite built specifically for the specialist recruiter shortlist, validates every listing URL in real time, and delivers a Recruiter-Ready Brief alongside the rewritten CV."
    },
    {
      q: "What is a ghost job and how common are they?",
      a: "A ghost job is a listing that remains visible online but is no longer actively being filled — the position has been filled, paused, or cancelled. Research estimates approximately 31% of job board listings at any given time are ghost jobs. Job Genie's live URL validation automatically identifies and removes ghost jobs from its specialist recruiter database, so every listing shown is verified active."
    },
    {
      q: "Is Job Genie free? What does each plan include?",
      a: "Yes. The Free Autopsy includes your Application Silence Score, Recruiter-Fit Score, keyword gap analysis, and full blocker diagnosis — no account or credit card required. The Pro plan at $49/month unlocks the full 300,000+ specialist recruiter listings database, live URL validation, market demand matching, the Truth Layer resume rewrite (8 rules, 4 audits, 90-second test), the Recruiter-Ready Brief, and unlimited downloadable results. Cancel anytime."
    },
    {
      q: "What is the best resume writing service for specialist recruiter submissions?",
      a: "Job Genie's Truth Layer is specifically engineered for specialist recruiter submission — not generic ATS optimisation. It applies 8 rewrite rules, runs 4 pre-delivery audits, and applies the 90-second shortlist test before any CV is delivered. It is the only system that also produces a Recruiter-Ready Brief — a 3–5 sentence email in the recruiter's language — alongside the rewritten CV, and then matches the rewritten CV directly to 300,000+ live specialist recruiter-held listings from the hidden job market."
    }
  ];

  return (
    <div className="flist r d2" itemScope itemType="https://schema.org/FAQPage">
      {faqs.map((faq, i) => (
        <div key={i} className={`fi ${openId === i ? "op" : ""}`} itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
          <button className="fq-btn" aria-expanded={openId === i} aria-controls={`fa${i}`} itemProp="name" onClick={() => toggle(i)}>
            {faq.q}
            <span className="fic">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
          </button>
          <div className="fa" id={`fa${i}`} itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
            <p itemProp="text" dangerouslySetInnerHTML={{ __html: faq.a.replace(/(\d+%|70–80%|300,000\+|150\+|30%|31%|HIGH, MEDIUM, or LOW|90-second shortlist test|Truth Layer|Recruiter-Ready Brief|Free Autopsy|Pro plan at \$49\/month|5x–10x)/g, '<strong>$1</strong>') }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StickyBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const p = document.getElementById("price");
      if (!p) return;
      const r = p.getBoundingClientRect();
      setShow(window.scrollY > window.innerHeight * 0.8 && r.top > window.innerHeight);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`stk ${show ? "show" : ""}`} id="stk" role="complementary">
      <div className="w">
        <div className="stkr">
          <p className="stkt">
            300,000+ live recruiter roles. <strong>Most candidates never find them.</strong> Your free Autopsy shows you why — and where you fit.
          </p>
          <a
            href="https://modular-pipeline.replit.app/?upload=true"
            className="btn bp bsm"
            onClick={() => trackEvent("free_autopsy_click", { location: "sticky_bar" })}
          >
            Claim My Free Autopsy
          </a>
        </div>
      </div>
    </div>
  );
}

export function PageContent({ variant = {}, experimentId, variantId }: { variant?: any; experimentId?: string; variantId?: string }) {
  useScrollReveal();
  useScrollNav();
  useEngagementTracking({ slug: variant.slug, experimentId, variantId });

  useEffect(() => {
    trackEvent("page_view", { experiment_id: experimentId, variant_id: variantId });
  }, [experimentId, variantId]);

  useEffect(() => {
    const base = { experiment_id: experimentId, variant_id: variantId };
    const sections: Array<{ selector: string; event: string; fired: boolean }> = [
      { selector: ".tl-sect", event: "truth_layer_section_view", fired: false },
      { selector: ".dif", event: "comparison_section_view", fired: false },
    ];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const sec = sections.find(s => entry.target.matches(s.selector));
          if (sec && !sec.fired) {
            sec.fired = true;
            trackEvent(sec.event, base);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    sections.forEach(s => {
      const el = document.querySelector(s.selector);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [experimentId, variantId]);

  const headline = variant.headline || (
    <>
      <span className="t1">100 applications.</span>
      <span className="t2">0 replies.</span>
      <span className="t3">Here's exactly why.</span>
    </>
  );

  const subheadline = variant.subheadline || "70–80% of the best roles are filled before they hit job boards. Get your free Application Silence Score and find out what's blocking your interviews.";
  const eyebrow = variant.eyebrow || "APPLICATION SILENCE SCORE";
  const quote = variant.quote || "That's not bad luck — it's the wrong channel.";
  const ctaPrimary = variant.cta_primary || "Get Free Autopsy";
  const ctaSecondary = variant.cta_secondary || "See How It Works";

  return (
    <>
      <div className="band">
        <p>New: Live URL validation now active. <a href="#feat">See how we remove ghost jobs</a>.</p>
      </div>

      <nav className="nav" id="nav">
        <div className="nlogo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--inl)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Job Genie
        </div>
        <ul className="nlinks">
          <li><a href="#how">How It Works</a></li>
          <li><a href="#truth-layer">Truth Layer</a></li>
          <li><a href="#feat">Features</a></li>
          <li><a href="#price">Pricing</a></li>
          <li>
            <a href="https://modular-pipeline.replit.app/?upload=true" className="btn bg bsm" style={{ color: "var(--wh)" }} onClick={() => trackEvent("free_autopsy_click", { location: "nav" })}>
              {ctaPrimary}
            </a>
          </li>
        </ul>
      </nav>

      <section className="hero">
        <div className="hbg">
          <div className="orb o1"></div>
          <div className="orb o2"></div>
          <div className="orb o3"></div>
          <div className="hdots"></div>
        </div>
        <div className="w">
          <div className="hgrid">
            <div className="r">
              <div className="ey"><span className="ey-dot"></span>{eyebrow}</div>
              <h1 className="htitle">{typeof headline === 'string' ? headline : headline}</h1>
              <div className="pq">{quote}</div>
              <p className="hsub">{subheadline}</p>
              <div className="hact">
                <a href="https://modular-pipeline.replit.app/?upload=true" className="btn bp" onClick={() => trackEvent("hero_cta_click", { location: "hero_primary" })}>
                  {ctaPrimary}
                </a>
                <a href="#how" className="btn bg" onClick={() => trackEvent("secondary_cta_click", { location: "hero" })}>
                  {ctaSecondary}
                </a>
              </div>
              <div className="htrust">No credit card · No account · 2 minutes</div>
            </div>
            <div className="hcards r d1" aria-hidden="true">
              <div className="hc">
                <div className="clbl">Your Application Silence Score</div>
                <div className="sbig">HIGH</div>
                <div className="ssub">Role fit signal is currently <strong>too weak for recruiter submission</strong></div>
                <div className="sbw"><div className="sb"></div></div>
                <div className="bks">
                  <div className="bk"><span className="bd r"></span><div><p className="bt">Wrong channel — you're in the 30% everyone fights over</p><p className="bs">70–80% of roles never reach job boards</p></div></div>
                  <div className="bk"><span className="bd a"></span><div><p className="bt">Ghost job exposure — 31% of recent applications</p><p className="bs">Listings no longer actively being filled</p></div></div>
                  <div className="bk"><span className="bd a"></span><div><p className="bt">Resume not positioned for recruiter pitchability</p><p className="bs">Role alignment score: 44% — below shortlist threshold</p></div></div>
                </div>
                <a href="https://modular-pipeline.replit.app/?upload=true" className="btn bp" style={{ width: "100%", justifyContent: "center", marginTop: "16px", fontSize: "14px" }} onClick={() => trackEvent("free_autopsy_click", { location: "hero_card" })}>
                  Run My Free Autopsy
                </a>
              </div>
              <div className="hc mc">
                <div className="clbl">Your Closest Recruiter-Held Matches</div>
                <div className="mrow"><div><p className="mn">Business Analyst — FinTech</p><p className="mm">Remote · Never on Indeed · Specialist agency</p></div><span className="badge g">High Fit</span></div>
                <div className="mrow"><div><p className="mn">Customer Success Manager</p><p className="mm">Hybrid · Recruiter-held only · Validated live</p></div><span className="badge a">Can Fit</span></div>
                <div className="mrow"><div><p className="mn">IT Project Manager</p><p className="mm">Remote · 150K+ salary range · Active brief</p></div><span className="badge i">Close Match</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="tldr-s">
        <div className="w">
          <div className="tldr r">
            <div className="tldr-lbl">TL;DR — What Job Genie Does</div>
            <p>Job applications go silent for three fixable reasons: <strong>wrong channel</strong> (70–80% of best roles never reach job boards), <strong>ghost jobs</strong> (31% of listings are already filled), and <strong>resume misalignment</strong> (missing the exact keywords specialist recruiters search for). Job Genie calculates your free <strong>Application Silence Score</strong> in under 2 minutes — no account needed — matches you to 300,000+ live specialist recruiter listings, and rewrites your resume using the <strong>Truth Layer</strong> — an 8-rule system built specifically for the specialist recruiter shortlist.</p>
          </div>
        </div>
      </div>

      <div className="div" aria-hidden="true"></div>

      <section className="intr" aria-labelledby="ih">
        <div className="w">
          <div className="intr-in r">
            <p className="ob">"I just need to apply to more jobs."</p>
            <h2 className="nb disp" id="ih">No. You need to stop applying<br />to jobs that <span className="ac">never had you in mind.</span></h2>
            <p className="isub">The 70–80% of the market that specialist recruiters control never appears on job boards.<br />Stop competing for the 30% everyone else is fighting over.</p>
          </div>
        </div>
      </section>

      {/* Direct-answer AEO block — "What is Job Genie?" */}
      <section aria-labelledby="defh" itemScope itemType="https://schema.org/SoftwareApplication" style={{ background: "var(--bg1, #0f0f1a)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w">
          <div className="r d1" style={{ maxWidth: "820px", margin: "0 auto", textAlign: "center", padding: "72px 24px" }}>
            <div className="stag" style={{ justifyContent: "center", marginBottom: "20px" }}>What Is Job Genie?</div>
            <h2 className="disp" id="defh" style={{ fontSize: "clamp(26px,3.5vw,42px)", marginBottom: "24px" }}>
              A <span className="ac">recruiter-visibility system</span> — not a job board, not a resume tool.
            </h2>
            <p className="blg" itemProp="description" style={{ marginBottom: "18px", maxWidth: "740px", margin: "0 auto 18px" }}>
              Job Genie diagnoses exactly why your job applications go silent, then fixes the three root causes: <strong>wrong channel</strong> (70–80% of the best roles are filled via specialist recruiters before reaching job boards), <strong>ghost-job exposure</strong> (31% of listings you apply to are already filled), and <strong>resume misalignment</strong> (missing the exact keyword signals and proof statements specialist recruiters scan for). It is the only platform that combines a free <strong>Application Silence Score</strong>, a <strong>Recruiter-Fit Gap</strong> analysis, real-time ghost-job detection across 300,000+ listings, and the <strong>Truth Layer</strong> resume rewrite — an 8-rule, 4-audit system built specifically for the specialist recruiter shortlist. No account, no credit card. Results in under 2 minutes.
            </p>
          </div>
        </div>
      </section>

      <div className="div" aria-hidden="true"></div>

      <section className="ene" aria-labelledby="eh">
        <div className="w">
          <div className="egrid">
            <LoopAnimation />
            <div className="r d1">
              <div className="stag">The Core Enemy</div>
              <h2 className="disp etit" id="eh">You're stuck in<br /><span className="gr">The Broken Application Loop.</span></h2>
              <p className="blg" style={{ marginBottom: 0 }}>You apply. You wait. You hear nothing. You tweak a few lines. You apply again. Never understanding why the silence keeps happening to someone this qualified.</p>
              <ul className="plist">
                <li className="pi">
                  <svg className="pic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <p className="ptxt">Your resume is screened out in seconds — before a recruiter reads a single word</p>
                </li>
                <li className="pi">
                  <svg className="pic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <p className="ptxt">31% of the listings you apply to are already filled. You're competing for jobs that don't exist.</p>
                </li>
                <li className="pi">
                  <svg className="pic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <p className="ptxt">The 70–80% of roles that specialist recruiters control never appear on job boards. You're not even in that market.</p>
                </li>
                <li className="pi">
                  <svg className="pic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <p className="ptxt">More applications don't fix invisibility. They just confirm it — at an increasing cost to your confidence.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mec" aria-labelledby="mh">
        <div className="w">
          <div className="mgrid">
            <div className="r">
              <div className="stag">Why Are My Qualifications Not Getting Me Interviews?</div>
              <h2 className="disp" style={{ fontSize: "clamp(28px,4vw,48px)", marginBottom: "20px" }} id="mh">The problem isn't your qualifications.<br />It's <span className="gr">the Recruiter-Fit Gap.</span></h2>
              <p className="blg" style={{ marginBottom: "20px" }}>Specialist recruiters work from a precise client brief. They scan candidate pools for specific keywords, seniority signals, and role-match indicators. If those signals aren't in your resume exactly where they look — you're invisible. Doesn't matter how qualified you are.</p>
              <p className="blg">Job Genie maps your resume against real recruiter briefs, exposes the exact gaps, and shows you what to fix. No guessing. No generic advice. Just the signal that matters.</p>
            </div>
            <div className="gv r d1" role="img" aria-label="Recruiter-Fit Gap visual showing what you show versus what recruiters need">
              <div className="gcols">
                <div><div className="gch l">What You Show</div></div>
                <div><div className="gch rg">What Recruiters Need</div></div>
              </div>
              <div className="gpairs">
                <div className="gpair"><div className="gc n">Project leadership</div><div className="gc m">PMO governance</div></div>
                <div className="gpair"><div className="gc n">Team management</div><div className="gc m">Change management</div></div>
                <div className="gpair"><div className="gc n">Results-driven</div><div className="gc x">Risk Register ✗</div></div>
                <div className="gpair"><div className="gc n">Cross-functional</div><div className="gc x">RAID log ✗</div></div>
                <div className="gpair"><div className="gc n">Stakeholder comms</div><div className="gc x">Executive reporting ✗</div></div>
              </div>
              <div className="gdiv"></div>
              <div className="gres"><span className="grl">Current Fit Score</span><span className="grv">74% → Fix 3 gaps → 88%+</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="how" id="how" aria-labelledby="hwh">
        <div className="w">
          <div className="hwhd">
            <div className="stag" style={{ justifyContent: "center" }}>How Does Job Genie Work?</div>
            <h2 className="disp hwtit r" id="hwh">Stop guessing. See the problem.<br /><span className="gr">Fix what matters.</span></h2>
            <p className="blg r d1" style={{ maxWidth: "540px", margin: "0 auto" }}>In under 2 minutes, Job Genie tells you exactly why your applications are going silent — and shows you the recruiter-held roles where you actually fit.</p>
          </div>
          <div className="steps">
            <div className="stp r">
              <div className="stn">Step 01</div>
              <div className="stic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg></div>
              <div className="sttl">Upload Your Resume</div>
              <p className="stb">PDF, Word, or plain text. No account needed. The AI extracts your experience, target role, and current signal immediately.</p>
            </div>
            <div className="stp r d1">
              <div className="stn">Step 02</div>
              <div className="stic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg></div>
              <div className="sttl">See Your Silence Score</div>
              <p className="stb">Get your Application Silence Score — HIGH, MEDIUM, or LOW — the exact blockers draining your interviews, your Recruiter-Fit percentage, and the keywords you're missing.</p>
            </div>
            <div className="stp r d2">
              <div className="stn">Step 03</div>
              <div className="stic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></div>
              <div className="sttl">Access Live Recruiter Roles</div>
              <p className="stb">300,000+ live roles from 150+ specialist agencies. Every URL validated in real time. Stop applying into the void. Start landing calls.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="tl-sect" id="truth-layer" aria-labelledby="tlh">
        <div className="w">
          <div className="stag">The Truth Layer — Specialist Recruiter Shortlist Optimisation</div>
          <h2 className="disp r" style={{ fontSize: "clamp(28px,4vw,48px)", marginBottom: "16px" }} id="tlh">Your resume is failing<br />the <span className="gt">90-second shortlist test.</span></h2>
          <p className="blg r d1" style={{ maxWidth: "680px", marginBottom: 0 }}>Every specialist recruiter stakes their professional reputation on every candidate they submit. They will only present someone whose CV gives them specific, verifiable evidence to defend in a client call. The Truth Layer is Job Genie's 8-rule, 4-audit system that rebuilds your resume as that evidence case.</p>

          <div className="ninety r d2">
            <div className="ninety-h">⏱ The 90-Second Shortlist Test — run on every Truth Layer rewrite</div>
            <p>Before delivering any rewrite, Job Genie reads your CV cold — as a specialist recruiter who has never met you — and verifies four things in 90 seconds. <strong>If any answer is unclear, the CV is revised before delivery.</strong></p>
          </div>

          <div className="tl-grid">
            <div>
              <div className="four-q r">
                <div className="fq"><div className="fq-n">01</div><div className="fq-q">Does this person do the thing I am trying to fill?</div><div className="fq-a">Target job title must appear in summary exactly as a recruiter would search for it.</div></div>
                <div className="fq"><div className="fq-n">02</div><div className="fq-q">Can I see measurable proof they have done it well?</div><div className="fq-a">Every bullet must be a proof statement — numbers, named outputs, or competitive context.</div></div>
                <div className="fq"><div className="fq-n">03</div><div className="fq-q">Will my client believe this person is credible?</div><div className="fq-a">Seniority signal, sector language, and proof hierarchy must be unambiguous.</div></div>
                <div className="fq"><div className="fq-n">04</div><div className="fq-q">Can I present this in 90 seconds without explaining it?</div><div className="fq-a">All gaps and transitions pre-empted inside the document. Guessing defaults to negative.</div></div>
              </div>
              <div style={{ background: "rgba(45,212,191,.06)", border: "1px solid rgba(45,212,191,.2)", borderLeft: "4px solid var(--teal)", borderRadius: "0 var(--rmd) var(--rmd) 0", padding: "16px 20px", marginTop: "16px", fontSize: "14px", color: "var(--w80)" }}>
                <strong style={{ color: "var(--teal)" }}>TL;DR:</strong> Emotional language is invisible to the shortlist decision. Proof is not. The Truth Layer converts your CV from a self-description into a recruiter-presentable evidence case.
              </div>
            </div>
            <div className="rules-grid r d1">
              <div className="rule"><div className="rule-n">Rule 01</div><div className="rule-t">Summary = recruiter brief, not intro</div><div className="rule-b">Formula: [Function] + [Years] + [Sector] + [Proof point] + [Target signal].</div><div className="pc-w"><div className="pc-lbl w">✗ Before</div>"Passionate results-driven professional seeking new challenges."</div><div className="pc-r"><div className="pc-lbl g">✓ After</div>"B2B demand gen lead, 8yrs SaaS. Scaled inbound to £4.2M pipeline. CAC –34%."</div></div>
              <div className="rule"><div className="rule-n">Rule 02</div><div className="rule-t">Every bullet = proof statement</div><div className="rule-b">Formula: [Action verb] + [Scope] + [Measurable outcome] + [Timeframe].</div><div className="pc-w"><div className="pc-lbl w">✗ Before</div>"Responsible for managing the sales team."</div><div className="pc-r"><div className="pc-lbl g">✓ After</div>"Led 7 AEs, grew ARR from £2.1M to £5.8M in 24 months — 176% of target."</div></div>
              <div className="rule"><div className="rule-n">Rule 03</div><div className="rule-t">Keywords in top third</div><div className="rule-b">Recruiters run Boolean searches before they read. If buried on p.2, you don't surface.</div><div className="pc-w"><div className="pc-lbl w">✗ Before</div>"Experienced in cloud infrastructure."</div><div className="pc-r"><div className="pc-lbl g">✓ After</div>"AWS, Azure, Terraform, Kubernetes — enterprise production."</div></div>
              <div className="rule"><div className="rule-n">Rule 04</div><div className="rule-t">Recency = 60% of shortlist weight</div><div className="rule-b">Most recent role is the most detailed and evidence-rich. Older roles compress progressively.</div></div>
              <div className="rule"><div className="rule-n">Rule 05</div><div className="rule-t">Unambiguous seniority signal</div><div className="rule-b">A CV readable as two levels gets passed over. Managers state team size + budget. Always.</div></div>
              <div className="rule"><div className="rule-n">Rule 06</div><div className="rule-t">Sector language must match</div><div className="rule-b">Wrong dialect signals outsider. Career changers name the transfer in summary — explicitly.</div></div>
              <div className="rule"><div className="rule-n">Rule 07</div><div className="rule-t">Gaps pre-empted inside the CV</div><div className="rule-b">A recruiter who has to explain something to their client will not submit that candidate.</div></div>
              <div className="rule"><div className="rule-n">Rule 08</div><div className="rule-t">Format = recruiter tool, not design</div><div className="rule-b">ATS-safe. No tables or multi-column. 2 pages max. Dates consistent. PDF for humans.</div></div>
            </div>
          </div>
          <div className="r d2" style={{ textAlign: "center", marginTop: "52px" }}>
            <a href="https://modular-pipeline.replit.app/?option=9" className="btn bp" style={{ fontSize: "16px", padding: "17px 34px" }} onClick={() => trackEvent("truth_layer_cta_click")}>Apply the Truth Layer to My Resume</a>
            <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--w40)" }}>Available on Pro plan — free Autopsy included for all users</p>
          </div>
        </div>
      </section>

      <section className="buls" aria-labelledby="blh">
        <div className="w">
          <div className="bulhd">
            <div className="stag" style={{ justifyContent: "center" }}>Your Free Autopsy Reveals</div>
            <h2 className="disp bultit r" id="blh">What most candidates never find out<br /><span className="gr">until it's too late.</span></h2>
            <p className="blg r d1" style={{ maxWidth: "520px", margin: "0 auto" }}>Six things your current job search is hiding from you. Every one is fixable — once you can see it.</p>
          </div>
          <div className="bulgrid r d2">
            <div className="buli"><span className="buln">01</span><p className="bult">The invisible filter that eliminates your resume before a recruiter reads a single word of it</p></div>
            <div className="buli"><span className="buln">02</span><p className="bult">Why applying more is actually making you less visible — and the single move that changes that</p></div>
            <div className="buli"><span className="buln">03</span><p className="bult">The exact keywords specialist recruiters search for in your role — and the critical ones your resume is missing</p></div>
            <div className="buli"><span className="buln">04</span><p className="bult">Which channel holds 70–80% of the opportunities that match your experience — and why you're not in it yet</p></div>
            <div className="buli"><span className="buln">05</span><p className="bult">Your Application Silence Score — and the specific blockers leaking your interview rate right now</p></div>
            <div className="buli"><span className="buln">06</span><p className="bult">The 3 gaps between your resume and the recruiter's brief — and the exact language that closes each one</p></div>
          </div>
          <div className="r d3" style={{ textAlign: "center", marginTop: "52px" }}>
            <a href="https://modular-pipeline.replit.app/?upload=true" className="btn bp" style={{ fontSize: "17px", padding: "17px 34px" }} onClick={() => trackEvent("free_autopsy_click", { location: "bullets" })}>
              Get My Free Autopsy — See All Six
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </a>
            <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--w40)" }}>No account. No credit card. 2 minutes.</p>
          </div>
        </div>
      </section>

      <section className="feat" id="feat" aria-labelledby="feath">
        <div className="w">
          <div className="feathd">
            <div className="stag" style={{ justifyContent: "center" }}>What Job Genie Does</div>
            <h2 className="disp feattit r" id="feath">Everything you need to<br /><span className="gr">stop being invisible.</span></h2>
            <p className="blg r d1" style={{ maxWidth: "500px", margin: "0 auto" }}>Ten intelligence tools built for one purpose: getting you in front of the right recruiters with the right signal.</p>
          </div>
          <div className="bento">
            <div className="bc b7 r">
              <div className="btag"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>Resume Analysis</div>
              <h3 className="bctit">Recruiter-Fit Resume Score</h3>
              <p className="bcb">Upload your resume and get a precise fit score against your target role. Strengths, gaps, missing recruiter keywords, and specific recommendations — based only on your real experience.</p>
              <div className="bprev">
                <table className="mx" aria-label="Before and after Recruiter-Fit scores">
                  <thead><tr><th>Signal</th><th>Before</th><th></th><th>After Truth Layer</th></tr></thead>
                  <tbody>
                    <tr><td>Role Alignment</td><td className="bad">2/5</td><td className="arr">→</td><td className="good">5/5</td></tr>
                    <tr><td>Keyword Density</td><td className="bad">2/5</td><td className="arr">→</td><td className="good">5/5</td></tr>
                    <tr><td>Evidence of Results</td><td className="bad">1/5</td><td className="arr">→</td><td className="good">4/5</td></tr>
                    <tr><td>Seniority Signal</td><td className="bad">3/5</td><td className="arr">→</td><td className="good">5/5</td></tr>
                    <tr><td>Presentability</td><td className="bad">2/5</td><td className="arr">→</td><td className="good">5/5</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bc b5 r d1">
              <div className="btag"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>Live Job Match</div>
              <h3 className="bctit">Validated Recruiter Listings</h3>
              <p className="bcb">300,000+ live roles from 150+ specialist agencies. Every URL validated in real time — filled positions automatically removed. No dead listings.</p>
              <ul className="bcl">
                <li className="bcli">Profile-driven search across specialist firms</li>
                <li className="bcli">Live URL validation removes 10–40% of dead listings</li>
                <li className="bcli">50, 100, or 200 validated results per search</li>
                <li className="bcli">Export to Excel for application tracking</li>
              </ul>
            </div>
            <div className="bc b5 r">
              <div className="btag"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>Market Intelligence</div>
              <h3 className="bctit">Market Demand Matching</h3>
              <p className="bcb">Cross-reference live market demand data against actual recruiter vacancy counts. Know which roles have both high demand and active recruiters filling them right now.</p>
              <ul className="bcl">
                <li className="bcli">Top 20 in-demand tech &amp; non-tech roles</li>
                <li className="bcli">Matched against 300K+ recruiter listings</li>
                <li className="bcli">Filter: remote, contract, city, full-time</li>
                <li className="bcli">60+ matched role categories</li>
              </ul>
            </div>
            <div className="bc b7 r d1">
              <div className="btag"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>Tailoring Engine</div>
              <h3 className="bctit">Tailor to a Real Recruiter Brief</h3>
              <p className="bcb">Paste any recruiter listing URL. Job Genie compares your resume against that specific brief and produces targeted recommendations — or a full Truth Layer rewrite. The actual words that recruiter is screening for.</p>
              <ul className="bcl">
                <li className="bcli">Tailoring recommendations you apply yourself (Option 8)</li>
                <li className="bcli">Full Truth Layer rewrite, shortlist-ready (Option 9)</li>
                <li className="bcli">Only recommends changes based on your real experience</li>
                <li className="bcli">Mirrors the recruiter's language and brief structure</li>
              </ul>
              <div className="bprev"><div className="bsr"><div><div className="bsn">Option 8</div><div className="bsl">Tailoring tips</div></div><div><div className="bsn">Option 9</div><div className="bsl">Truth Layer rewrite</div></div><div><div className="bsn">&lt;10 min</div><div className="bsl">Average time</div></div></div></div>
            </div>
            <div className="bc b5 r tl-bc">
              <div className="btag teal"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>Truth Layer</div>
              <h3 className="bctit">Recruiter-Ready Brief</h3>
              <p className="bcb">Delivered alongside every Truth Layer rewrite — a 3–5 sentence email in the recruiter's language that seeds the submission relationship before the recruiter opens the file.</p>
              <ul className="bcl">
                <li className="bcli teal">Written in the recruiter's language, not yours</li>
                <li className="bcli teal">Sets the frame before the CV is opened</li>
                <li className="bcli teal">Turns a cold submission into a warm introduction</li>
                <li className="bcli teal">Exclusive to Pro plan Truth Layer rewrite</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="prf" aria-labelledby="prfh">
        <div className="w">
          <div className="prfhd">
            <div className="stag" style={{ justifyContent: "center" }}>What Makes Specialist Recruiter Listings Different From Job Boards?</div>
            <h2 className="disp prftit r" id="prfh">Built on specialist<br /><span className="gr">recruiter intelligence.</span></h2>
            <p className="blg r d1" style={{ maxWidth: "520px", margin: "0 auto" }}>Not general job boards. Not employer ATS. Specialist recruitment agencies that actively place candidates — and get paid only when you get hired.</p>
          </div>
          <div className="sgrid">
            <div className="sc r"><AnimatedCounter target={300} suffix="K+" /><div className="sl">Live specialist recruiter listings — validated daily</div></div>
            <div className="sc r d1"><AnimatedCounter target={150} suffix="+" /><div className="sl">Specialist staffing agencies in the database</div></div>
            <div className="sc r d2"><AnimatedCounter target={31} suffix="%" /><div className="sl">Of job board listings are filled "ghost jobs"</div></div>
            <div className="sc r d3"><AnimatedCounter target={75} suffix="%" /><div className="sl">Of specialist roles never appear on job boards</div></div>
          </div>
          <div className="firms r">
            <div className="flbl">Specialist Staffing Firms in the Database</div>
            <div className="frow">
              <span className="fp ft">Kforce</span><span className="fp ft">Randstad</span><span className="fp ft">Robert Half</span><span className="fp ft">TEKsystems</span><span className="fp ft">Collabera</span>
              <span className="fp">Insight Global</span><span className="fp">Apex Group</span><span className="fp">CyberCoders</span><span className="fp">Modis</span><span className="fp">Hays</span><span className="fp">Michael Baker</span><span className="fp">Adecco</span>
              <span className="fp" style={{ color: "var(--w20)" }}>+145 more</span>
            </div>
          </div>
        </div>
      </section>

      {/* Glossary section — AEO definitions for key terms */}
      <section aria-labelledby="glossh" style={{ padding: "80px 0", background: "var(--bg1, #0f0f1a)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w">
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <div className="stag" style={{ justifyContent: "center", marginBottom: "16px" }}>Glossary</div>
            <h2 className="disp" id="glossh" style={{ fontSize: "clamp(26px,3.5vw,42px)", marginBottom: "16px" }}>Key terms — <span className="ac">what they mean</span></h2>
            <p className="blg r d1" style={{ maxWidth: "520px", margin: "0 auto", color: "var(--w60, rgba(255,255,255,0.6))" }}>The concepts behind why applications go silent — and how Job Genie fixes each one.</p>
          </div>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "32px", maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "32px", border: "1px solid rgba(255,255,255,0.08)" }} itemScope itemType="https://schema.org/DefinedTerm">
              <dt style={{ fontSize: "18px", fontWeight: 700, color: "var(--indigo, #818cf8)", marginBottom: "12px" }} itemProp="name">Application Silence Score</dt>
              <dd style={{ color: "var(--w80, rgba(255,255,255,0.8))", lineHeight: 1.7, margin: 0 }} itemProp="description">A diagnostic rating — HIGH, MEDIUM, or LOW — that quantifies exactly why your job applications are generating silence instead of interviews. It measures three blockers: <strong>channel mismatch</strong> (applying through job boards that miss 70–80% of the market), <strong>ghost-job exposure</strong> (listings already filled at the time of application), and <strong>resume-to-brief alignment</strong> (the keywords and proof signals specialist recruiters actually scan for). Calculated in under 2 minutes from a resume upload — no account required.</dd>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "32px", border: "1px solid rgba(255,255,255,0.08)" }} itemScope itemType="https://schema.org/DefinedTerm">
              <dt style={{ fontSize: "18px", fontWeight: 700, color: "var(--teal, #2dd4bf)", marginBottom: "12px" }} itemProp="name">Recruiter-Fit Gap</dt>
              <dd style={{ color: "var(--w80, rgba(255,255,255,0.8))", lineHeight: 1.7, margin: 0 }} itemProp="description">The measurable distance between what your resume currently signals and what a specialist recruiter's client brief requires. Specialist recruiters evaluate every candidate against four questions: Does this person do the specific thing I need to fill? Is there measurable proof they have done it well? Will my client believe this person is credible? Can I present this in 90 seconds without having to explain it? A Recruiter-Fit Gap score identifies exactly which keywords, proof statements, seniority signals, and sector-language markers are absent from your resume — and why you're being filtered out in favour of candidates who answer all four questions unambiguously.</dd>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "32px", border: "1px solid rgba(255,255,255,0.08)" }} itemScope itemType="https://schema.org/DefinedTerm">
              <dt style={{ fontSize: "18px", fontWeight: 700, color: "var(--amber, #f59e0b)", marginBottom: "12px" }} itemProp="name">Truth Layer</dt>
              <dd style={{ color: "var(--w80, rgba(255,255,255,0.8))", lineHeight: 1.7, margin: 0 }} itemProp="description">Job Genie's 8-rule, 4-audit resume rewrite system built specifically for the specialist recruiter shortlist — not generic ATS keyword optimisation. The 8 rewrite rules cover: proof statements over duty descriptions, keyword placement, recency weighting, seniority calibration, sector language, gap pre-emption, ATS-safe formatting, and recruiter readability. The 4 audits verify role alignment, evidence density, seniority signal, and the 90-second shortlist test before any rewritten CV is delivered. Every Truth Layer rewrite also includes a <strong>Recruiter-Ready Brief</strong> — a 3–5 sentence pitch email written in the specialist recruiter's language — so the recruiter can advocate for you in their client call immediately.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="dif" aria-labelledby="difh">
        <div className="w">
          <div className="difhd">
            <div className="stag" style={{ justifyContent: "center" }}>How Is Job Genie Different From LinkedIn, Indeed, ZipRecruiter, and Resume Writers?</div>
            <h2 className="disp diftit r" id="difh">This is not another<br /><span className="gr">resume tool.</span></h2>
            <p className="blg r d1" style={{ maxWidth: "520px", margin: "0 auto" }}>Job Genie is a recruiter-visibility system. Everything else polishes your CV for the 30% of the market everyone can see. This shows you why you're invisible to the 70–80% — then fixes it.</p>
          </div>
          <div className="tw r" style={{ overflowX: "auto" }}>
            <table className="dt" role="table" aria-label="Job Genie vs LinkedIn vs Indeed vs ZipRecruiter vs Resume Writers — 7-criteria comparison matrix">
              <thead>
                <tr>
                  <th scope="col" style={{ minWidth: "220px" }}>Capability</th>
                  <th scope="col" className="hl" style={{ minWidth: "160px" }}>Job Genie</th>
                  <th scope="col" style={{ minWidth: "120px" }}>LinkedIn</th>
                  <th scope="col" style={{ minWidth: "120px" }}>Indeed</th>
                  <th scope="col" style={{ minWidth: "120px" }}>ZipRecruiter</th>
                  <th scope="col" style={{ minWidth: "140px" }}>Resume Writers</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Hidden job market access (specialist recruiter listings)</td>
                  <td className="hc2 ck">✓ 300,000+ exclusive listings</td>
                  <td style={{ color: "var(--amber)", fontWeight: 600 }}>~ Premium, very limited</td>
                  <td className="cx">✗ Public boards only</td>
                  <td className="cx">✗ Public boards only</td>
                  <td className="cx">✗ Not applicable</td>
                </tr>
                <tr>
                  <td>Live ghost-job validation (removes filled listings)</td>
                  <td className="hc2 ck">✓ Real-time, every listing</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗ ~31% ghost-job rate</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                </tr>
                <tr>
                  <td>Application Silence Score + blocker diagnosis</td>
                  <td className="hc2 ck">✓ Precise, instant</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                </tr>
                <tr>
                  <td>Resume rewrite for specialist recruiter shortlist</td>
                  <td className="hc2 ck">✓ Truth Layer — 8 rules, 4 audits</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                  <td style={{ color: "var(--amber)", fontWeight: 600 }}>~ Generic polish, no shortlist audit</td>
                </tr>
                <tr>
                  <td>Recruiter-Fit Gap analysis</td>
                  <td className="hc2 ck">✓ Precise, keyword-level</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                </tr>
                <tr>
                  <td>Recruiter-Ready Brief (pitch email for recruiter)</td>
                  <td className="hc2 ck">✓ Included with every rewrite</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                  <td className="cx">✗</td>
                  <td style={{ color: "var(--amber)", fontWeight: 600 }}>~ Optional, extra cost</td>
                </tr>
                <tr>
                  <td>Free diagnostic — no account, no credit card</td>
                  <td className="hc2 ck">✓ Instant, results in 2 minutes</td>
                  <td className="cx">✗ Account required</td>
                  <td className="cx">✗ Account required</td>
                  <td className="cx">✗ Account required</td>
                  <td className="cx">✗ Paid service upfront</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: "11px", color: "var(--w40)", marginTop: "16px", fontStyle: "italic", textAlign: "center" }}>Last updated: June 2026 · Benchmarks: SHRM, Jobvite, LinkedIn Talent Solutions, U.S. BLS, Glassdoor Recruiting Trends</p>
        </div>
      </section>

      <section className="faq" id="faq" aria-labelledby="faqh">
        <div className="w">
          <div className="faqhd">
            <div className="stag" style={{ justifyContent: "center" }}>Frequently Asked Questions</div>
            <h2 className="disp faqtit r" id="faqh">Questions job seekers ask<br /><span className="gr">about why applications go silent.</span></h2>
            <p className="blg r d1" style={{ maxWidth: "520px", margin: "0 auto" }}>The answers most candidates only find out after months of silence. Now in one place.</p>
            <p style={{ fontSize: "11px", color: "var(--w40)", marginTop: "12px", fontStyle: "italic" }}>Last updated: June 2026 · Benchmarks: SHRM, Jobvite, LinkedIn Talent Solutions, U.S. BLS</p>
          </div>
          <FAQAccordion />
          <div className="r d3" style={{ textAlign: "center", marginTop: "48px" }}>
            <a href="https://modular-pipeline.replit.app/?upload=true" className="btn bp" style={{ fontSize: "16px", padding: "16px 32px" }} onClick={() => trackEvent("free_autopsy_click", { location: "faq" })}>
              Get My Free Application Autopsy
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </a>
          </div>
        </div>
      </section>

      <section className="pri" id="price" aria-labelledby="prih">
        <div className="w">
          <div className="prihd">
            <div className="stag" style={{ justifyContent: "center" }}>How Much Does Job Genie Cost?</div>
            <h2 className="disp pritic r" id="prih">Start free. See the problem<br /><span className="gr">before you commit.</span></h2>
            <p className="blg r d1" style={{ maxWidth: "480px", margin: "0 auto" }}>No account required. See your Silence Score immediately. Upgrade only when you're ready for the full database, Truth Layer rewrite, and Recruiter-Ready Brief.</p>
          </div>
          <div className="pgrid">
            <div className="pc r">
              <div className="ptier">Free Autopsy</div>
              <div className="ppr">$0</div>
              <div className="psub">No credit card · No account · Instant results</div>
              <p className="pdesc">See exactly why your applications are going silent. Get your Silence Score, top blockers, and keyword gaps in 2 minutes.</p>
              <div className="pdiv"></div>
              <ul className="pfl">
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>Resume upload &amp; signal extraction</li>
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>Application Silence Score + blocker diagnosis</li>
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>Recruiter-Fit Score + keyword gap analysis</li>
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>Job market trends &amp; demand signals</li>
                <li className="pf"><svg className="pfico off" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg><span style={{ opacity: .4 }}>300K+ live recruiter listings</span></li>
                <li className="pf"><svg className="pfico off" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg><span style={{ opacity: .4 }}>Truth Layer resume rewrite</span></li>
                <li className="pf"><svg className="pfico off" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg><span style={{ opacity: .4 }}>Recruiter-Ready Brief</span></li>
              </ul>
              <a href="https://modular-pipeline.replit.app/?upload=true" className="btn bg" style={{ width: "100%", justifyContent: "center" }} onClick={() => { trackEvent("free_autopsy_click", { location: "pricing_free" }); trackEvent("pricing_cta_click", { location: "pricing_free" }); }}>Claim My Free Autopsy</a>
            </div>
            <div className="pc ft r d1">
              <div className="pbg">Most Popular</div>
              <div className="ptier">Pro</div>
              <div className="ppr"><sup>$</sup>49</div>
              <div className="psub">per month · Cancel anytime · No lock-in</div>
              <p className="pdesc">Full recruiter-visibility intelligence. The complete database, Truth Layer rewrite, Recruiter-Ready Brief, and validated job matching — all unlocked.</p>
              <div className="pdiv"></div>
              <ul className="pfl">
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>Everything in Free Autopsy</li>
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>300,000+ specialist recruiter listings</li>
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>Live URL validation — only active listings shown</li>
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>Market demand vs recruiter vacancy matching</li>
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg><strong style={{ color: "var(--wh)" }}>Truth Layer resume rewrite</strong> — 8 rules applied</li>
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg><strong style={{ color: "var(--wh)" }}>Recruiter-Ready Brief</strong> — with every rewrite</li>
                <li className="pf"><svg className="pfico on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>Unlimited Excel, CSV &amp; Word downloads</li>
              </ul>
              <a href="https://bit.ly/3PqDSBv" className="btn bp" style={{ width: "100%", justifyContent: "center" }} onClick={() => trackEvent("pricing_cta_click", { location: "pricing_pro" })}>Get Full Autopsy — Go Pro</a>
            </div>
          </div>
        </div>
      </section>

      <section className="cta" aria-labelledby="ctah">
        <div className="w">
          <div className="ctain">
            <div className="ey al r" style={{ justifyContent: "center", marginBottom: "28px" }}><span className="ey-dot"></span>The brutal truth</div>
            <h2 className="disp ctatit r d1" id="ctah">Most candidates aren't getting ignored<br />because they're unqualified.<br /><span className="gr">They're getting ignored because a recruiter<br />can't pitch them in 90 seconds.</span></h2>
            <p className="blg r d2" style={{ maxWidth: "540px", margin: "0 auto 40px" }}>Silence is not random. It is a signal — one you can read, fix, and reverse. The candidates landing calls right now did one thing differently: they stopped guessing.</p>
            <div className="r d3" style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap", flexDirection: "column", alignItems: "center" }}>
              <a href="https://modular-pipeline.replit.app/?upload=true" className="btn bp" style={{ fontSize: "18px", padding: "18px 36px" }} onClick={() => trackEvent("free_autopsy_click", { location: "final_cta" })}>
                Claim My Free Autopsy — See What's Blocking You
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </a>
              <div className="mt-8 w-full max-w-sm">
                <p className="text-sm text-zinc-400 mb-2">Or join our newsletter for weekly recruiter insights:</p>
                <NewsletterForm />
              </div>
            </div>
            <p className="ctaps r d4"><strong>No account. No credit card.</strong> Takes 2 minutes. Results are immediate.<br /><br />P.S. — Right now, 300,000+ specialist recruiter roles are live and 70% of them will never appear on a job board. Your free Autopsy is the fastest way to know which ones you actually have a shot at — and exactly why the Truth Layer will make you pitchable for them.</p>
          </div>
        </div>
      </section>

      <footer className="foot" role="contentinfo">
        <div className="w">
          <div className="footi">
            <div className="footl">
              <div style={{ background: "var(--inl)", width: "40px", height: "40px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--nn)" }}>
                 <svg viewBox="0 0 24 24" fill="none" width="24" height="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </div>
              <span style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: "16px" }}>JobGenie</span>
            </div>
            <nav className="footlk" aria-label="Footer navigation">
              <a href="#how">How It Works</a>
              <a href="#truth-layer">Truth Layer</a>
              <a href="#feat">Features</a>
              <a href="#faq">FAQ</a>
              <a href="#price">Pricing</a>
              <a href="https://job-genie.ai/" target="_blank" rel="noopener noreferrer">Launch App</a>
            </nav>
            <p className="footc">© 2026 Job-Genie.ai · Recruiter Visibility Intelligence · Not a job board · <time dateTime="2026-06-01">Updated June 2026</time></p>
          </div>
        </div>
      </footer>

      <StickyBar />
    </>
  );
}

export default function Home() {
  // Synchronous A/B assignment — reads localStorage before first render, zero flicker
  const exp = getExperiment("home_headline_test");
  const overrides = (exp?.overrides ?? {}) as Record<string, string>;
  const variant: Record<string, unknown> = overrides.headline_line1
    ? {
        ...overrides,
        headline: (
          <>
            <span className="t1">{overrides.headline_line1}</span>
            <span className="t2">{overrides.headline_line2}</span>
            <span className="t3">{overrides.headline_line3}</span>
          </>
        ),
      }
    : overrides;

  return (
    <>
      <SEO
        title="Why Your Job Applications Go Silent | Free Application Autopsy | Job Genie"
        description="Why do job applications go silent? Job Genie reveals your Application Silence Score, diagnoses your Recruiter-Fit Gap, and matches you to 300,000+ specialist recruiter listings in under 2 minutes — free, no account needed."
        url="https://job-genie.ai/"
        canonicalUrl="https://job-genie.ai/"
        pageType="home"
        aeoQuestion="Why do my job applications keep going silent?"
      />
      <PageContent variant={variant} experimentId="home_headline_test" variantId={exp?.id} />
    </>
  );
}
