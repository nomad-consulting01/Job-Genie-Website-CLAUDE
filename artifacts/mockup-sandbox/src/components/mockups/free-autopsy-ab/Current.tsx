import { useState, type FormEvent } from "react";
import "./Current.css";

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

function IntakeForm({ onComplete }: { onComplete: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (firstName.trim() && email.trim()) onComplete();
  }

  return (
    <form className="mobile-form" onSubmit={submit}>
      <div className="mobile-form-intro">
        <span className="kicker">Open your case</span>
        <h2>Find the break before you apply again.</h2>
        <p>Two details. One private report. No résumé upload until you know what to redact.</p>
      </div>
      <label>
        First name
        <input
          name="first_name"
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="Alex"
          required
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@email.com"
          required
        />
      </label>
      <button className="primary-button" type="submit">Send me the free Autopsy <span aria-hidden="true">→</span></button>
      <small>Free · no card · unsubscribe anytime</small>
    </form>
  );
}

export function Current() {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [experience, setExperience] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const question = QUESTIONS[page - 1];
  const isIntro = page === 0;
  const isFinal = page === QUESTIONS.length;
  const isTextStep = page === 5 || page === 6;
  const currentText = page === 5 ? jobDescription : experience;
  const setCurrentText = page === 5 ? setJobDescription : setExperience;

  return (
    <main className="mobile-autopsy">
      <section className="mobile-screen" id="top">
        <div className="progress" aria-label={isIntro ? "Introduction" : `Step ${page} of 6`}>
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className={index <= page ? "active" : ""} />
          ))}
        </div>

        <div className="mobile-content">
          <div className="brand-line">
            <img className="brand-mark" src="/__mockup/images/logo.png" alt="" />
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
              <button className="primary-button hero-button" type="button" onClick={() => setPage(1)}>
                Run my free Autopsy <span aria-hidden="true">→</span>
              </button>
            </>
          )}
          {!isIntro && !isFinal && !isTextStep && (
            <div className="question-page">
              <p className="step-label">Step {page} of 6</p>
              <h1>{question.title}</h1>
              <div className="answer-list">
                {question.options.map((option, index) => (
                  <button
                    key={option}
                    className={`answer-option ${selected === index ? "selected" : ""}`}
                    type="button"
                    onClick={() => setSelected(index)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {selected !== null && question.decision && selected === 2 ? (
                <div className="decision-panel">
                  <strong>Then the Autopsy is the wrong tool for you, and we&apos;d rather say so.</strong>
                  <p>You don&apos;t have a silence problem. You&apos;re clearing the screen — the filter we diagnose isn&apos;t what&apos;s stopping you. Your gap is between the first conversation and the offer: interview performance, positioning, or negotiation.</p>
                  <p>We don&apos;t sell that and we&apos;re not going to pretend otherwise.</p>
                  <div className="decision-actions">
                    <button className="primary-button" type="button" onClick={() => setPage(5)}>Show me anyway</button>
                    <button className="secondary-button" type="button" onClick={() => setSelected(null)}>That&apos;s fair — close</button>
                  </div>
                </div>
              ) : selected !== null ? <div className="insight">{question.insights[selected]}</div> : null}
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
              <button className="primary-button text-step-action" type="button" disabled={!currentText.trim()}>
                {page === 5 ? "Read it" : "See my verdict"}
              </button>
            </div>
          )}
          {isFinal && !submitted && <IntakeForm onComplete={() => setSubmitted(true)} />}
          {submitted && (
            <div className="success-card" role="status">
              <span className="success-mark">✓</span>
              <strong>Your case is open.</strong>
              <p>Check your inbox for the upload instructions and your first fix.</p>
            </div>
          )}
        </div>

        <div className="mobile-footer">
          <button className="footer-back" type="button" onClick={() => { setPage(Math.max(0, page - 1)); setSelected(null); }} disabled={page === 0 || submitted}>Back</button>
          <span className="footer-step">{isIntro ? " " : `${page} / 6`}</span>
          {!isFinal && !submitted ? (
            <button
              className="footer-next"
              type="button"
              onClick={() => { setPage(Math.min(6, page + 1)); setSelected(null); }}
              disabled={!isIntro && (isTextStep ? !currentText.trim() : selected === null)}
            >
              {isIntro ? "Next" : "Next"}
            </button>
          ) : <span />}
        </div>
      </section>
    </main>
  );
}