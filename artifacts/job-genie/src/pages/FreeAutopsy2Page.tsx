import { useState, type FormEvent } from "react";
import { SEO } from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import { getVisitorId } from "../lib/abtest";
import "./FreeAutopsy2Page.css";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LOGO_PATH = `${import.meta.env.BASE_URL}logo.png`;

const QUESTIONS = [
  {
    title: "How many applications have you sent without hearing back?",
    options: ["10–25", "25–50", "50–100", "100+"],
    insights: [
      "Enough to see the start of a pattern. Not yet enough to be certain it's not variance — we'll tell you which.",
      "That's past the point where bad luck explains it. Something systematic is happening.",
      "At this volume, the odds of this being chance are effectively gone. There's a cause, and it's findable.",
      "This isn't a numbers problem. Sending more of the same has already been tested — a hundred times — and the answer came back the same each time.",
    ],
  },
  {
    title: "Where did most of them go?",
    options: [
      "Job boards (LinkedIn, Indeed, company sites)",
      "In-house recruiters at the company",
      "Specialist or agency recruiters",
      "A mix of all three",
    ],
    insights: [
      "Board applications usually enter a ranking system before any person sees them. That's the harshest filter and the one that explains the most silence.",
      "In-house recruiters are measured on time-to-fill. Their screen is fast and unexplained by design — nobody is required to tell you why.",
      "A named recruiter with an inbox is accountable in a way that an ATS isn't. If they went silent too, that's a different signal.",
      "Good. Silence from a board and silence from a named recruiter mean different things.",
    ],
  },
  {
    title: "Where are you in your career?",
    options: ["Under 5 years", "5–12 years", "12–20 years", "20+ years"],
    insights: [
      "The filters that catch early-career candidates are mostly about evidence volume. Fixable, usually quickly.",
      "The awkward band. Too experienced for junior screens, not yet legible as senior. A lot of silence lives here.",
      "At this level the screen stops reading skills and starts reading scope, comp band, and trajectory.",
      "The filters here are rarely about capability. They're about cost, risk, and whether your path reads as still-ascending.",
    ],
  },
  {
    title: "Have any led to a first conversation — a screening call, a recruiter reply, anything?",
    options: ["None at all", "A few, then nothing", "Regularly — I get calls but no offers"],
    insights: [
      "That's what this tool is built for. You're not failing interviews — you're not reaching them. Keep going.",
      "Useful. You're getting past the first filter sometimes — we'll look at what's different about the ones that landed.",
      "Then the Autopsy is the wrong tool for you, and we'd rather say so. You don't have a silence problem. You're clearing the screen — the filter we diagnose isn't what's stopping you. Your gap is between the first conversation and the offer: interview performance, positioning, or negotiation. We don't sell that and we're not going to pretend otherwise.",
    ],
    decision: true,
  },
  {
    title: "What would a useful answer give you?",
    options: ["The first fix", "A clearer target", "Proof it isn't me", "All three"],
    insights: [
      "We'll keep the finding practical: one change you can make next.",
      "We'll show you where your search is strongest, and where it is leaking.",
      "Application Silence is usually a system problem, not a verdict on your worth.",
      "Then we'll make the diagnosis specific enough to act on.",
    ],
  },
  {
    title: "Where should we send your private Autopsy?",
    options: ["Enter my details"],
    insights: ["Your case is ready. We only need a name and inbox to send the findings."],
  },
];

type SubmitStatus = "idle" | "submitting" | "error";

export default function FreeAutopsy2Page() {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [experience, setExperience] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [formError, setFormError] = useState("");

  const question = QUESTIONS[page - 1];
  const isIntro = page === 0;
  const isEmailStep = page === 7;
  const isTruthStep = page === 8;
  const isTextStep = page === 5 || page === 6;
  const currentText = page === 5 ? jobDescription : experience;
  const setCurrentText = page === 5 ? setJobDescription : setExperience;
  const isSubmitting = submitStatus === "submitting";

  function goToPage(nextPage: number) {
    setPage(nextPage);
    setSelected(null);
    setFormError("");
  }

  function nextPage() {
    if (isIntro) {
      trackEvent("autopsy_funnel_start", { funnel_step: 0 });
      goToPage(1);
      return;
    }
    if (!isTextStep && selected === null) return;
    if (isTextStep && !currentText.trim()) return;
    goToPage(Math.min(8, page + 1));
  }

  async function submitNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedFirstName = firstName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedFirstName) {
      setFormError("Please enter your first name.");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setFormError("");
    setSubmitStatus("submitting");
    trackEvent("newsletter_submit_attempt");
    const query = new URLSearchParams(window.location.search);

    try {
      const response = await fetch(`${API_BASE}/api/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: trimmedFirstName,
          email: trimmedEmail,
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
      setSubmitStatus("idle");
      trackEvent("newsletter_submit_success");
      goToPage(8);
    } catch {
      setSubmitStatus("error");
      setFormError("Something went wrong. Please try again.");
      trackEvent("newsletter_submit_error");
    }
  }

  return (
    <main className="mobile-autopsy" id="top">
      <SEO
        title="Free Application Autopsy — Find Out Why Your Applications Go Silent | Job Genie"
        description="A private, specific read on where your applications are disappearing — the résumé screen, the recruiter pass, or a ghost posting that was never really hiring."
        canonicalUrl="https://www.job-genie.ai/free-autopsy2"
        pageType="landing"
        slug="free-autopsy2"
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <section className="mobile-screen" aria-label="Free Application Autopsy">
        <div className="progress" aria-label={isIntro ? "Introduction" : `Step ${page} of 6`}>
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className={index <= page ? "active" : ""} />
          ))}
        </div>

        <div className="mobile-content">
          <div className="brand-line">
            <img className="brand-mark" src={LOGO_PATH} alt="" />
            <span>JOB GENIE</span>
            <span className="case-label">CASE 01</span>
          </div>

          {isIntro && (
            <>
              <p className="audience">For mid-career professionals getting no response</p>
              <h1>You didn&apos;t get rejected. <em>You got ranked.</em></h1>
              <p className="explanation">
                Recruiting platforms rank and label candidates rather than accepting or rejecting them.
                Run the 100-Application Autopsy and find out where you&apos;re sorting.
              </p>
              <div className="signal-row" aria-hidden="true">
                <span className="signal-dot" /><span>APPLICATION SILENCE DETECTED</span>
              </div>
              <button className="primary-button hero-button" type="button" data-testid="button-start-autopsy" onClick={nextPage}>
                Run my free Autopsy <span aria-hidden="true">→</span>
              </button>
            </>
          )}

          {!isIntro && !isEmailStep && !isTruthStep && !isTextStep && question && (
            <div className="question-page">
              <p className="step-label">Step {page} of 6</p>
              <h1>{question.title}</h1>
              <div className="answer-list">
                {question.options.map((option, index) => (
                  <button
                    key={option}
                    className={`answer-option ${selected === index ? "selected" : ""}`}
                    type="button"
                    data-testid={`button-answer-${page}-${index}`}
                    aria-pressed={selected === index}
                    onClick={() => {
                      setSelected(index);
                      trackEvent("autopsy_funnel_answer", { funnel_step: page, answer_index: index });
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {selected !== null && question.decision && selected === 2 ? (
                <div className="decision-panel" role="status">
                  <strong>Then the Autopsy is the wrong tool for you, and we&apos;d rather say so.</strong>
                  <p>You don&apos;t have a silence problem. You&apos;re clearing the screen — the filter we diagnose isn&apos;t what&apos;s stopping you. Your gap is between the first conversation and the offer: interview performance, positioning, or negotiation.</p>
                  <p>We don&apos;t sell that and we&apos;re not going to pretend otherwise.</p>
                  <div className="decision-actions">
                    <button className="primary-button" type="button" data-testid="button-show-autopsy-anyway" onClick={() => goToPage(5)}>Show me anyway</button>
                    <button className="secondary-button" type="button" data-testid="button-close-decision" onClick={() => setSelected(null)}>That&apos;s fair — close</button>
                  </div>
                </div>
              ) : selected !== null ? <div className="insight" role="status">{question.insights[selected]}</div> : null}
            </div>
          )}

          {isTextStep && (
            <div className="question-page text-step">
              <p className="step-label">Step {page} of 6</p>
              <h1>
                {page === 5
                  ? "Paste a job description you were genuinely qualified for — and heard nothing about."
                  : "Last step. Paste the experience you sent them."}
              </h1>
              <p className="text-step-supporting">
                {page === 5
                  ? "Not the best one. A normal one you’d have been good at."
                  : "Rough is fine — we’re reading substance, not formatting."}
              </p>
              <textarea
                className="funnel-textarea"
                data-testid={page === 5 ? "textarea-job-description" : "textarea-experience"}
                value={currentText}
                onChange={(event) => setCurrentText(event.target.value)}
                placeholder={page === 5 ? "Paste the job posting here" : "Paste your resume or profile text..."}
                aria-label={page === 5 ? "Job description" : "Resume or profile text"}
              />
              {page === 6 && (
                <p className="privacy-copy">
                  We don’t store this to sell it, we don’t scrape LinkedIn, and we don’t apply anywhere on your behalf.
                </p>
              )}
              <button
                className="primary-button text-step-action"
                type="button"
                data-testid={page === 5 ? "button-read-job-description" : "button-see-verdict"}
                disabled={!currentText.trim()}
                onClick={nextPage}
              >
                {page === 5 ? "Read it" : "See my verdict"}
              </button>
            </div>
          )}

          {isEmailStep && (
            <form className="email-step" onSubmit={submitNewsletter} noValidate>
              <p className="step-label">Almost done</p>
              <h1>Where should we send the full Autopsy?</h1>
              <p className="email-supporting">Covers all six gap categories and the evidence behind each.</p>
              <label className="capture-label" htmlFor="autopsy-first-name">First name</label>
              <input
                id="autopsy-first-name"
                className="funnel-email"
                data-testid="input-autopsy-first-name"
                name="first_name"
                type="text"
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  if (formError) setFormError("");
                }}
                placeholder="Alex"
                autoComplete="given-name"
                disabled={isSubmitting}
                aria-invalid={Boolean(formError && !firstName.trim())}
                aria-describedby={formError ? "autopsy-form-error" : undefined}
                required
              />
              <label className="capture-label" htmlFor="autopsy-email">Email</label>
              <input
                id="autopsy-email"
                className="funnel-email"
                data-testid="input-autopsy-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (formError) setFormError("");
                }}
                placeholder="you@email.com"
                autoComplete="email"
                disabled={isSubmitting}
                aria-invalid={Boolean(formError && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))}
                aria-describedby={formError ? "autopsy-form-error" : undefined}
                required
              />
              <button className="primary-button text-step-action" type="submit" data-testid="button-send-autopsy" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send it"}
              </button>
              {formError && <div className="form-error" id="autopsy-form-error" role="alert">{formError}</div>}
            </form>
          )}

          {isTruthStep && (
            <div className="truth-step">
              <p className="step-label">The Truth Layer</p>
              <h1>You&apos;ve seen what&apos;s stopping you. This shows the rest.</h1>
              <p className="truth-supporting">Every gap category scored. Your Recruiter-Ready Brief. Re-run as you change things.</p>
              <div className="truth-price">$49.99<span>/month</span></div>
              <p className="truth-detail">Card now, first charge day 14 — after you&apos;ve used it. Cancel in one click.</p>
              <button className="primary-button text-step-action" type="button" data-testid="button-start-truth-layer">Start the Truth Layer</button>
            </div>
          )}
        </div>

        <div className="mobile-footer">
          <button
            className="footer-back"
            type="button"
            data-testid="button-funnel-back"
            onClick={() => goToPage(Math.max(0, page - 1))}
            disabled={page === 0 || isSubmitting}
          >
            Back
          </button>
          <span className="footer-step" data-testid="text-funnel-progress">{isIntro || isEmailStep || isTruthStep ? " " : `${page} / 6`}</span>
          {!isEmailStep && !isTruthStep ? (
            <button
              className="footer-next"
              type="button"
              data-testid="button-funnel-next"
              onClick={nextPage}
              disabled={!isIntro && (isTextStep ? !currentText.trim() : selected === null)}
            >
              Next
            </button>
          ) : <button className="footer-next" type="button" data-testid="button-funnel-next-disabled" disabled>Next</button>}
        </div>
      </section>
    </main>
  );
}