import { useState, type FormEvent } from "react";
import "./Current.css";

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
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="mobile-autopsy">
      <section className="mobile-screen" id="top">
        <div className="progress" aria-label="Step 1 of 4">
          <span className="active" /><span /><span /><span />
        </div>

        <div className="mobile-content">
          <div className="brand-line">
            <span className="brand-mark">JG</span>
            <span>JOB GENIE</span>
            <span className="case-label">CASE 01</span>
          </div>
          <p className="audience">For mid-career professionals getting no response</p>
          <h1>You didn&apos;t get rejected. <em>You got ranked.</em></h1>
          <p className="explanation">
            Recruiting platforms rank and label candidates rather than accepting or rejecting them.
            Run the 100-Application Autopsy and find out where you&apos;re sorting.
          </p>
          <div className="signal-row" aria-hidden="true">
            <span className="signal-dot" /><span>APPLICATION SILENCE DETECTED</span>
          </div>
          {!showForm && !submitted && (
            <button className="primary-button hero-button" type="button" onClick={() => setShowForm(true)}>
              Run my free Autopsy <span aria-hidden="true">→</span>
            </button>
          )}
          {showForm && !submitted && <IntakeForm onComplete={() => setSubmitted(true)} />}
          {submitted && (
            <div className="success-card" role="status">
              <span className="success-mark">✓</span>
              <strong>Your case is open.</strong>
              <p>Check your inbox for the upload instructions and your first fix.</p>
            </div>
          )}
        </div>

        <div className="mobile-footer">
          <button className="footer-back" type="button" onClick={() => setShowForm(false)} disabled={!showForm}>Back</button>
          <span className="footer-step">1 / 4</span>
          <button className="footer-next" type="button" onClick={() => setShowForm(true)}>{showForm ? "Submit" : "Next"}</button>
        </div>
      </section>
    </main>
  );
}