import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { SEO } from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import { getVisitorId } from "../lib/abtest";
import "./FreeAutopsy3Page.css";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LOGO_PATH = `${import.meta.env.BASE_URL}logo.png`;

const goals = [
  { title: "Get replies", detail: "Applications going unanswered" },
  { title: "Move up", detail: "Same field, more seniority" },
  { title: "Change direction", detail: "A new field or function" },
  { title: "Leave quietly", detail: "Searching while employed" },
  { title: "Not sure yet", detail: "I’m still figuring it out" },
];
const situations = [
  { title: "Employed, searching", detail: "Balancing a search with work" },
  { title: "Between roles", detail: "Focused on the search" },
  { title: "Returning after a break", detail: "Finding a way back in" },
];
const durations = ["Under a month", "One to three months", "Three to six months", "Longer than six months"];
const volumes = ["Fewer than 10", "10–25", "26–50", "51–100", "More than 100"];
const channels = [
  { title: "Mostly public job boards", detail: "LinkedIn, Indeed and similar sites" },
  { title: "Mostly company career pages", detail: "Applying on employers’ websites" },
  { title: "Mostly specialist recruiters", detail: "Through recruiters in my field" },
  { title: "A mix, no clear pattern", detail: "A little of everything" },
];

type Answers = {
  goal: number | null;
  situation: number | null;
  redundant: boolean;
  duration: number | null;
  volume: number | null;
  channel: number | null;
};
type AnswerKey = "goal" | "situation" | "duration" | "volume" | "channel";
type SubmitStatus = "idle" | "submitting" | "error";

function ArrowRight() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ArrowLeft() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M17 10H4m5 5-5-5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function FreeAutopsy3Page() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    goal: null, situation: null, redundant: false, duration: null, volume: null, channel: null,
  });
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [formError, setFormError] = useState("");

  const isSubmitting = submitStatus === "submitting";
  const canAdvance =
    step === 0 ||
    (step === 1 && answers.goal !== null) ||
    (step === 2 && answers.situation !== null) ||
    (step === 3 && answers.duration !== null && answers.volume !== null) ||
    (step === 4 && answers.channel !== null) ||
    step === 5;

  function choose(key: AnswerKey, value: number, funnelStep: number) {
    setAnswers(previous => ({ ...previous, [key]: value }));
    trackEvent("autopsy_funnel_answer", { funnel_step: funnelStep, answer_index: value });
  }

  function advance() {
    if (!canAdvance || step >= 6) return;
    if (step === 0) trackEvent("autopsy_funnel_start", { funnel_step: 0 });
    setStep(previous => previous + 1);
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
      setStep(7);
    } catch {
      setSubmitStatus("error");
      setFormError("Something went wrong. Please try again.");
      trackEvent("newsletter_submit_error");
    }
  }

  function option(
    key: AnswerKey,
    index: number,
    title: string,
    detail?: string,
    compact = false,
  ) {
    return (
      <button
        key={title}
        type="button"
        className={`fa3-option${compact ? " fa3-option--compact" : ""}`}
        aria-pressed={answers[key] === index}
        data-testid={`button-autopsy3-${key}-${index}`}
        onClick={() => choose(key, index, step)}
      >
        <span><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
      </button>
    );
  }

  const stepLabel = step === 0 ? "Introduction" : step <= 4 ? `Question ${step} of 4` : step === 5 ? "Your reflection" : step === 6 ? "Stay in touch" : "Complete";
  const progress = step === 0 ? 8 : step === 7 ? 100 : Math.round((step / 6) * 100);

  return (
    <main className="fa3">
      <SEO
        title="Free Application Autopsy — See Where Your Job Search Is Stalling | Job Genie"
        description="Tell us what you want to change, how long you have been searching, and where you apply. Start your free Application Autopsy with a private, guided first step."
        canonicalUrl="https://www.job-genie.ai/free-autopsy3"
        pageType="landing"
        slug="free-autopsy3"
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" rel="stylesheet" />

      <header className="fa3-head">
        <div className="fa3-head-inner">
          <Link href="/" className="fa3-brand" data-testid="link-autopsy3-home">
            <img src={LOGO_PATH} alt="" /> <span>Job Genie</span>
          </Link>
          <span className="fa3-head-note">Application Autopsy</span>
        </div>
      </header>

      <div className="fa3-layout">
        <div className="fa3-device-wrap">
          <section className="fa3-device" aria-label="Job search check-in">
            <div className="fa3-device-top"><strong>Job Genie</strong><span data-testid="text-autopsy3-step">{stepLabel}</span></div>
            <div className="fa3-progress" role="progressbar" aria-label="Check-in progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
            <div className="fa3-panel" key={step}>
              {step === 0 && (
                <>
                  <p className="fa3-eyebrow">A better place to start</p>
                  <h1>Job applications going quiet? <em>Start with the pattern.</em></h1>
                  <p className="fa3-sub">Before changing your CV or sending another batch, take stock of what you’re trying to do and where your applications have gone.</p>
                  <div className="fa3-body">
                    <div className="fa3-intro-art"><span>Four short questions</span><strong>Your goal. Your situation. Your timeline. Your channels.</strong></div>
                  </div>
                  <div className="fa3-actions"><button className="fa3-primary" type="button" onClick={advance} data-testid="button-autopsy3-start">Start the check-in <ArrowRight /></button></div>
                </>
              )}
              {step === 1 && (
                <>
                  <p className="fa3-eyebrow">01 / Your goal</p>
                  <h2>What are you trying to change?</h2>
                  <p className="fa3-sub">Pick the closest fit. You can change it later.</p>
                  <div className="fa3-body"><div className="fa3-options fa3-options--grid">{goals.map((goal, index) => option("goal", index, goal.title, goal.detail))}</div></div>
                </>
              )}
              {step === 2 && (
                <>
                  <p className="fa3-eyebrow">02 / Your situation</p>
                  <h2>Where are you right now?</h2>
                  <p className="fa3-sub">The same search can feel very different depending on where you’re starting.</p>
                  <div className="fa3-body">
                    <div className="fa3-options">{situations.map((situation, index) => option("situation", index, situation.title, situation.detail))}</div>
                    <label className="fa3-situational">
                      <input type="checkbox" checked={answers.redundant} onChange={event => setAnswers(previous => ({ ...previous, redundant: event.target.checked }))} data-testid="checkbox-autopsy3-redundancy" />
                      <span><strong>I was made redundant recently</strong><small>Optional. Only include this if it’s relevant to you.</small></span>
                    </label>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <p className="fa3-eyebrow">03 / Your timeline</p>
                  <h2>How long has this been going on?</h2>
                  <p className="fa3-sub">An approximate answer is enough.</p>
                  <div className="fa3-body">
                    <div className="fa3-options">{durations.map((duration, index) => option("duration", index, duration, undefined, true))}</div>
                    <fieldset className="fa3-fieldset"><legend>Roughly how many applications have you sent?</legend>
                      <div className="fa3-volumes">{volumes.map((volume, index) => (
                        <button key={volume} type="button" className="fa3-volume" aria-pressed={answers.volume === index} onClick={() => choose("volume", index, step)} data-testid={`button-autopsy3-volume-${index}`}>{volume}</button>
                      ))}</div>
                    </fieldset>
                  </div>
                </>
              )}
              {step === 4 && (
                <>
                  <p className="fa3-eyebrow">04 / Your channels</p>
                  <h2>Where did those applications go?</h2>
                  <p className="fa3-sub">Think about where most went. A rough estimate is fine.</p>
                  <div className="fa3-body"><div className="fa3-options">{channels.map((channel, index) => option("channel", index, channel.title, channel.detail))}</div></div>
                </>
              )}
              {step === 5 && (
                <>
                  <p className="fa3-eyebrow">A moment to reflect</p>
                  <h2>There’s a pattern worth looking at.</h2>
                  <p className="fa3-sub">Here’s what you told us, without making a diagnosis from a few answers.</p>
                  <div className="fa3-body">
                    <div className="fa3-reflection" role="status" data-testid="status-autopsy3-reflection">
                      <p className="fa3-said">You’re looking to {answers.goal === 4 ? "find your next direction" : goals[answers.goal ?? 0].title.toLowerCase()}, are {situations[answers.situation ?? 0].title.toLowerCase()}, have been searching for {durations[answers.duration ?? 0].toLowerCase()}, and have sent {volumes[answers.volume ?? 0].toLowerCase()} applications.</p>
                      {answers.redundant && <p>You also mentioned a recent redundancy. That context belongs in any careful reading of your search, rather than being treated as a flaw in your experience.</p>}
                      <p>You said they went <strong>{channels[answers.channel ?? 0].title.toLowerCase()}</strong>. Where applications go matters as much as how many you send: different routes put your profile in front of different people and processes.</p>
                      <p>This is a place to start asking better questions, <strong>not a score or a reading of your CV.</strong> We haven’t seen your applications or how employers reviewed them.</p>
                    </div>
                  </div>
                </>
              )}
              {step === 6 && (
                <form className="fa3-form" onSubmit={submitNewsletter} noValidate>
                   <p className="fa3-eyebrow">Your next step</p>
                   <h2>Get the free Application Autopsy emails.</h2>
                   <p className="fa3-sub">Sign up for Job Genie’s Autopsy email series. This check-in doesn’t upload or score your CV, and your answers aren’t included in the signup.</p>
                  <div className="fa3-body">
                    <label className="fa3-label" htmlFor="fa3-first-name">First name</label>
                    <input className="fa3-input" id="fa3-first-name" name="first_name" type="text" autoComplete="given-name" placeholder="Your first name" value={firstName} onChange={event => { setFirstName(event.target.value); setFormError(""); }} disabled={isSubmitting} required aria-invalid={Boolean(formError && !firstName.trim())} aria-describedby={formError ? "fa3-form-error" : undefined} data-testid="input-autopsy3-first-name" />
                    <label className="fa3-label" htmlFor="fa3-email">Email address</label>
                    <input className="fa3-input" id="fa3-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => { setEmail(event.target.value); setFormError(""); }} disabled={isSubmitting} required aria-invalid={Boolean(formError && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))} aria-describedby={formError ? "fa3-form-error" : undefined} data-testid="input-autopsy3-email" />
                    {formError && <p className="fa3-error" role="alert" id="fa3-form-error" data-testid="status-autopsy3-error">{formError}</p>}
                  </div>
                  <div className="fa3-actions">
                     <button className="fa3-primary" type="submit" disabled={isSubmitting} data-testid="button-autopsy3-submit">{isSubmitting ? "Signing up…" : "Get the free Autopsy emails"} {!isSubmitting && <ArrowRight />}</button>
                    <p className="fa3-fine">By signing up, you agree to our <Link href="/privacy" data-testid="link-autopsy3-privacy-form">Privacy Policy</Link> and <Link href="/terms" data-testid="link-autopsy3-terms-form">Terms of Service</Link>.</p>
                  </div>
                </form>
              )}
              {step === 7 && (
                <>
                  <p className="fa3-eyebrow">All set</p>
                  <div className="fa3-success-mark"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                  <h2>Thanks, {firstName.trim()}.</h2>
                   <p className="fa3-sub">You’re signed up for Job Genie’s free Autopsy emails. Check your inbox.</p>
                  <div className="fa3-body"><div className="fa3-success-note"><strong>Your check-in was a reflection, not a CV assessment.</strong> Keep your answers in mind as you decide which part of your search to examine next.</div></div>
                  <div className="fa3-actions"><button className="fa3-primary" type="button" onClick={() => setStep(1)} data-testid="button-autopsy3-review">Review my answers <ArrowRight /></button></div>
                </>
              )}
              {step > 0 && step < 7 && <button type="button" className="fa3-back" onClick={() => setStep(previous => previous - 1)} disabled={isSubmitting} data-testid="button-autopsy3-back"><ArrowLeft /> Back</button>}
              {step > 0 && step < 6 && <div className="fa3-actions"><button className="fa3-primary" type="button" onClick={advance} disabled={!canAdvance} data-testid="button-autopsy3-continue">{step === 5 ? "Continue" : "Next question"} <ArrowRight /></button></div>}
            </div>
          </section>
        </div>

        <aside className="fa3-aside" aria-label="About this check-in">
          <p className="fa3-aside-kicker">The free check-in</p>
          <h2>Before you change your CV, <em>look at the search.</em></h2>
          <p className="fa3-aside-lead">It’s hard to know what to fix when every application ends in silence. Start by making the shape of your search visible — the goal, the volume, and the route you’ve been taking.</p>
          <div className="fa3-aside-card">
            <p className="fa3-aside-card-eyebrow">What this does — and doesn’t do</p>
            <div className="fa3-aside-row"><span>01</span><div><strong>Begin with your context</strong><p>Four short questions about your situation and your applications. No document needed.</p></div></div>
            <div className="fa3-aside-row"><span>02</span><div><strong>See your answers together</strong><p>A reflection on your search channels, not a prediction about an employer’s decision.</p></div></div>
            <div className="fa3-aside-row"><span>03</span><div><strong>Choose whether to stay in touch</strong><p>The final email signup is optional. You can read the reflection without joining.</p></div></div>
            <p className="fa3-aside-foot">This page does not read your CV, calculate a personal score, or know why a particular employer did not reply.</p>
          </div>
        </aside>
      </div>
      <footer className="fa3-footer"><span>© {new Date().getFullYear()} Job Genie</span><nav aria-label="Legal"><Link href="/privacy" data-testid="link-autopsy3-privacy">Privacy</Link><Link href="/terms" data-testid="link-autopsy3-terms">Terms</Link></nav></footer>
    </main>
  );
}