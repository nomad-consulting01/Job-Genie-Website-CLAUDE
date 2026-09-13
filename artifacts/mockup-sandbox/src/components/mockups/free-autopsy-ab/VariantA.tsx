import { useEffect, useRef, useState, type FormEvent } from "react";
import "./_group.css";
import "./VariantA.css";

const REPLIES = [7, 19, 34, 58, 71, 88];

function ApplicationGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      grid.appendChild(cell);
      timers.push(window.setTimeout(() => {
        cell.classList.add("on");
        if (REPLIES.includes(index)) cell.classList.add("reply");
      }, reduced ? 0 : 100 + index * 10));
    }
    return () => { timers.forEach(window.clearTimeout); grid.innerHTML = ""; };
  }, []);
  return <div className="grid100" ref={gridRef} />;
}

function AutopsyForm() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (firstName.trim() && email.trim()) setSubmitted(true);
  }
  if (submitted) {
    return <div className="optin-success" role="status"><strong>Record opened.</strong> Check {email} for your free Autopsy.</div>;
  }
  return (
    <form className="optin" onSubmit={handleSubmit}>
      <div className="optin-row">
        <div className="field">
          <label htmlFor="autopsy-first-name">First name</label>
          <input id="autopsy-first-name" type="text" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Maya" required />
        </div>
        <div className="field">
          <label htmlFor="autopsy-email">Email address</label>
          <input id="autopsy-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="maya@email.com" required />
        </div>
        <button className="btn-ap" type="submit">Open my free Autopsy →</button>
      </div>
      <div className="micro"><span><i className="dot" />Free · no card</span><span><i className="dot" />Takes 10 minutes</span></div>
    </form>
  );
}

function FormPanel() {
  return <div className="hero-form-wrap"><div className="form-kicker"><span>01 / Start the record</span><strong>2 fields · 10 sec</strong></div><AutopsyForm /></div>;
}

export function VariantA() {
  return (
    <div className="ap variant-a" id="top">
      <header className="hero">
        <div className="wrap">
          <div className="topbar">
            <a href="#top" style={{ textDecoration: "none", color: "inherit" }}><div className="nlogo"><img src="/__mockup/images/logo.png" alt="Job Genie" style={{ width: 36, height: 36, objectFit: "contain" }} />Job Genie</div></a>
            <a href="#autopsy" className="navlink">Start the free Autopsy →</a>
          </div>
          <div className="hero-grid">
            <div>
              <span className="eyebrow">Free · The 100-Application Autopsy</span>
              <h1>You sent 100 applications. Something <span className="kill">killed them</span> before a human ever read one.</h1>
              <p className="sub">Get a precise read on where your applications died — the résumé screen, the recruiter pass, or the void — and the first fix to make next.</p>
              <FormPanel />
            </div>
            <div className="autopsy-card" aria-label="Animated application record">
              <div className="card-head"><span className="label">Application record</span><span className="case">CASE · SILENCE</span></div>
              <ApplicationGrid />
              <div className="card-foot"><span><b>100</b> sent</span><span className="rep"><b className="rep">6</b> replied</span><span>94 — <b>silence</b></span></div>
            </div>
          </div>
        </div>
      </header>

      <section className="verdict"><div className="wrap"><span className="eyebrow">The verdict</span><h2>Silence isn't a rejection. It's a <em>diagnosis you never got.</em></h2><p>Stop rewriting the same résumé for the tenth time. The Autopsy shows you the filter — and separates a system problem from a genuine fit problem.</p></div></section>
      <section><div className="wrap"><div className="section-head"><span className="eyebrow">The findings</span><h2>Three answers, pulled from your last 100 applications.</h2></div><div className="findings">
        <div className="finding"><span className="tag">FINDING · 01</span><h3>Your Application Silence Score</h3><p>See how much silence comes from the filter versus genuine fit, so you know what to fix.</p></div>
        <div className="finding"><span className="tag">FINDING · 02</span><h3>The Recruiter-Fit Gap</h3><p>Find the distance between being qualified and reading as qualified in an eight-second skim.</p></div>
        <div className="finding"><span className="tag">FINDING · 03</span><h3>Cause of death, by stage</h3><p>Learn whether each application died at the résumé screen, recruiter pass, or ghost posting.</p></div>
      </div></div></section>
      <section style={{ paddingTop: 0 }}><div className="wrap"><div className="section-head"><span className="eyebrow">The procedure</span><h2>One short upload. One clear read. No résumé theater.</h2></div><div className="steps">
        <div className="step"><span className="num">STEP 01</span><h3>Redact, then upload</h3><p>Remove your name, phone, email, and address if you want. The Autopsy reads your experience.</p></div>
        <div className="step"><span className="num">STEP 02</span><h3>We run the comparison</h3><p>Your experience meets what a specialty recruiter actually screens for in the role brief.</p></div>
        <div className="step"><span className="num">STEP 03</span><h3>You get the first fix</h3><p>Keep your Silence Score, Fit Gap, cause-of-death breakdown, and next move.</p></div>
      </div></div></section>
      <section style={{ paddingTop: 0 }}><div className="wrap"><div className="privacy"><svg className="shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg><div><span className="eyebrow">Privacy-first upload</span><h3>Search quietly. Redact your identity before you upload.</h3><p>The Autopsy compares your <em>experience</em> against a specialty recruiter's brief. Your contact details are not part of the diagnosis.</p></div></div></div></section>
      <section style={{ paddingTop: 0 }}><div className="wrap"><div className="record"><div><span className="eyebrow">The record</span><h2>Everything you walk away with — free, and yours to keep.</h2><div className="price">$0 · NO CARD · NO CATCH</div></div><ul><li><span className="chk">✓</span>Your Application Silence Score</li><li><span className="chk">✓</span>A stage-by-stage cause-of-death breakdown</li><li><span className="chk">✓</span>Your Recruiter-Fit Gap, named and explained</li><li><span className="chk">✓</span>The first concrete fix to make next</li></ul></div></div></section>
      <section><div className="wrap"><div className="section-head"><span className="eyebrow">The record so far</span><h2>For qualified people stuck in the silence.</h2></div><div className="proof"><div className="quote"><p>"The Autopsy showed me I was dying at the recruiter screen — not the résumé bots."</p><div className="who">Priya N. · Data Engineer · Fintech</div></div><div className="quote"><p>"It named the exact specialty roles I was mis-positioning for. My first real interview came five days later."</p><div className="who">Marcus D. · Supply Chain Manager</div></div><div className="quote"><p>"Being able to redact my name and still get a straight read is the only reason I trusted it."</p><div className="who">Elena V. · UX Researcher · Healthcare</div></div></div></div></section>
      <section style={{ paddingTop: 0 }}><div className="wrap"><div className="section-head"><span className="eyebrow">The questions</span><h2>Before you hand over an email address.</h2></div><div className="faq"><details className="qa" open><summary>Is it actually free?</summary><div className="ans">Yes. No card, no catch. You keep the findings whether or not you ever do anything else with Job Genie.</div></details><details className="qa"><summary>Do I have to upload my résumé?</summary><div className="ans">Yes — your experience is compared against a specialty recruiter's role brief. You can redact your personal details first.</div></details><details className="qa"><summary>How is this different from a résumé review?</summary><div className="ans">A review edits a document. The Autopsy diagnoses why it never got read in the first place.</div></details><details className="qa"><summary>Who is it for?</summary><div className="ans">Mid-career and specialist professionals who are applying steadily and hearing nothing back.</div></details></div></div></section>
      <section className="final" id="autopsy"><div className="wrap"><div className="scanline" /><span className="eyebrow" style={{ justifyContent: "center" }}>Get my free Autopsy</span><h2>Stop guessing why they went quiet.</h2><FormPanel /></div></section>
      <footer><div className="wrap foot-row"><a href="#top" style={{ textDecoration: "none", color: "inherit" }}><div className="nlogo"><img src="/__mockup/images/logo.png" alt="Job Genie" style={{ width: 36, height: 36, objectFit: "contain" }} />Job Genie</div></a><div><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#autopsy">Get my Autopsy</a></div></div></footer>
    </div>
  );
}