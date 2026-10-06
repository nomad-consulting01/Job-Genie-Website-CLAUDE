import "./_value-sections.css";

export function RecruiterBriefSection() {
  return (
    <section id="recruiter-brief" className="brief-section" aria-labelledby="brief-title">
      <div className="w">
        <div className="brief-shell">
          <div className="brief-copy">
            <div className="ey brief-ey">Included with every Evidence layer rewrite</div>
            <h2 className="disp brief-title" id="brief-title">The CV gets you read.<br /><span className="gt">The Brief gets you argued for.</span></h2>
            <p>A specialist recruiter has about ninety seconds to pitch you to their client, and the fee on that placement is their own. If they cannot make the case quickly, they do not submit you — not out of malice, but because a weak submission costs them more than a skipped one.</p>
            <p>The Recruiter-Ready Brief is the three-to-five sentence email that goes with your rewritten CV. It is written in the recruiter's language, not yours. It states what you do, the proof that you have done it, and why their client should care — before the document is open.</p>
            <p>It turns a cold submission into a warm introduction, and it means the recruiter is reading your CV already looking for reasons to say yes.</p>
            <ul className="brief-points">
              <li>Written in the recruiter's language, not the candidate's</li>
              <li>Sets the frame before the CV is opened</li>
              <li>Delivered with every Evidence layer rewrite — Pro only</li>
            </ul>
          </div>
          <aside className="brief-art" aria-label="Recruiter-ready pitch preview">
            <div className="brief-art-top"><span>ILLUSTRATIVE BRIEF · NOT A REAL CANDIDATE</span><span className="brief-dot">●</span></div>
            <div className="brief-to">To: Hiring team <span>· Client shortlist</span></div>
            <div className="brief-rule"></div>
            <div className="brief-email">
              <span className="brief-label">THE CANDIDATE</span>
              <strong>B2B Demand Generation Lead</strong>
              <span>SaaS · 8 years · Demand generation</span>
            </div>
            <div className="brief-email">
              <span className="brief-label">THE EVIDENCE</span>
              <strong>Scaled a $4.2M pipeline</strong>
              <span>Reduced customer acquisition cost by 34%.</span>
            </div>
            <div className="brief-email">
              <span className="brief-label">WHY THIS CLIENT</span>
              <strong>Relevant proof, up front.</strong>
              <span>A concise case before the CV is opened.</span>
            </div>
            <div className="brief-signoff">Three to five sentences. Built to be forwarded.</div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function ProValueStack() {
  return (
    <div className="value-stack">
      <div className="value-stack-head">
        <div className="stag">The complete picture</div>
        <h3 className="disp">What's inside Pro, and what each part would cost you elsewhere</h3>
        <p>Find out what's blocking your interviews. See everything Pro includes to act on it.</p>
      </div>
      <div className="value-table-wrap">
        <table className="value-table">
          <thead><tr><th>Included in Pro</th><th>Comparable market rate</th></tr></thead>
          <tbody>
            <tr><th><strong>Evidence layer rewrite</strong><span>8 rules, 4 audits, the 90-second shortlist test applied before delivery</span></th><td><strong>Professional résumé writing for mid-career roles</strong><span>Approximately $350–$700<sup><a href="#resume-pricing-methodology" aria-label="Read résumé pricing methodology footnote 1">1</a></sup></span></td></tr>
            <tr><th><strong>Recruiter-Ready Brief</strong><span>The pitch email, delivered with every rewrite</span></th><td>Usually an add-on, where it is offered at all</td></tr>
            <tr><th><strong>300,000+ specialist recruiter listings</strong><span>From 150+ agencies</span></th><td>Not sold separately — recruiter databases are licensed to employers</td></tr>
            <tr><th><strong>Live URL validation</strong><span>Removes 10–40% that are no longer live</span></th><td>No consumer equivalent</td></tr>
            <tr><th><strong>Recruiter-Fit scoring</strong><span>Across eight dimensions, with the method published</span></th><td>No consumer equivalent</td></tr>
            <tr><th><strong>Market demand matched to live vacancy counts</strong><span>Across 60+ role categories</span></th><td>No consumer equivalent</td></tr>
            <tr><th><strong>Unlimited exports</strong><span>Excel, CSV, Word</span></th><td>—</td></tr>
          </tbody>
        </table>
      </div>
      <p className="value-stack-methodology" id="resume-pricing-methodology"><strong>1. Résumé-writing price comparison.</strong> Published pricing and marketing from résumé-writing services puts mid-career packages at roughly $350–$700, with executive packages generally priced higher. Sources reviewed in the supplied validation dated 4 October 2026: Talo, We Are Career, Resume Optimizer Pro, Freelance Nation and Resumarea. A 2023 Find My Profession survey of fifteen named providers reported a mid-level average of $422. These figures come from providers' own published pricing and marketing, not independent market estimates; package contents vary.</p>
      <p className="value-stack-close">$99.99 every three months. Nothing charged for the first fourteen days. Renews automatically unless you cancel.</p>
    </div>
  );
}

export function FreeEitherWay() {
  return (
    <aside className="free-either">
      <span className="free-mark" aria-hidden="true">+</span>
      <p><strong>Free either way:</strong> the Application Autopsy email series, and the full published scoring method — every dimension, band and source. You can read exactly how the score works before you decide whether to pay for anything.</p>
    </aside>
  );
}

export function EarlyHireRationale() {
  return (
    <div className="price-rationale">
      <p>Most tools want you subscribed for a year. We priced three months because that is roughly how long this takes — and if you are hired before the term ends, we refund the whole unused months. No documents, no argument.</p>
      <strong>We would rather you left.</strong>
    </div>
  );
}