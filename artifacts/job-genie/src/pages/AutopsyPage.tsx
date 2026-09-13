import { useEffect, useRef, useState, type FormEvent } from "react";
import { SEO } from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import { getVisitorId } from "../lib/abtest";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CSS = `
.ap{
  --navy:#090D19;
  --surface:#10162a;
  --surface-2:#141b33;
  --line:#232c48;
  --indigo:#7C83FF;
  --indigo-soft:rgba(124,131,255,.14);
  --indigo-glow:rgba(124,131,255,.45);
  --silent:#1a2138;
  --ap-text:#EEF0FA;
  --muted:#9298b3;
  --muted-2:#6f7690;
  --maxw:1080px;
  background:var(--navy);
  color:var(--ap-text);
  font-family:"DM Sans",system-ui,sans-serif;
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
  min-height:100vh;
}
.ap *{box-sizing:border-box}
.ap a{color:inherit}
.ap .wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
.ap .mono{font-family:"JetBrains Mono",ui-monospace,monospace;letter-spacing:.04em}
.ap .eyebrow{
  font-family:"JetBrains Mono",monospace;
  font-size:12px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--indigo);
  display:inline-flex;align-items:center;gap:10px;
}
.ap .eyebrow::before{content:"";width:26px;height:1px;background:var(--indigo);opacity:.6}
.ap h1,.ap h2,.ap h3{font-family:"Sora",sans-serif;line-height:1.08;letter-spacing:-.02em}

/* HERO */
.ap header.hero{position:relative;padding:34px 0 96px}
.ap .topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 0 64px}
.ap .brand{font-family:"Sora";font-weight:800;font-size:19px;letter-spacing:-.01em}
.ap .brand span{color:var(--indigo)}
.ap .topbar .navlink{font-size:14px;color:var(--muted);text-decoration:none}
.ap .topbar .navlink:hover{color:var(--ap-text)}
.ap .hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:56px;align-items:center}
.ap h1{font-weight:800;font-size:clamp(34px,5vw,58px)}
.ap h1 .kill{color:var(--indigo)}
.ap .sub{margin-top:22px;font-size:clamp(16px,1.6vw,19px);color:var(--muted);max-width:34ch}
.ap .optin{margin-top:34px;max-width:440px}
.ap .optin-fields{display:grid;gap:12px}
.ap .optin-field{display:grid;gap:7px}
.ap .optin-field label{font-family:"Sora";font-size:13px;font-weight:600;color:var(--ap-text)}
.ap .optin-field input{width:100%;background:var(--surface);border:1px solid var(--line);border-radius:10px;color:var(--ap-text);font-family:"DM Sans";font-size:16px;outline:none;padding:14px 16px;transition:border-color .2s,box-shadow .2s}
.ap .optin-field input:focus{border-color:var(--indigo);box-shadow:0 0 0 4px var(--indigo-soft)}
.ap .optin-field input::placeholder{color:var(--muted-2)}
.ap .optin .btn-ap{width:100%;margin-top:12px}
.ap .optin-status{margin-top:12px;font-size:14px;color:var(--muted)}
.ap .optin-status.error{color:#ff8585}
.ap .btn-ap{
  font-family:"Sora";font-weight:700;font-size:15px;
  background:var(--indigo);color:#0a0e1c;border:0;border-radius:9px;
  padding:13px 20px;cursor:pointer;white-space:nowrap;
  transition:transform .12s ease,box-shadow .2s ease;
  box-shadow:0 8px 24px -8px var(--indigo-glow);
}
.ap .btn-ap:hover{transform:translateY(-1px);box-shadow:0 12px 30px -8px var(--indigo-glow)}
.ap .btn-ap:active{transform:translateY(0)}
.ap .btn-ap:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ap .btn-ap:disabled{opacity:.6;cursor:default;transform:none}
.ap .micro{margin-top:12px;font-size:13px;color:var(--muted-2);display:flex;gap:16px;flex-wrap:wrap}
.ap .micro span{display:inline-flex;align-items:center;gap:6px}
.ap .micro .dot{width:5px;height:5px;border-radius:50%;background:var(--indigo);opacity:.7}

/* SILENCE GRID */
.ap .autopsy-card{
  background:linear-gradient(180deg,var(--surface),var(--navy));
  border:1px solid var(--line);border-radius:20px;padding:24px;
}
.ap .card-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}
.ap .card-head .label{font-family:"JetBrains Mono";font-size:11px;letter-spacing:.12em;color:var(--muted);text-transform:uppercase}
.ap .card-head .case{font-family:"JetBrains Mono";font-size:11px;color:var(--indigo)}
.ap .grid100{display:grid;grid-template-columns:repeat(10,1fr);gap:5px}
.ap .cell{aspect-ratio:1;border-radius:3px;background:var(--silent);opacity:.35;transform:scale(.6);transition:transform .3s ease,opacity .3s ease,background .3s ease}
.ap .cell.on{opacity:1;transform:scale(1)}
.ap .cell.reply{background:var(--indigo);box-shadow:0 0 10px -1px var(--indigo-glow)}
.ap .card-foot{margin-top:16px;font-family:"JetBrains Mono";font-size:11.5px;color:var(--muted);letter-spacing:.03em;display:flex;gap:14px;flex-wrap:wrap}
.ap .card-foot b{color:var(--ap-text);font-weight:500}
.ap .card-foot .rep{color:var(--indigo)}

/* SECTIONS */
.ap section{padding:88px 0}
.ap .section-head{max-width:46ch;margin-bottom:44px}
.ap .section-head h2{font-size:clamp(26px,3.4vw,40px);font-weight:700;margin-top:16px}
.ap .section-head p{margin-top:16px;color:var(--muted);font-size:17px}
.ap .verdict{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--surface)}
.ap .verdict h2{font-size:clamp(26px,4vw,44px);font-weight:700;max-width:20ch}
.ap .verdict h2 em{font-style:normal;color:var(--indigo)}
.ap .verdict p{margin-top:22px;color:var(--muted);font-size:18px;max-width:52ch}
.ap .findings{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.ap .finding{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:26px;transition:border-color .2s,transform .2s}
.ap .finding:hover{border-color:var(--indigo);transform:translateY(-3px)}
.ap .finding .tag{font-family:"JetBrains Mono";font-size:11px;color:var(--indigo);letter-spacing:.1em}
.ap .finding h3{font-size:20px;font-weight:700;margin:14px 0 10px}
.ap .finding p{color:var(--muted);font-size:15px}
.ap .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:0}
.ap .step{padding:28px 26px 28px 0;border-top:1px solid var(--line)}
.ap .step .num{font-family:"JetBrains Mono";font-size:13px;color:var(--indigo);letter-spacing:.1em}
.ap .step h3{font-size:19px;font-weight:700;margin:16px 0 10px}
.ap .step p{color:var(--muted);font-size:15px;max-width:32ch}
.ap .privacy{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center;background:var(--indigo-soft);border:1px solid var(--line);border-radius:20px;padding:30px 34px}
.ap .privacy .shield{width:42px;height:42px;color:var(--indigo);flex:none}
.ap .privacy .eyebrow{margin-bottom:10px}
.ap .privacy h3{font-family:"Sora";font-size:clamp(19px,2.4vw,25px);font-weight:700;line-height:1.2;letter-spacing:-.01em}
.ap .privacy p{margin-top:12px;color:var(--muted);font-size:16px;max-width:66ch}
.ap .privacy em{font-style:normal;color:var(--indigo)}
.ap .record{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
.ap .record h2{font-size:clamp(24px,3vw,34px);font-weight:700}
.ap .record .price{margin-top:18px;font-family:"JetBrains Mono";color:var(--indigo);font-size:14px;letter-spacing:.05em}
.ap .record ul{list-style:none;display:grid;gap:14px}
.ap .record li{display:flex;gap:12px;align-items:flex-start;font-size:16px}
.ap .record li .chk{flex:none;width:20px;height:20px;border-radius:50%;background:var(--indigo-soft);color:var(--indigo);display:grid;place-items:center;font-size:12px;margin-top:2px}
.ap .proof{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.ap .quote{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:26px;border-left:2px solid var(--indigo)}
.ap .quote p{font-size:15px;color:var(--ap-text)}
.ap .quote .who{margin-top:16px;font-family:"JetBrains Mono";font-size:12px;color:var(--muted)}
.ap .faq{display:grid;gap:2px;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.ap .qa{background:var(--surface)}
.ap .qa summary{padding:22px 24px;cursor:pointer;font-family:"Sora";font-weight:600;font-size:17px;list-style:none;display:flex;justify-content:space-between;align-items:center}
.ap .qa summary::-webkit-details-marker{display:none}
.ap .qa summary::after{content:"+";color:var(--indigo);font-size:22px;font-weight:400}
.ap .qa[open] summary::after{content:"–"}
.ap .qa .ans{padding:0 24px 22px;color:var(--muted);font-size:15px;max-width:60ch}
.ap .final{text-align:center;background:radial-gradient(120% 100% at 50% 0%,var(--surface-2),var(--navy) 70%);border-top:1px solid var(--line)}
.ap .final h2{font-size:clamp(28px,4vw,46px);font-weight:800;max-width:16ch;margin:0 auto}
.ap .final .optin{margin:32px auto 0}
.ap .final .micro{justify-content:center}
.ap footer{border-top:1px solid var(--line);padding:40px 0;color:var(--muted-2);font-size:13px}
.ap .foot-row{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.ap footer a{color:var(--muted);text-decoration:none;margin-left:20px}
.ap footer a:hover{color:var(--ap-text)}
.ap .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);opacity:0;background:var(--indigo);color:#0a0e1c;font-family:"Sora";font-weight:600;padding:14px 22px;border-radius:12px;transition:.3s ease;pointer-events:none;z-index:50;font-size:15px}
.ap .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.ap .toast.error{background:#ff5f5f;color:#fff}
@media(max-width:860px){
  .ap .hero-grid{grid-template-columns:1fr;gap:40px}
  .ap .findings,.ap .proof{grid-template-columns:1fr}
  .ap .steps{grid-template-columns:1fr}
  .ap .record{grid-template-columns:1fr;padding:28px}
  .ap .privacy{grid-template-columns:1fr;gap:16px;padding:24px}
  .ap .topbar{padding-bottom:40px}
  .ap .sub{max-width:none}
}
@media(prefers-reduced-motion:reduce){
  .ap .cell{opacity:1;transform:none;transition:none}
}
`;

function AutopsyForm({ id }: { id?: string }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      setStatus("success");
      setFirstName("");
      setEmail("");
      trackEvent("newsletter_submit_success");
    } catch {
      setStatus("error");
      trackEvent("newsletter_submit_error");
    }
  }

  return (
    <form className="optin" id={id} onSubmit={handleSubmit}>
      <div className="optin-fields">
        <div className="optin-field">
          <label htmlFor={`${id ?? "final"}-first-name`}>First name</label>
          <input
            id={`${id ?? "final"}-first-name`}
            name="first_name"
            type="text"
            autoComplete="given-name"
            placeholder="Alex"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </div>
        <div className="optin-field">
          <label htmlFor={`${id ?? "final"}-email`}>Email</label>
          <input
            id={`${id ?? "final"}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
      </div>
      <button className="btn-ap" type="submit" disabled={status === "submitting" || status === "success"}>
        {status === "submitting" ? "Sending…" : status === "success" ? "Check your inbox!" : "Get my free Autopsy →"}
      </button>
      <div className="micro">
        <span><i className="dot" />Free · no card</span>
        <span><i className="dot" />Unsubscribe anytime</span>
      </div>
      {status === "error" && <p className="optin-status error" role="alert">Something went wrong. Please try again.</p>}
    </form>
  );
}

const REPLIES = [7, 19, 34, 58, 71, 88];

export default function AutopsyPage() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const grid = gridRef.current;
    if (!grid) return;
    for (let i = 0; i < 100; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      grid.appendChild(cell);
      const delay = prefersReduced ? 0 : 200 + i * 11;
      setTimeout(() => {
        cell.classList.add("on");
        if (REPLIES.includes(i)) cell.classList.add("reply");
      }, delay);
    }
    return () => { grid.innerHTML = ""; };
  }, []);

  return (
    <div className="ap">
      <SEO
        title="The 100-Application Autopsy — Job Genie"
        description="Free. Find out exactly where your job applications died — the résumé screen, the recruiter pass, or the void — and get your first fix in about 10 minutes."
        canonical="https://www.job-genie.ai/free-autopsy"
      />

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <header className="hero">
        <div className="wrap">
          <div className="topbar">
            <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="nlogo">
                <img src="/logo.png" alt="Job Genie" style={{ width: 36, height: 36, objectFit: "contain" }} />
                Job Genie
              </div>
            </a>
            <a href="#autopsy" className="navlink">Get my free Autopsy →</a>
          </div>

          <div className="hero-grid">
            <div>
              <span className="eyebrow">Free · The 100-Application Autopsy</span>
              <h1>You sent 100 applications. Something <span className="kill">killed them</span> before a human ever read one.</h1>
              <p className="sub">The Autopsy shows you exactly where your applications died — the résumé screen, the recruiter pass, or the void — and why. Then it hands you the first fix. About 10 minutes.</p>

              <AutopsyForm id="autopsy" />
            </div>

            <div className="autopsy-card" aria-hidden="true">
              <div className="card-head">
                <span className="label">Application record</span>
                <span className="case">CASE · SILENCE</span>
              </div>
              <div className="grid100" ref={gridRef} />
              <div className="card-foot">
                <span><b>100</b> sent</span>
                <span className="rep"><b className="rep">a few</b> replied</span>
                <span>the rest — <b>Application&nbsp;Silence</b></span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="verdict">
        <div className="wrap">
          <span className="eyebrow">The verdict</span>
          <h2>Silence isn't a rejection. It's a <em>diagnosis you never got.</em></h2>
          <p>When applications vanish, the instinct is to blame yourself — the résumé, the wording, your worth. But Application Silence is a system problem, not a you problem. You're being filtered by a process that was never built to read you generously. The Autopsy shows you the filter, so you stop rewriting the same résumé for the tenth time and fix the thing that's actually costing you callbacks.</p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">The findings</span>
            <h2>Three things the Autopsy pulls out of your last 100 applications.</h2>
          </div>
          <div className="findings">
            <div className="finding">
              <span className="tag">FINDING · 01</span>
              <h3>Your Application Silence Score</h3>
              <p>How much of your silence is coming from the filter versus genuine fit — so you know whether to fix your targeting or your positioning.</p>
            </div>
            <div className="finding">
              <span className="tag">FINDING · 02</span>
              <h3>The Recruiter-Fit Gap</h3>
              <p>The gap between being a fit and reading as a fit to a recruiter skimming for eight seconds. That gap is where most silence actually happens.</p>
            </div>
            <div className="finding">
              <span className="tag">FINDING · 03</span>
              <h3>Cause of death, by stage</h3>
              <p>Where each application died — the résumé screen, the recruiter pass, or a ghost posting that was never really hiring.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">The procedure</span>
            <h2>Upload your résumé. We compare it to the recruiter's brief. You read the findings.</h2>
          </div>
          <div className="steps">
            <div className="step">
              <span className="num">STEP 01</span>
              <h3>Upload your résumé — minus your details</h3>
              <p>Strip your name, phone, email, and home address first if you want. The Autopsy only reads your experience.</p>
            </div>
            <div className="step">
              <span className="num">STEP 02</span>
              <h3>We match it to a specialty recruiter's role brief</h3>
              <p>Your experience, compared against what a recruiter for that specialty is actually screening for — the Recruiter-Fit Matrix.</p>
            </div>
            <div className="step">
              <span className="num">STEP 03</span>
              <h3>You get findings + your first fix</h3>
              <p>Your Silence Score, your Fit Gap, and the single highest-leverage change to make next.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="privacy">
            <svg className="shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            <div>
              <span className="eyebrow">Privacy-first upload</span>
              <h3>Strip your name, phone, email, and home address before you upload.</h3>
              <p>The Autopsy compares your <em>experience</em> against a specialty recruiter's role brief — so it never needs your contact details to find your Fit Gap. Redact them, and the diagnosis is exactly the same. Search quietly.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="record">
            <div>
              <span className="eyebrow">The record</span>
              <h2>Everything you walk away with — free, and yours to keep.</h2>
              <div className="price">$0 · NO CARD · NO CATCH</div>
            </div>
            <ul>
              <li><span className="chk">✓</span> Your Application Silence Score</li>
              <li><span className="chk">✓</span> A stage-by-stage cause-of-death breakdown</li>
              <li><span className="chk">✓</span> Your Recruiter-Fit Gap, named and explained</li>
              <li><span className="chk">✓</span> The first concrete fix to make next</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">The record so far</span>
            <h2>Built for mid-career and specialist professionals stuck in the silence.</h2>
          </div>
          <div className="proof">
            <div className="quote">
              <p>"Sixty applications, not one reply. The Autopsy showed me I was dying at the recruiter screen — not the résumé bots I'd been obsessing over. I reframed my last two roles and had three callbacks that week."</p>
              <div className="who">Priya N. · Data Engineer · Fintech</div>
            </div>
            <div className="quote">
              <p>"I assumed it'd be another résumé grader. Instead it named the exact specialty roles I was mis-positioning for. My first real interview in three months came five days later."</p>
              <div className="who">Marcus D. · Supply Chain Manager · Manufacturing</div>
            </div>
            <div className="quote">
              <p>"I'd started to believe I was the problem. My Silence Score showed most of it was targeting, not me. Being able to redact my name and still get a straight read is the only reason I trusted it."</p>
              <div className="who">Elena V. · UX Researcher · Healthcare</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">The questions</span>
            <h2>Before you hand over an email address.</h2>
          </div>
          <div className="faq">
            <details className="qa" open>
              <summary>Is it actually free?</summary>
              <div className="ans">Yes. The Autopsy costs nothing and asks for no card. You keep the findings whether or not you ever do anything else with Job Genie.</div>
            </details>
            <details className="qa">
              <summary>Do I have to upload my résumé?</summary>
              <div className="ans">Yes — that's what gets compared against the specialty recruiter's role brief. But you can remove your name, phone, email, and home address first. The Autopsy reads your experience, not your identity, so redacting your contact details changes nothing about the findings.</div>
            </details>
            <details className="qa">
              <summary>Will my job search stay private?</summary>
              <div className="ans">That's the point of the redaction. Strip your personal details and the Autopsy still works exactly the same — so you can diagnose your search without exposing who you are while you're still employed.</div>
            </details>
            <details className="qa">
              <summary>How is this different from a résumé review?</summary>
              <div className="ans">A review edits a document. The Autopsy diagnoses why the document never got read in the first place — the filter before the human. Different problem, different fix.</div>
            </details>
            <details className="qa">
              <summary>Who is it for?</summary>
              <div className="ans">Mid-career and specialist professionals who are clearly qualified, applying steadily, and hearing nothing back. If "I've tried everything" sounds familiar, it's for you.</div>
            </details>
          </div>
        </div>
      </section>

      <section className="final">
        <div className="wrap">
          <span className="eyebrow" style={{ justifyContent: "center" }}>Get my free Autopsy</span>
          <h2>Stop guessing why they went quiet.</h2>
          <AutopsyForm />
        </div>
      </section>

      <footer>
        <div className="wrap foot-row">
          <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="nlogo">
              <img src="/logo.png" alt="Job Genie" style={{ width: 36, height: 36, objectFit: "contain" }} />
              Job Genie
            </div>
          </a>
          <div>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="#autopsy">Get my Autopsy</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
