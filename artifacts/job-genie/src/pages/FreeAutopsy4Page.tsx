import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "wouter";
import { SEO } from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import { getVisitorId } from "../lib/abtest";
import "./FreeAutopsy4Page.css";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const tabs = [
  { id: "start", label: "Start", sub: "Lower the first ask" },
  { id: "verdict", label: "Verdict", sub: "Published computation" },
  { id: "evidence", label: "Evidence file", sub: "Yours to keep" },
  { id: "ledger", label: "Silence ledger", sub: "The reply field" },
] as const;
type TabId = (typeof tabs)[number]["id"];

const goals = [
  { t: "Get replies", d: "Applications going unanswered" },
  { t: "Move up", d: "Same field, more seniority" },
  { t: "Change direction", d: "New field or function" },
  { t: "Leave quietly", d: "Employed, searching discreetly" },
];

const SAMPLE_TEXT = `SAMPLE EVIDENCE FILE - illustrative preview, not a visitor result

Supplier reporting
Was: Responsible for weekly supplier reporting.
Now: Consolidated six supplier reporting streams into a single tracker, removing about six hours of manual rework a week for a four-person finance team.

Vendor consolidation
Was: Managed vendor relationships across the portfolio.
Now: Renegotiated the three largest logistics contracts at renewal, holding rates flat against a proposed increase.

Every figure is illustrative.
`;

export default function FreeAutopsy4Page() {
  const [tab, setTab] = useState<TabId>("start");
  const [goal, setGoal] = useState(0);
  const [notes, setNotes] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [error, setError] = useState("");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: TabId, focus = false) {
    setTab(id);
    window.scrollTo({ top: 0 });
    if (focus) tabRefs.current[id]?.focus();
  }

  function onKey(e: KeyboardEvent, i: number) {
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i + tabs.length - 1) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    select(tabs[n].id, true);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([SAMPLE_TEXT], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-evidence-file.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function jumpSignup() {
    const el = document.getElementById("fa4-signup");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("fa4-first-name")?.focus({ preventScroll: true });
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    const fn = firstName.trim();
    const em = email.trim();
    if (!fn) return setError("Please enter your first name.");
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setError("Please enter a valid email address.");
    setError("");
    setStatus("submitting");
    trackEvent("newsletter_submit_attempt");
    const q = new URLSearchParams(window.location.search);
    try {
      const r = await fetch(`${API_BASE}/api/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: fn,
          email: em,
          page_slug: window.location.pathname,
          visitor_id: getVisitorId(),
          lead_magnet: "100-application-autopsy",
          utm_source: q.get("utm_source") ?? undefined,
          utm_medium: q.get("utm_medium") ?? undefined,
          utm_campaign: q.get("utm_campaign") ?? undefined,
          utm_content: q.get("utm_content") ?? undefined,
          utm_term: q.get("utm_term") ?? undefined,
        }),
      });
      if (!r.ok) throw new Error("fail");
      setStatus("success");
      trackEvent("newsletter_submit_success");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
      trackEvent("newsletter_submit_error");
    }
  }

  const Note = ({ title, children }: { title: string; children: string }) =>
    notes ? (
      <div className="fa4-note" data-testid={`note-${title.split(" ")[1] ?? "x"}`}>
        <b>{title}</b>
        <p>{children}</p>
      </div>
    ) : null;

  const panelProps = (id: TabId) => ({
    role: "tabpanel" as const,
    id: `fa4-panel-${id}`,
    "aria-labelledby": `fa4-tab-${id}`,
    hidden: tab !== id,
    tabIndex: 0,
  });

  return (
    <div className="fa4">
      <SEO
        title="Free Application Autopsy — Explore the Score, Evidence & Silence Ledger | Job Genie"
        description="Explore Job Genie’s Application Autopsy through an interactive preview: score breakdown, reusable evidence, and a reply-focused application ledger."
        canonicalUrl="https://www.job-genie.ai/free-autopsy4"
        pageType="landing"
        slug="free-autopsy4"
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Sora:wght@500;600;700&display=swap" rel="stylesheet" />

      <div className="fa4-app">
        <nav className="fa4-rail" aria-label="Sections">
          <div className="fa4-brand">
            <Link href="/" data-testid="link-autopsy4-home" style={{ color: "inherit", textDecoration: "none" }}>Job Genie</Link>
            <span>Application Autopsy preview</span>
          </div>
          <div className="fa4-nav" role="tablist" aria-label="Product preview views" aria-orientation="vertical">
            {tabs.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`fa4-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`fa4-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                ref={el => { tabRefs.current[t.id] = el; }}
                onClick={() => select(t.id)}
                onKeyDown={e => onKey(e, i)}
                data-testid={`tab-autopsy4-${t.id}`}
              >
                {t.label}
                <small>{t.sub}</small>
              </button>
            ))}
          </div>
          <div className="fa4-railfoot">Prototype. Every figure shown is illustrative.</div>
        </nav>

        <main className="fa4-main">
          <div className="fa4-banner" data-testid="label-autopsy4-sample">
            <span className="fa4-sample">Sample data / Interactive product preview</span>
            <span>Every figure is illustrative. This is not your result, and nothing here reads your applications or inbox.</span>
          </div>
          <div className="fa4-top">
            <div className="fa4-case">Sample: Programme Manager search, opened <b>14 September</b> — 63 applications recorded</div>
            <div className="fa4-topr">
              <label className="fa4-toggle">
                <input type="checkbox" checked={notes} onChange={e => setNotes(e.target.checked)} data-testid="checkbox-autopsy4-notes" /> Design notes
              </label>
              <button type="button" className="fa4-cta" onClick={jumpSignup} data-testid="button-autopsy4-header-cta">Get the free Autopsy emails</button>
            </div>
          </div>

          <div className="fa4-wrap">
            <section {...panelProps("start")}>
              <h1>What are you trying to change?</h1>
              <p className="fa4-lede">One tap. It sets what the verdict is measured against — and nothing is uploaded yet.</p>
              <Note title="Move 4 — lower the first ask">MyJobsSearch opens with a pasted job description. The current Autopsy opens with a résumé upload, which is the heaviest possible first step on cold traffic. Four taps come first here, so the upload arrives after the person can see where it goes.</Note>
              <div className="fa4-panel"><div className="fa4-pbody">
                <div className="fa4-tiles" role="group" aria-label="Goal (sample selection)">
                  {goals.map((g, i) => (
                    <button key={g.t} type="button" className="fa4-tile" aria-pressed={goal === i} onClick={() => setGoal(i)} data-testid={`button-autopsy4-goal-${i}`}>
                      <b>{g.t}</b><small>{g.d}</small>
                    </button>
                  ))}
                </div>
              </div></div>
              <div className="fa4-panel">
                <div className="fa4-phead"><h3>Worth pausing on</h3><span>after question three</span></div>
                <div className="fa4-pbody">
                  <p style={{ margin: "0 0 10px", color: "var(--muted)" }}>You said most of these went to public job boards, over about three months.</p>
                  <p style={{ margin: "0 0 10px" }}>That narrows things immediately. Three of the eight causes need a longer history to show up at all, so they're already unlikely for you.</p>
                  <p style={{ margin: 0 }}>It also means the channel is worth testing before the document is. There's no point rewriting a CV that's being read by the wrong people.</p>
                  <button type="button" className="fa4-btn" onClick={() => select("verdict")} data-testid="button-autopsy4-keep-going">Keep going</button>
                </div>
              </div>
              <Note title="Why this screen exists">It pays the person back for questions already answered, which is the main lever on mid-flow abandonment. It costs no new data and makes no new claim.</Note>
            </section>

            <section {...panelProps("verdict")}>
              <h1>Your Application Silence Score</h1>
              <p className="fa4-lede">The band, the three measurements behind it, and the arithmetic that turns one into the other.</p>
              <Note title="Move 1 — publish the computation">Job Pal scores 0–100. MyJobsSearch grades a JD match. CareerForge scores out of 100. None of them publishes how. This panel is the thing none of them can copy without doing the work.</Note>
              <div className="fa4-panel">
                <div className="fa4-vhead">
                  <div className="fa4-lbl">Application Silence Score (sample, not your result)</div>
                  <div className="fa4-score">HIGH</div>
                  <p>Channel mismatch is the strongest signal in your case. Your evidence reads well enough that the document is unlikely to be the first problem.</p>
                  <span className="fa4-conf">Moderate confidence — 63 applications, one channel dominant</span>
                </div>
                <div className="fa4-scroll"><table className="fa4-calc">
                  <thead><tr><th>Blocker</th><th>What we measured</th><th>Weight</th><th>Contribution</th></tr></thead>
                  <tbody>
                    <tr><td><b>Channel mismatch</b><span className="fa4-sub">Where your applications went</span></td><td>81% public boards<span className="fa4-sub">against 34% typical at this seniority</span></td><td>0.45</td><td>36.5</td></tr>
                    <tr><td><b>Ghost-job exposure</b><span className="fa4-sub">Postings no longer being filled</span></td><td>9 of 63 unresolvable<span className="fa4-sub">reposted or withdrawn</span></td><td>0.20</td><td>2.9</td></tr>
                    <tr><td><b>Evidence legibility</b><span className="fa4-sub">Recruiter-Fit, 35 of 40</span></td><td>12.5% below band ceiling<span className="fa4-sub">two dimensions under 4</span></td><td>0.35</td><td>4.4</td></tr>
                  </tbody>
                  <tfoot><tr><td colSpan={3}>Combined</td><td className="fa4-band">43.8 = HIGH</td></tr></tfoot>
                </table></div>
                <div className="fa4-pbody" style={{ borderTop: "1px solid var(--rule)" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 14 }}>Bands: under 15 LOW, 15 to 34 MEDIUM, 35 and above HIGH.</p>
                  <div className="fa4-model"><b>These weights are our own model.</b> No study establishes how these three factors should be balanced. We set them from what specialist recruiters describe as disqualifying, and we will revise them against outcome data as it accumulates — publishing the revision when we do.</div>
                </div>
              </div>
              <div className="fa4-panel">
                <div className="fa4-phead"><h3>What we ruled out, and why</h3><span>four of eight causes</span></div>
                <div className="fa4-scroll"><table><tbody>
                  <tr><td><b>Achievement legibility</b></td><td className="fa4-num">scored 4 of 5 — not it</td></tr>
                  <tr><td><b>Title lineage</b></td><td className="fa4-num">progression is clean</td></tr>
                  <tr><td><b>Active-candidate penalty</b></td><td className="fa4-num">too short a history</td></tr>
                  <tr><td><b>Role economics</b></td><td className="fa4-num">target band is realistic</td></tr>
                </tbody></table></div>
              </div>
            </section>

            <section {...panelProps("evidence")}>
              <h1>Your evidence file</h1>
              <p className="fa4-lede">Built once from what you confirmed. Reused on every application. Yours whether or not you subscribe.</p>
              <Note title="Move 2 — reframe the Truth Layer as something owned">MyJobsSearch calls theirs an Achievement Library: a store the user accumulates and returns to. Ours is currently a per-run output. Same artefact, different relationship — theirs is a thing you keep, ours is a thing you receive. The second is worth less for the same work.</Note>
              <div className="fa4-panel">
                <div className="fa4-phead"><h3>Supplier reporting</h3><span>confirmed 22 September</span></div>
                <div className="fa4-pbody">
                  <p style={{ margin: "0 0 6px", fontSize: 13.5, color: "var(--muted)" }}>We asked: what did you change about the weekly pack, and what happened afterwards?</p>
                  <div className="fa4-bullet">
                    <div className="fa4-was">Responsible for weekly supplier reporting.</div>
                    <div className="fa4-now">Consolidated six supplier reporting streams into a single tracker, removing about six hours of manual rework a week for a four-person finance team.</div>
                  </div>
                  <div className="fa4-ver"><span>Used in 11 applications</span><span>Last edited 29 September</span><span>Confirmed by you</span></div>
                </div>
              </div>
              <div className="fa4-panel">
                <div className="fa4-phead"><h3>Vendor consolidation</h3><span>confirmed 22 September</span></div>
                <div className="fa4-pbody">
                  <div className="fa4-bullet">
                    <div className="fa4-was">Managed vendor relationships across the portfolio.</div>
                    <div className="fa4-now">Renegotiated the three largest logistics contracts at renewal, holding rates flat against a proposed increase.</div>
                  </div>
                  <div className="fa4-ver"><span>Used in 7 applications</span><span>Last edited 24 September</span><span>Confirmed by you</span></div>
                </div>
              </div>
              <div className="fa4-keep">
                <b>This file is yours</b>
                Concept note: the idea is that you could export your evidence at any time and keep it if you cancel. This is a product direction shown in a preview, not a delivered account feature, and no Word or PDF export exists here.
                <div><button type="button" className="fa4-link" onClick={download} data-testid="button-autopsy4-download-sample">Download the sample as plain text</button></div>
              </div>
            </section>

            <section {...panelProps("ledger")}>
              <h1>Silence ledger</h1>
              <p className="fa4-lede">Every application, and how long it has been quiet. Replies arrive from your inbox or a forwarding address.</p>
              <Note title="Move 3 — the reply field">Five competitors ship an application tracker: CareerForge, dojob, Submit4Me, Job Pal, MyJobsSearch. None of them records whether anyone replied. That column is the whole difference, and the inference built on top of it is the part that can't be copied in a sprint.</Note>
              <p className="fa4-fine" style={{ marginTop: 0, marginBottom: 12 }}>Inbox and forwarding-address replies are a concept shown in this preview. Nothing here connects to your inbox.</p>
              <div className="fa4-panel">
                <div className="fa4-phead"><h3>63 applications</h3><span>31 silent past day 10</span></div>
                <div className="fa4-scroll"><table>
                  <thead><tr><th>Role</th><th>Sent</th><th>Channel</th><th>Reply</th><th className="fa4-num">Silent for</th></tr></thead>
                  <tbody>
                    <tr><td><b>Programme Manager</b><span className="fa4-sub">Retail bank</span></td><td>12 Sep</td><td>Job board</td><td><span className="fa4-flag">No acknowledgement</span></td><td className="fa4-num fa4-flag">19 days</td></tr>
                    <tr><td><b>Senior PM, Transformation</b><span className="fa4-sub">Insurer</span></td><td>15 Sep</td><td>Job board</td><td>Auto-acknowledgement only</td><td className="fa4-num fa4-flag">16 days</td></tr>
                    <tr><td><b>Delivery Lead</b><span className="fa4-sub">Logistics group</span></td><td>18 Sep</td><td>Specialist agency</td><td className="fa4-ok">Recruiter replied, 2 days</td><td className="fa4-num">—</td></tr>
                    <tr><td><b>PMO Manager</b><span className="fa4-sub">Utilities</span></td><td>21 Sep</td><td>Careers page</td><td>Rejected after 9 days</td><td className="fa4-num">—</td></tr>
                    <tr><td><b>Programme Manager</b><span className="fa4-sub">Healthcare provider</span></td><td>26 Sep</td><td>Job board</td><td>Auto-acknowledgement only</td><td className="fa4-num">5 days</td></tr>
                  </tbody>
                </table></div>
              </div>
              <div className="fa4-panel">
                <div className="fa4-phead"><h3>What the pattern suggests</h3><span>day 10 and beyond</span></div>
                <div className="fa4-pbody">
                  <div className="fa4-scroll"><table><tbody>
                    <tr><td><b>No acknowledgement at all</b></td><td>Never entered the system, or the board submission stopped there</td></tr>
                    <tr><td><b>Auto-acknowledgement, then nothing</b></td><td>Ranked below the point where recruiters stopped reading</td></tr>
                    <tr><td><b>Rejected within two days</b></td><td>A near-automated screen decision</td></tr>
                    <tr><td><b>Rejected after a week or more</b></td><td>A person looked, and passed</td></tr>
                  </tbody></table></div>
                  <div className="fa4-model" style={{ marginTop: 16 }}><b>Ten days is our threshold, not a finding.</b> We chose it because it sits past the typical acknowledgement window and short of the point where most people give up. We'll revise it once the ledger holds enough applications to show where replies actually stop.</div>
                </div>
              </div>
            </section>
          </div>

          <section className="fa4-signup" id="fa4-signup" aria-labelledby="fa4-signup-h" data-testid="section-autopsy4-signup">
            <h2 id="fa4-signup-h" style={{ marginTop: 0 }}>Get the free Application Autopsy emails</h2>
            <p className="fa4-lede" style={{ marginBottom: 12 }}>Sign up for Job Genie’s Autopsy email series. The sample above isn’t sent with your signup, and nothing is uploaded or scored.</p>
            {status === "success" ? (
              <div className="fa4-success" role="status" data-testid="status-autopsy4-success">
                <b>Thanks, {firstName.trim()}.</b> You’re signed up for Job Genie’s free Autopsy emails. Check your inbox.
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <label className="fa4-label" htmlFor="fa4-first-name">First name</label>
                <input className="fa4-input" id="fa4-first-name" name="first_name" type="text" autoComplete="given-name" required value={firstName} onChange={e => { setFirstName(e.target.value); setError(""); }} disabled={status === "submitting"} aria-invalid={Boolean(error && !firstName.trim())} aria-describedby={error ? "fa4-error" : undefined} data-testid="input-autopsy4-first-name" />
                <label className="fa4-label" htmlFor="fa4-email">Email address</label>
                <input className="fa4-input" id="fa4-email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} disabled={status === "submitting"} aria-invalid={Boolean(error && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))} aria-describedby={error ? "fa4-error" : undefined} data-testid="input-autopsy4-email" />
                {error && <p className="fa4-err" role="alert" id="fa4-error" data-testid="status-autopsy4-error">{error}</p>}
                <button type="submit" className="fa4-btn" style={{ marginTop: 16 }} disabled={status === "submitting"} data-testid="button-autopsy4-submit">{status === "submitting" ? "Signing up…" : "Get the free Autopsy emails"}</button>
                <p className="fa4-fine">By signing up, you agree to our <Link href="/privacy" data-testid="link-autopsy4-privacy">Privacy Policy</Link> and <Link href="/terms" data-testid="link-autopsy4-terms">Terms of Service</Link>.</p>
              </form>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
