import { useCallback, useEffect, type SyntheticEvent } from "react";
import ProposedHome from "./_ProposedHome";
import "./_review.css";

function containPreviewNavigation(event: SyntheticEvent<HTMLElement>) {
  const target = event.target as HTMLElement;
  const link = target.closest("a");
  if (link) {
    const href = link.getAttribute("href") ?? "";
    if (!href.startsWith("#")) event.preventDefault();
  }
}

export function Proposed() {
  useEffect(() => {
    const section = window.location.hash.slice(1);
    if (!section.startsWith("proposed-")) return;
    const timer = window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: "instant", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, []);

  const contain = useCallback((event: SyntheticEvent<HTMLElement>) => {
    containPreviewNavigation(event);
  }, []);

  return (
    <div className="homepage-evidence-review" onClickCapture={contain} onSubmitCapture={(event) => event.preventDefault()}>
      <aside className="review-status" role="note" aria-label="Proposed homepage review status">
        <span className="review-status-mark proposed" aria-hidden="true">P</span>
        <div><strong>Proposed · review copy</strong><span>Customer-facing page with separate review annotations.</span></div>
      </aside>
      <ProposedHome />
      <ReviewLedger />
    </div>
  );
}

function ReviewLedger() {
  return (
    <details className="review-ledger">
      <summary><span className="ledger-kicker">Review only</span><strong>Change ledger</strong><span className="ledger-toggle" aria-hidden="true">⌃</span></summary>
      <nav aria-label="Homepage proposed changes">
        <a href="#proposed-hero"><span>01</span>Hero framing</a>
        <a href="#proposed-myths"><span>02</span>Three claims, corrected</a>
        <a href="#proposed-direct-answer"><span>03</span>What evidence supports</a>
        <a href="#proposed-autopsy"><span>04</span>Autopsy invitation</a>
        <a href="#proposed-disclosure"><span>05</span>Sources &amp; disclosure</a>
      </nav>
      <ol className="ledger-list">
        <li><strong>REVISED · Hero</strong><span>BEFORE: “100 applications. / 0 replies. / Here's exactly why.” AFTER: “Most of what you've been told about why applications fail is wrong.” Layout and product preview retained; compact methodology link added.</span></li>
        <li><strong>ADDED · Immediately after hero</strong><span>BEFORE: no claim correction section. AFTER: “75% of résumés are rejected by ATS…”; “80% of jobs are never posted”; “A third of job postings are fake” — each corrected with source, scope, and limits.</span></li>
        <li><strong>REVISED · Direct Answer</strong><span>BEFORE: “Job applications can go silent because of competition for public postings, listings without active hiring intent, and a resume that does not clearly show role-relevant evidence. Greenhouse's March 2026 North American benchmark found average applications per job rose from 116 in 2022 to 244 in 2025. Job Genie calculates your free Application Silence Score in under 2 minutes — no account required.” AFTER: “Three things the evidence supports: the pile roughly doubled — Greenhouse reports average applications per opening rose from 116 in 2022 to 244 in 2025 across its North American customer data; screening systems rank candidates, and recruiters may stop once they have enough people to call, so low rank is not the same as an explicit rejection; and route changes who gets considered. Agency-submitted candidates reaching interview at higher rates is shaped by selection too — it does not prove that channel alone causes the difference.”</span></li>
        <li><strong>REVISED · Bottom Autopsy CTA</strong><span>BEFORE headline: “Most candidates aren't getting ignored because they're unqualified. They're getting ignored because a recruiter can't pitch them in 90 seconds.” AFTER: “So what actually went wrong with yours?” BEFORE body: “Silence is not random. It is a signal — one you can read, fix, and reverse.” AFTER body: “There are several possible reasons an application gets no answer. The free Autopsy looks at what you actually sent and identifies which cause your evidence points to.” Adds eight possible causes, confidence/uncertainty note, and disclosure that signup starts with free email.</span></li>
        <li><strong>ADDED · Footer &amp; product preview</strong><span>BEFORE: no non-affiliation note or product-preview disclosure. AFTER: explicit non-affiliation/source limits and “Illustrative product preview” notice.</span></li>
      </ol>
      <p className="ledger-unchanged"><strong>UNCHANGED SCOPE</strong> Navigation, How it works, Evidence layer/product, features, FAQ, pricing, value stack, and refund terms remain from the extracted source.</p>
    </details>
  );
}

export default Proposed;
