import { useState, type CSSProperties, type FormEvent } from "react";
import { SEO } from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import { getVisitorId } from "../lib/abtest";
import "./FreeAutopsy2Page.css";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const REPLIES = new Set([7, 19, 34, 58, 71, 88]);

function IntakeForm({ id }: { id: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firstName.trim() || !email.trim() || status === "submitting") return;

    setStatus("submitting");
    trackEvent("newsletter_submit_attempt");
    const query = new URLSearchParams(window.location.search);

    try {
      const response = await fetch(`${API_BASE}/api/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          email: email.trim(),
          page_slug: window.location.pathname,
          visitor_id: getVisitorId(),
          lead_magnet: "100-application-autopsy",
          utm_source: query.get("utm_source") ?? undefined,
          utm_medium: query.get("utm_medium") ?? undefined,
          utm_campaign: query.get("utm_campaign") ?? undefined,
          utm_content: query.get("utm_content") ?? undefined,
          utm_term: query.get("utm_term") ?? undefined,
        }),
      });
      if (!response.ok) throw new Error("Subscription failed");
      setSubmitted(true);
      setStatus("idle");
      setFirstName("");
      setEmail("");
      trackEvent("newsletter_submit_success");
    } catch {
      setStatus("error");
      trackEvent("newsletter_submit_error");
    }
  }

  if (submitted) {
    return (
      <div className="success" role="status">
        <strong>Your case is open.</strong>
        Check your inbox for the free Autopsy and upload instructions.
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-label="Get your free Application Autopsy">
      <div className="field">
        <label htmlFor={`${id}-first-name`}>First name</label>
        <input
          id={`${id}-first-name`}
          name="first_name"
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          required
          placeholder="e.g. Priya"
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-email`}>Email address</label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="you@yourmail.com"
        />
      </div>
      <button className="submit" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send me the free Autopsy"} <span aria-hidden="true">→</span>
      </button>
      <div className="consent">
        <span aria-hidden="true" />
        <div>No résumé yet. No card. No sales call. Just the findings, sent to this inbox.</div>
      </div>
      {status === "error" && (
        <div className="formError" role="alert">Something went wrong. Please try again.</div>
      )}
    </form>
  );
}

function IntakeCard({ id, final = false }: { id: string; final?: boolean }) {
  return (
    <div className="vformCard">
      <div className="vmono">{final ? "Get your free Autopsy" : "A quiet, useful first step"}</div>
      <h2>{final ? "Stop guessing why they went quiet." : "Know what happens before you share anything."}</h2>
      <p>
        {final
          ? "One clear diagnosis. One practical fix. No pressure to do anything else."
          : "Leave your first name and email. We’ll send the free Autopsy and explain exactly what to redact before you upload."}
      </p>
      <IntakeForm id={id} />
      {!final && <div className="privacyLine">Your email is used to deliver your report. Unsubscribe in one click. Your résumé stays yours.</div>}
    </div>
  );
}

function ApplicationRecord() {
  return (
    <div className="vrecord" aria-label="Application record showing 100 applications and six replies">
      <div className="recordtop vmono"><span>Application record</span><span className="recordcase">CASE · SILENCE</span></div>
      <div className="grid">
        {Array.from({ length: 100 }, (_, index) => (
          <div key={index} className={`cell ${REPLIES.has(index) ? "reply" : ""}`} style={{ "--i": index } as CSSProperties} />
        ))}
      </div>
      <div className="recordbottom vmono">
        <span><strong>100</strong> sent</span>
        <span className="replyText"><strong>6</strong> replies</span>
        <span>94 — still unexplained</span>
      </div>
    </div>
  );
}

export default function FreeAutopsy2Page() {
  return (
    <main className="vb" id="top">
      <SEO
        title="Free Application Autopsy — Find Out Why Your Applications Go Silent | Job Genie"
        description="A private, specific read on where your applications are disappearing — the résumé screen, the recruiter pass, or a ghost posting that was never really hiring."
        canonicalUrl="https://www.job-genie.ai/free-autopsy2"
        pageType="landing"
        slug="free-autopsy2"
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <header className="vhero">
        <div className="vwrap">
          <nav className="vtop">
            <a href="/" className="vlogo"><img src="/logo.png" alt="Job Genie" />Job Genie</a>
            <a className="vtoplink" href="#how-it-works">See how it works ↓</a>
          </nav>
          <div className="vheroGrid">
            <div>
              <div className="veyebrow vmono">Free · The 100-Application Autopsy</div>
              <h1>You sent 100 applications. <em>Let&apos;s find the break.</em></h1>
              <p className="vlead">A private, specific read on where your applications are disappearing — the résumé screen, the recruiter pass, or a ghost posting that was never really hiring.</p>
              <ApplicationRecord />
            </div>
            <IntakeCard id="hero-intake" />
          </div>
        </div>
      </header>

      <section className="trustBand">
        <div className="vwrap trustItems">
          <div className="trustItem"><div className="trustIcon">◇</div><div><strong>Redact first</strong><span>Remove your name, phone and address. The findings don’t need them.</span></div></div>
          <div className="trustItem"><div className="trustIcon">✓</div><div><strong>Free means free</strong><span>No card, no trial, no disguised consultation call.</span></div></div>
          <div className="trustItem"><div className="trustIcon">↗</div><div><strong>Useful in 10 minutes</strong><span>You leave with one concrete fix to make next.</span></div></div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="vwrap">
          <div className="sectionHeader">
            <div className="veyebrow vmono">The procedure</div>
            <h2>Nothing mysterious happens after you click.</h2>
            <p>We show you the process before we ask for the document. This is a diagnosis of the hiring system around your experience — not a score for your worth.</p>
          </div>
          <div className="steps">
            <div className="step"><div className="stepNum vmono">01 / PREPARE</div><h3>Redact what identifies you</h3><p>Strip your name, phone, email and home address if you prefer. Your experience is the only evidence we need.</p></div>
            <div className="step"><div className="stepNum vmono">02 / COMPARE</div><h3>Match against the real brief</h3><p>We compare your résumé to what a specialty recruiter is actually screening for, not a generic checklist.</p></div>
            <div className="step"><div className="stepNum vmono">03 / READ</div><h3>Get the first fix</h3><p>Your Silence Score, Fit Gap and the highest-leverage change to make next — clearly named.</p></div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="vwrap">
          <div className="privacyPanel">
            <div><div className="veyebrow vmono">Private by design</div><h2>Search quietly. Learn loudly.</h2></div>
            <div><p>The Autopsy works without your contact details. Redaction is not a compromise — it is the safer way to understand what is happening while you’re still employed.</p><div className="checklist"><div className="check"><b>✓</b> No identity data needed for the diagnosis</div><div className="check"><b>✓</b> Your free findings are yours to keep</div><div className="check"><b>✓</b> Unsubscribe whenever you want</div></div></div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="vwrap">
          <div className="sectionHeader"><div className="veyebrow vmono">The record so far</div><h2>For people who are qualified, consistent — and tired of silence.</h2></div>
          <div className="quotes">
            <blockquote className="quote"><p>“The Autopsy showed me I was dying at the recruiter screen, not the résumé bots I’d been obsessing over.”</p><small>Priya N. · Data Engineer · Fintech</small></blockquote>
            <blockquote className="quote"><p>“Being able to redact my name and still get a straight read is the only reason I trusted it.”</p><small>Elena V. · UX Researcher · Healthcare</small></blockquote>
          </div>
        </div>
      </section>

      <section className="final">
        <div className="vwrap">
          <div className="veyebrow vmono" style={{ justifyContent: "center" }}>A clear next step</div>
          <IntakeCard id="final-intake" final />
        </div>
      </section>

      <footer>
        <div className="vwrap foot">
          <span>© Job Genie · The Application Autopsy</span>
          <div><a href="#top">Back to top</a><a href="#how-it-works">How it works</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
        </div>
      </footer>
    </main>
  );
}