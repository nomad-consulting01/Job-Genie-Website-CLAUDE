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
    title: "What kind of roles are you applying for?",
    options: ["Specialist roles", "Management roles", "Career changes", "A mix of roles"],
    insights: [
      "Specialist searches are often filtered by a very short list of signals. We'll find the missing one.",
      "We'll compare your leadership evidence with what the role brief is rewarding.",
      "Career-change searches need a different read than a generic résumé score.",
      "A mixed search can create mixed signals. We'll identify which target is breaking first.",
    ],
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
  const [submitted, setSubmitted] = useState(false);
  const question = QUESTIONS[page - 1];
  const isIntro = page === 0;
  const isFinal = page === QUESTIONS.length;

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
          {!isIntro && !isFinal && (
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
              {selected !== null && <div className="insight">{question.insights[selected]}</div>}
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
            <button className="footer-next" type="button" onClick={() => { setPage(Math.min(6, page + 1)); setSelected(null); }} disabled={!isIntro && selected === null}>
              {isIntro ? "Next" : "Next"}
            </button>
          ) : <span />}
        </div>
      </section>
    </main>
  );
}