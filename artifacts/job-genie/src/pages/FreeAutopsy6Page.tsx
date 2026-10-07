import { useRef, useState, type FormEvent } from "react";
import { useAnalyzeJobPosting, type JobPostingBrief } from "@workspace/api-client-react";
import { BrandNavigation } from "../components/BrandNavigation";
import { SEO } from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import "./FreeAutopsy6Page.css";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const canonicalUrl = "https://www.job-genie.ai/free-autopsy6";
const sampleSignals = [
  { signal: "Named delivery methodology, stated not implied", weight: "high", evidence: "Illustrative example only — no source posting was analyzed.", interpretation: "Name the method and show where you used it." },
  { signal: "Budget and headcount figures on at least one programme", weight: "high", evidence: "Illustrative example only — no source posting was analyzed.", interpretation: "Scope is easier to assess when the scale is explicit." },
  { signal: "Regulated-sector exposure in the last four years", weight: "high", evidence: "Illustrative example only — no source posting was analyzed.", interpretation: "The timeframe is part of this example signal." },
  { signal: "Evidence of governance at steering-committee level", weight: "medium", evidence: "Illustrative example only — no source posting was analyzed.", interpretation: "Show the level and your role in that governance." },
  { signal: "A named benefits-realisation outcome", weight: "medium", evidence: "Illustrative example only — no source posting was analyzed.", interpretation: "Connect delivery to a stated outcome." },
];

type Analysis = JobPostingBrief;

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown) {
  const candidate = error as { message?: string; data?: { error?: string } } | undefined;
  return candidate?.data?.error || candidate?.message || "We couldn’t read that posting. Try pasting its text instead.";
}

export default function FreeAutopsy6Page() {
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const requestId = useRef(0);
  const analyze = useAnalyzeJobPosting();
  const pending = analyze.isPending;

  const changeMode = (next: "url" | "text") => {
    if (pending) return;
    requestId.current += 1;
    setMode(next);
    setResult(null);
    setError("");
  };

  const reset = () => {
    requestId.current += 1;
    analyze.reset();
    setResult(null);
    setError("");
    setUrl("");
    setText("");
    setMode("url");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || (mode === "url" ? !url.trim() : text.trim().length < 80 || text.trim().length > 30000)) return;
    const id = ++requestId.current;
    setResult(null);
    setError("");
    trackEvent("hero_cta_click", { page_slug: "/free-autopsy6" });
    try {
      const response = await analyze.mutateAsync({
        data: mode === "url" ? { url: url.trim() } : { text: text.trim() },
      });
      if (id === requestId.current) setResult(response as Analysis);
    } catch (cause) {
      if (id === requestId.current) setError(errorMessage(cause));
    }
  };

  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")?.focus(), 250);
  };

  const sourceUrl = safeHttpUrl(result?.sourceUrl);

  return (
    <div className="jg-autopsy6">
      <SEO
        title="Paste a Job Posting. See What They’re Screening For | Job Genie"
        description="Analyze a public job posting and see the signals a recruiter may read in it. Free, no account or CV upload required."
        canonicalUrl={canonicalUrl}
        pageType="article"
        slug="free-autopsy6"
      />
      <BrandNavigation />
      <main id="main-content">
        <section className="jg6-hero">
          <div className="jg6-hero-inner">
            <div className="jg6-intro">
              <div className="jg6-eyebrow"><span /> JOB GENIE <i>/</i> POSTING READER</div>
              <h1>Paste a job you applied for.<br /><em>See what they were screening for.</em></h1>
              <p className="jg6-deck">No account, no CV upload, nothing about you yet. Just the posting—and what a specialist recruiter reads it as.</p>
              <div className="jg6-proofline"><span>↳</span> Takes about ten seconds <b>·</b> Free <b>·</b> No card required</div>
              <button type="button" className="jg6-hero-cta" onClick={focusForm} data-testid="button-start-with-posting">Start with the posting <span aria-hidden="true">↓</span></button>
            </div>
            <div className="jg6-hero-note">
              <span className="jg6-note-index">A BETTER FIRST STEP</span>
              <p>Start with the brief, not your personal history.</p>
              <div className="jg6-note-foot"><span className="jg6-dot" /> Nothing about you is needed to read a posting.</div>
            </div>
          </div>
          <div className="jg6-hero-bottom"><span>HIRING SIGNALS, MADE LEGIBLE</span><span>01 — THE POSTING <b>↓</b></span></div>
        </section>

        <section className="jg6-workspace" id="analyzer">
          <div className="jg6-workspace-head">
            <div><span className="jg6-section-label">01 / RUN A READING</span><h2>Start with the posting.</h2></div>
            <p>Use the job URL first. If a job board blocks access, paste the description instead.</p>
          </div>
          <div className="jg6-work-grid">
            <form className="jg6-form" ref={formRef} onSubmit={submit} data-testid="form-posting-analysis">
              <div className="jg6-tabs" role="tablist" aria-label="Posting input method">
                <button type="button" role="tab" aria-selected={mode === "url"} className={mode === "url" ? "active" : ""} onClick={() => changeMode("url")} disabled={pending} data-testid="tab-posting-url">Job posting URL</button>
                <button type="button" role="tab" aria-selected={mode === "text"} className={mode === "text" ? "active" : ""} onClick={() => changeMode("text")} disabled={pending} data-testid="tab-paste-text">Paste text instead</button>
              </div>
              {mode === "url" ? (
                <label className="jg6-field">
                  <span>PUBLIC JOB POSTING LINK</span>
                  <input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setResult(null); setError(""); }} placeholder="https://company.com/careers/role" required disabled={pending} aria-label="Job posting URL" data-testid="input-posting-url" />
                </label>
              ) : (
                <label className="jg6-field">
                  <span>POSTING TEXT <small>80–30,000 characters</small></span>
                  <textarea value={text} onChange={(event) => { setText(event.target.value); setResult(null); setError(""); }} placeholder="Paste the job description here…" minLength={80} maxLength={30000} required disabled={pending} aria-label="Job posting text" data-testid="input-posting-text" />
                  <span className="jg6-count">{text.length.toLocaleString()} / 30,000</span>
                </label>
              )}
              <div className="jg6-privacy"><span aria-hidden="true">◇</span><p>The posting is sent to our AI provider for analysis. Job Genie’s server does not save the posting or the resulting brief.</p></div>
              <button type="submit" className="jg6-submit" disabled={pending || (mode === "url" ? !url.trim() : text.trim().length < 80)} data-testid="button-analyze-posting">
                {pending ? <><span className="jg6-pulse" /> Reading the brief…</> : <>Read this posting <span aria-hidden="true">→</span></>}
              </button>
              <p className="jg6-no-account">No account. No email. No card. No CV upload.</p>
              {pending && <div className="jg6-loading" role="status" data-testid="status-analysis-loading"><span /><span /><span /> Extracting role signals from the posting…</div>}
              {error && <div className="jg6-error" role="alert" data-testid="status-analysis-error"><strong>That didn’t come through.</strong><span>{error}</span>{mode === "url" && <button type="button" onClick={() => changeMode("text")} data-testid="button-switch-to-text">Paste the posting text instead →</button>}</div>}
            </form>

            <div className="jg6-result-panel" aria-live="polite" aria-atomic="false" data-testid="panel-analysis-result">
              {result ? (
                <div className="jg6-actual-result" data-testid="result-actual">
                  <div className="jg6-result-top"><span className="jg6-live-mark"><i /> ACTUAL POSTING BRIEF</span><button type="button" onClick={reset} data-testid="button-reset-analysis">Start over <span aria-hidden="true">↺</span></button></div>
                  <h3>{result.title || "Posting analysis"}</h3>
                  {result.company && <p className="jg6-company">{result.company}</p>}
                  {sourceUrl && <a className="jg6-source-link" href={sourceUrl} target="_blank" rel="noreferrer">View source posting <span aria-hidden="true">↗</span></a>}
                  <p className="jg6-summary">{result.summary}</p>
                  <div className="jg6-signal-heading"><span>WHAT THIS BRIEF SIGNALS</span><small>{result.signals.length} signals</small></div>
                  <div className="jg6-signals">
                    {result.signals.map((item, index) => <article className="jg6-signal" key={`${item.signal}-${index}`} data-testid={`signal-result-${index}`}>
                      <div className="jg6-signal-title"><span className={`jg6-weight ${item.weight}`}>{item.weight} inferred weight</span><h4>{item.signal}</h4></div>
                      <blockquote>“{item.evidence}”</blockquote><p>{item.interpretation}</p>
                    </article>)}
                  </div>
                  {result.limitations.length > 0 && <div className="jg6-limitations"><strong>Limits of this reading</strong>{result.limitations.map((item, index) => <p key={index}>— {item}</p>)}</div>}
                  <p className="jg6-result-caveat">These are AI-inferred signals, not confirmed employer criteria. This is not a verdict on candidate suitability, job freshness, or authenticity.</p>
                </div>
              ) : (
                <div className="jg6-example" data-testid="panel-illustrative-example">
                  <div className="jg6-result-top"><span className="jg6-example-label"><i /> ILLUSTRATIVE EXAMPLE</span><span className="jg6-example-index">SAMPLE BRIEF / 01</span></div>
                  <h3>Senior Programme Manager — Transformation</h3>
                  <p className="jg6-example-meta">Posted 11 days ago <b>·</b> agency-held</p>
                  <div className="jg6-example-rule" />
                  <div className="jg6-signal-heading"><span>WHAT A RECRUITER SCREENS THIS BRIEF FOR</span><small>5 signals</small></div>
                  <div className="jg6-signals">
                    {sampleSignals.map((item, index) => <article className="jg6-signal" key={item.signal}>
                      <div className="jg6-signal-title"><span className={`jg6-weight ${item.weight}`}>{item.weight}</span><h4>{item.signal}</h4></div>
                      <blockquote>{item.evidence}</blockquote><p>{item.interpretation}</p>
                    </article>)}
                  </div>
                  <p className="jg6-example-takeaway">In this illustrative comparison, four of the five are things most CVs imply and never state. That is usually the whole gap—not the experience, the evidence of it.</p>
                  <p className="jg6-disclosure">Illustrative extraction. This sample is not your result; your own posting produces its own brief.</p>
                </div>
              )}
            </div>
          </div>
          <p className="jg6-method-note">Every signal is paired with a verbatim excerpt from the posting it came from. <a href={`${base}/methodology`} data-testid="link-methodology-inline">How we approach evidence <span aria-hidden="true">↗</span></a></p>
        </section>

        <section className="jg6-why">
          <div className="jg6-why-index">02 <span>WHY POSTING FIRST</span></div>
          <div className="jg6-why-content"><span className="jg6-section-label">A SMALLER ASK</span><h2>Your CV is personal.<br /><em>A job posting is not.</em></h2>
            <p>Because it costs you nothing. A job posting is public, it is already in your history, and it says nothing about who you are.</p>
            <p>Your CV is the opposite. Asking for it before you have any reason to trust us is the wrong order—and it is the order almost every tool in this category uses.</p>
            <div className="jg6-quote">You can read the brief, close the tab, and apply what you learned to your own CV by hand. That is a legitimate outcome and it costs you nothing.</div>
          </div>
        </section>

        <section className="jg6-next" id="next-step">
          <div className="jg6-next-inner">
            <div className="jg6-next-copy"><span className="jg6-section-label">03 / ONLY IF YOU WANT TO GO FURTHER</span><h2>First the brief.<br /><em>Then your evidence.</em></h2><p>Only if the posting looked worth testing against: continue to the existing free Autopsy signup. That next step is an email signup, not an upload or diagnosis on this page.</p><a href={`${base}/free-autopsy/`} className="jg6-next-button" data-testid="link-free-autopsy">Continue to free Autopsy signup <span aria-hidden="true">→</span></a><small>The signup sends instructions by email. You choose whether to continue.</small></div>
            <div className="jg6-steps"><span className="jg6-steps-title">THE NEXT THREE STEPS</span>
              <div><b>01</b><span><strong>Upload your CV</strong><small>Only after signup. Strip your name and contact details first if you prefer—the diagnosis is identical without them.</small></span></div>
              <div><b>02</b><span><strong>See the gap, named</strong><small>Which signals your CV carries, implies, or misses.</small></span></div>
              <div><b>03</b><span><strong>Get the Silence Score</strong><small>Which of eight causes your evidence points to, at what confidence, with the source behind every claim.</small></span></div>
            </div>
          </div>
        </section>
        <footer className="jg6-footer"><div><span className="jg6-section-label">JOB GENIE / THE FINE PRINT</span><p>Job Genie is not affiliated with any job board, employer, or recruitment agency. An AI reading can miss context; use the quoted source text to judge each signal for yourself.</p></div><a href={`${base}/methodology`} data-testid="link-methodology-footer">Methodology <span aria-hidden="true">↗</span></a><button type="button" onClick={focusForm} data-testid="button-footer-start">Start with the posting <span aria-hidden="true">↑</span></button></footer>
      </main>
    </div>
  );
}
