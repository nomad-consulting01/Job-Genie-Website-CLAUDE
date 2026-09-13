import { useEffect, useRef, useState, type FormEvent } from "react";
import "./_group.css";

const REPLIES = [7, 19, 34, 58, 71, 88];

function MockForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim()) setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="optin optin-success" role="status">
        Check your inbox for your free Autopsy.
      </div>
    );
  }

  return (
    <form className="optin" onSubmit={handleSubmit}>
      <div className="optin-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          aria-label="Email address"
          required
        />
        <button className="btn-ap" type="submit">
          Get my free Autopsy →
        </button>
      </div>
      <div className="micro">
        <span><i className="dot" />Free · no card</span>
        <span><i className="dot" />Unsubscribe anytime</span>
      </div>
    </form>
  );
}

function ApplicationGrid() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];

    for (let i = 0; i < 100; i += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      grid.appendChild(cell);
      const delay = prefersReduced ? 0 : 200 + i * 11;
      timers.push(window.setTimeout(() => {
        cell.classList.add("on");
        if (REPLIES.includes(i)) cell.classList.add("reply");
      }, delay));
    }

    return () => {
      timers.forEach(window.clearTimeout);
      grid.innerHTML = "";
    };
  }, []);

  return <div className="grid100" ref={gridRef} />;
}

export function Current() {
  return (
    <div className="ap">
      <header className="hero">
        <div className="wrap">
          <div className="topbar">
            <a href="#top" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="nlogo">
                <img src="/__mockup/images/logo.png" alt="Job Genie" style={{ width: 36, height: 36, objectFit: "contain" }} />
                Job Genie
              </div>
            </a>
            <a href="#autopsy" className="navlink">Get my free Autopsy →</a>
          </div>

          <div className="hero-grid">
            <div>
              <span className="eyebrow">Free · The 100-Application Autopsy</span>
              <h1>You sent 100 applications. Something <span className="kill">killed them</span> before a human ever read one.</h1>
              <p className="sub">The Autopsy shows you exactly where your applications died — the résumé screen, the recruiter pass, or the void — and why. Then it hands you the first fix. About 10 minutes.</p>
              <MockForm />
            </div>

            <div className="autopsy-card" aria-hidden="true">
              <div className="card-head">
                <span className="label">Application record</span>
                <span className="case">CASE · SILENCE</span>
              </div>
              <ApplicationGrid />
              <div className="card-foot">
                <span><b>100</b> sent</span>
                <span className="rep"><b className="rep">a few</b> replied</span>
                <span>the rest — <b>Application&nbsp;Silence</b></span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="verdict">
        <div className="wrap">
          <span className="eyebrow">The verdict</span>
          <h2>Silence isn't a rejection. It's a <em>diagnosis you never got.</em></h2>
          <p>When applications vanish, the instinct is to blame yourself — the résumé, the wording, your worth. But Application Silence is a system problem, not a you problem. You're being filtered by a process that was never built to read you generously. The Autopsy shows you the filter, so you stop rewriting the same résumé for the tenth time and fix the thing that's actually costing you callbacks.</p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">The findings</span>
            <h2>Three things the Autopsy pulls out of your last 100 applications.</h2>
          </div>
          <div className="findings">
            <div className="finding">
              <span className="tag">FINDING · 01</span>
              <h3>Your Application Silence Score</h3>
              <p>How much of your silence is coming from the filter versus genuine fit — so you know whether to fix your targeting or your positioning.</p>
            </div>
            <div className="finding">
              <span className="tag">FINDING · 02</span>
              <h3>The Recruiter-Fit Gap</h3>
              <p>The gap between being a fit and reading as a fit to a recruiter skimming for eight seconds. That gap is where most silence actually happens.</p>
            </div>
            <div className="finding">
              <span className="tag">FINDING · 03</span>
              <h3>Cause of death, by stage</h3>
              <p>Where each application died — the résumé screen, the recruiter pass, or a ghost posting that was never really hiring.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">The procedure</span>
            <h2>Upload your résumé. We compare it to the recruiter's brief. You read the findings.</h2>
          </div>
          <div className="steps">
            <div className="step">
              <span className="num">STEP 01</span>
              <h3>Upload your résumé — minus your details</h3>
              <p>Strip your name, phone, email, and home address first if you want. The Autopsy only reads your experience.</p>
            </div>
            <div className="step">
              <span className="num">STEP 02</span>
              <h3>We match it to a specialty recruiter's role brief</h3>
              <p>Your experience, compared against what a recruiter for that specialty is actually screening for — the Recruiter-Fit Matrix.</p>
            </div>
            <div className="step">
              <span className="num">STEP 03</span>
              <h3>You get findings + your first fix</h3>
              <p>Your Silence Score, your Fit Gap, and the single highest-leverage change to make next.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="privacy">
            <svg className="shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <div>
              <span className="eyebrow">Privacy-first upload</span>
              <h3>Strip your name, phone, email, and home address before you upload.</h3>
              <p>The Autopsy compares your <em>experience</em> against a specialty recruiter's role brief — so it never needs your contact details to find your Fit Gap. Redact them, and the diagnosis is exactly the same. Search quietly.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="record">
            <div>
              <span className="eyebrow">The record</span>
              <h2>Everything you walk away with — free, and yours to keep.</h2>
              <div className="price">$0 · NO CARD · NO CATCH</div>
            </div>
            <ul>
              <li><span className="chk">✓</span> Your Application Silence Score</li>
              <li><span className="chk">✓</span> A stage-by-stage cause-of-death breakdown</li>
              <li><span className="chk">✓</span> Your Recruiter-Fit Gap, named and explained</li>
              <li><span className="chk">✓</span> The first concrete fix to make next</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">The record so far</span>
            <h2>Built for mid-career and specialist professionals stuck in the silence.</h2>
          </div>
          <div className="proof">
            <div className="quote">
              <p>"Sixty applications, not one reply. The Autopsy showed me I was dying at the recruiter screen — not the résumé bots I'd been obsessing over. I reframed my last two roles and had three callbacks that week."</p>
              <div className="who">Priya N. · Data Engineer · Fintech</div>
            </div>
            <div className="quote">
              <p>"I assumed it'd be another résumé grader. Instead it named the exact specialty roles I was mis-positioning for. My first real interview in three months came five days later."</p>
              <div className="who">Marcus D. · Supply Chain Manager · Manufacturing</div>
            </div>
            <div className="quote">
              <p>"I'd started to believe I was the problem. My Silence Score showed most of it was targeting, not me. Being able to redact my name and still get a straight read is the only reason I trusted it."</p>
              <div className="who">Elena V. · UX Researcher · Healthcare</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">The questions</span>
            <h2>Before you hand over an email address.</h2>
          </div>
          <div className="faq">
            <details className="qa" open>
              <summary>Is it actually free?</summary>
              <div className="ans">Yes. The Autopsy costs nothing and asks for no card. You keep the findings whether or not you ever do anything else with Job Genie.</div>
            </details>
            <details className="qa">
              <summary>Do I have to upload my résumé?</summary>
              <div className="ans">Yes — that's what gets compared against the specialty recruiter's role brief. But you can remove your name, phone, email, and home address first. The Autopsy reads your experience, not your identity, so redacting your contact details changes nothing about the findings.</div>
            </details>
            <details className="qa">
              <summary>Will my job search stay private?</summary>
              <div className="ans">That's the point of the redaction. Strip your personal details and the Autopsy still works exactly the same — so you can diagnose your search without exposing who you are while you're still employed.</div>
            </details>
            <details className="qa">
              <summary>How is this different from a résumé review?</summary>
              <div className="ans">A review edits a document. The Autopsy diagnoses why the document never got read in the first place — the filter before the human. Different problem, different fix.</div>
            </details>
            <details className="qa">
              <summary>Who is it for?</summary>
              <div className="ans">Mid-career and specialist professionals who are clearly qualified, applying steadily, and hearing nothing back. If "I've tried everything" sounds familiar, it's for you.</div>
            </details>
          </div>
        </div>
      </section>

      <section className="final">
        <div className="wrap">
          <span className="eyebrow" style={{ justifyContent: "center" }}>Get my free Autopsy</span>
          <h2>Stop guessing why they went quiet.</h2>
          <MockForm />
        </div>
      </section>

      <footer>
        <div className="wrap foot-row">
          <a href="#top" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="nlogo">
              <img src="/__mockup/images/logo.png" alt="Job Genie" style={{ width: 36, height: 36, objectFit: "contain" }} />
              Job Genie
            </div>
          </a>
          <div>
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
            <a href="#autopsy">Get my Autopsy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}