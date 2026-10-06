import { BrandNavigation } from "../components/BrandNavigation";
import { SEO } from "../components/SEO";
import "./FreeAutopsy5Page.css";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const canonicalUrl = "https://www.job-genie.ai/free-autopsy5";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Can an ATS reject an application automatically?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, in a narrow case: knockout questions such as work authorisation, a required licence, or minimum experience can filter an application. Beyond knockout questions, only 2 of 25 recruiters in Enhancv's small, qualitative, non-representative interview sample described any automatic rejection.",
      },
    },
    {
      "@type": "Question",
      name: "What happens to applications that are not rejected?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Many are scored and ordered. A recruiter works down a ranked list and stops when they have enough people to call. The application may simply never reach the point where a person reviews it.",
      },
    },
    {
      "@type": "Question",
      name: "Does keyword matching exist?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Keyword and skill matching can affect ranking. A résumé that never states a requirement named in the posting may rank lower for it; that is a ranking penalty, not necessarily deletion.",
      },
    },
    {
      "@type": "Question",
      name: "Can résumé formatting break parsing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Occasionally. Text in images, interleaving multi-column layouts, tables used for layout, and critical details in headers or footers can cause problems. A standard single-column document in a common file format avoids most of these issues. You can paste it into a plain-text editor to check what comes through.",
      },
    },
    {
      "@type": "Question",
      name: "Why do so few applications get replies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenhouse reports applications per opening rose from 116 in 2022 to 244 in 2025 across more than 640 million applications and 6,000-plus companies. This is a large sample from one platform's North American customers, not a census of the whole market. At that volume, silence can happen without anyone deciding anything about you.",
      },
    },
  ],
};

const evidenceRows = [
  {
    claim: "75% of résumés are rejected by ATS",
    source: "HRTact’s source-chain review, including 2012 vendor coverage",
    href: "https://hrtact.com/2020/10/05/your-job-application-was-rejected-by-a-human-not-a-computer/",
    finding: "No study establishes the figure.",
    tone: "caution",
  },
  {
    claim: "Recruiters reporting automatic rejection",
    source: "Enhancv, November 2025 · 25 structured recruiter interviews",
    href: "https://enhancv.com/blog/does-ats-reject-resumes/",
    finding: "2 of 25. Small qualitative sample; not representative.",
    tone: "finding",
  },
  {
    claim: "Applications per opening",
    source: "Greenhouse, March 2026 · 640M+ applications, 6,000+ companies",
    href: "https://www.greenhouse.com/recruiting-benchmarks",
    finding: "116 in 2022 → 244 in 2025.",
    tone: "volume",
  },
];

const questions = [
  {
    number: "01",
    id: "automatic-rejection",
    question: "Can an ATS reject an application automatically?",
    answer: (
      <>
        Yes, in one narrow case. <strong>Knockout questions</strong>—work
        authorisation, a required licence, or a minimum-experience answer—can
        filter an application before a human sees it. Those are answers you
        gave, not inferences drawn from your document.
        <p className="jg-autopsy5-inline-source">
          Beyond knockout questions, 2 of 25 interviewed recruiters described
          any automatic rejection.{" "}
          <a
            href="https://enhancv.com/blog/does-ats-reject-resumes/"
            target="_blank"
            rel="noreferrer"
            data-testid="source-enhancv-rejection"
          >
            Enhancv, November 2025 <span aria-hidden="true">↗</span>
          </a>
        </p>
      </>
    ),
  },
  {
    number: "02",
    id: "ranked-not-deleted",
    question: "So what happens to the other applications?",
    answer: (
      <>
        They may be scored and ordered. A recruiter opens a ranked list, works
        down it, and stops when they have enough people to call. Nothing
        necessarily rejected you; the list may simply have run out of attention
        before it reached you.
        <p>
          The distinction matters. If a machine deleted your file, formatting
          might be the fix. If a human never got far enough down the list,
          position is the problem—and position is mostly about evidence and
          route, not fonts.
        </p>
      </>
    ),
  },
  {
    number: "03",
    id: "keyword-matching",
    question: "Does keyword matching exist at all?",
    answer: (
      <>
        Yes. Keyword and skill matching can be a real scoring input. A résumé
        that never states a requirement named in the posting may rank lower for
        it. That is a <strong>ranking penalty, not a deletion</strong>. It is
        worth fixing, but not worth being frightened of.
      </>
    ),
  },
  {
    number: "04",
    id: "parsing",
    question: "Do résumé formats break parsing?",
    answer: (
      <>
        Occasionally, and the cases are specific: text inside images,
        multi-column layouts that interleave when read linearly, tables used for
        layout, or critical details in headers and footers. A single-column
        document in a standard file format avoids nearly all of it.
        <p>
          This is not a reason to pay for an “ATS-optimised” rebuild of a
          document that already parses. Paste it into a plain-text editor and
          read what comes out.
        </p>
      </>
    ),
  },
  {
    number: "05",
    id: "application-volume",
    question: "Then why do so few applications get replies?",
    answer: (
      <>
        The pile roughly doubled. Greenhouse reports applications per opening
        rose from 116 in 2022 to 244 in 2025, across 640 million-plus
        applications and more than 6,000 companies. Volume at that level can
        produce silence without anyone deciding anything about you.
        <p className="jg-autopsy5-inline-source">
          Greenhouse, March 2026. North American customers of one platform—a
          large sample, not a census of the market.{" "}
          <a
            href="https://www.greenhouse.com/recruiting-benchmarks"
            target="_blank"
            rel="noreferrer"
            data-testid="source-greenhouse-benchmarks"
          >
            Read the benchmark <span aria-hidden="true">↗</span>
          </a>
        </p>
      </>
    ),
  },
];

const recommendations = [
  {
    number: "01",
    title: "Check parsing once, then stop.",
    body: "Use a single column and a standard file format. Keep text out of images and critical details out of headers. Confirm it reads correctly as plain text, then move on.",
  },
  {
    number: "02",
    title: "State evidence rather than implying it.",
    body: "Ranking rewards what is stated. Make your scope, budget, headcount, and outcomes legible—and put numbers on the page where you can support them.",
  },
  {
    number: "03",
    title: "Answer knockout questions accurately.",
    body: "This is the place automatic filtering genuinely operates. A blank or careless answer can do what the 75% claim is wrongly blamed for.",
  },
  {
    number: "04",
    title: "Change the route, not just the document.",
    body: "Agency-submitted candidates reach interview at higher rates than direct applicants. Part of that gap is the filter rather than the channel—but the pile you are standing in is smaller either way.",
  },
];

export default function FreeAutopsy5Page() {
  return (
    <div className="jg-autopsy5">
      <SEO
        title="Do ATS Systems Auto-Reject 75% of Résumés? The Evidence | Job Genie"
        description="Read the evidence behind the ATS rejection myth, what 25 recruiter interviews actually found, and what to change when applications go unanswered."
        canonicalUrl={canonicalUrl}
        pageType="article"
        slug="free-autopsy5"
        aeoQuestion="Do applicant tracking systems auto-reject 75% of résumés?"
        schemas={[faqSchema]}
      />
      <BrandNavigation />

      <main id="main-content">
        <header className="jg-autopsy5-hero" data-testid="anchor-autopsy5-intro">
          <div className="jg-autopsy5-hero-grid">
            <div className="jg-autopsy5-hero-copy">
              <div className="jg-autopsy5-kicker">
                <span className="jg-autopsy5-kicker-mark" aria-hidden="true" />
                Job Genie <span className="jg-autopsy5-kicker-slash">/</span>{" "}
                Evidence note
              </div>
              <h1>
                Do applicant tracking systems auto-reject{" "}
                <span>75% of résumés?</span>
              </h1>
              <div className="jg-autopsy5-answer">
                <span className="jg-autopsy5-answer-label">Short answer</span>
                <p>
                  <strong>No study establishes that figure.</strong> In the
                  one recent attempt to ask recruiters directly, 2 of 25 said
                  their system auto-rejects for anything beyond knockout
                  questions. Applicant tracking systems mostly rank candidates.
                  They rarely delete them.
                </p>
              </div>
              <p className="jg-autopsy5-standfirst">
                The familiar number is not a finding. The more useful question
                is what the available evidence can—and cannot—tell us about
                application silence.
              </p>
              <div className="jg-autopsy5-reviewed">
                <span className="jg-autopsy5-reviewed-dot" aria-hidden="true" />
                Last reviewed 6 October 2026
                <span className="jg-autopsy5-reviewed-divider" aria-hidden="true">
                  ·
                </span>
                Sample sizes and limitations stated throughout
              </div>
            </div>

            <aside className="jg-autopsy5-hero-aside" aria-label="Evidence at a glance">
              <div className="jg-autopsy5-aside-top">
                <span>Evidence at a glance</span>
                <span className="jg-autopsy5-aside-index">01—03</span>
              </div>
              <div className="jg-autopsy5-metric">
                <div className="jg-autopsy5-metric-head">
                  <span className="jg-autopsy5-metric-name">Recruiter interviews</span>
                  <span className="jg-autopsy5-metric-tag">Enhancv · 2025</span>
                </div>
                <div className="jg-autopsy5-metric-value">2 <small>of 25</small></div>
                <p>described automatic rejection beyond knockout questions</p>
              </div>
              <div className="jg-autopsy5-aside-rule" />
              <div className="jg-autopsy5-metric jg-autopsy5-metric-volume">
                <div className="jg-autopsy5-metric-head">
                  <span className="jg-autopsy5-metric-name">Applications / opening</span>
                  <span className="jg-autopsy5-metric-tag">Greenhouse · 2026</span>
                </div>
                <div className="jg-autopsy5-volume-values">
                  <span>116</span>
                  <span className="jg-autopsy5-volume-arrow" aria-label="to">→</span>
                  <span>244</span>
                </div>
                <p>2022 to 2025 · North American customer data</p>
              </div>
              <div className="jg-autopsy5-aside-foot">
                Two different sources. Two different limits.{" "}
                <a href="#evidence-table" data-testid="link-evidence-table">
                  See the evidence <span aria-hidden="true">↓</span>
                </a>
              </div>
            </aside>
          </div>
          <div className="jg-autopsy5-hero-bottom" aria-hidden="true">
            <span>Hiring screens, without the folklore</span>
            <span>Scroll to read the evidence <span>↓</span></span>
          </div>
        </header>

        <div className="jg-autopsy5-body">
          <nav className="jg-autopsy5-toc" aria-label="On this page">
            <span className="jg-autopsy5-toc-label">In this note</span>
            <a href="#claim-origin" data-testid="anchor-claim-origin">The 75% claim</a>
            <a href="#systems" data-testid="anchor-systems">How the systems work</a>
            <a href="#recommendations" data-testid="anchor-recommendations">What to do</a>
            <a href="#sources" data-testid="anchor-sources">Sources &amp; limits</a>
          </nav>

          <article className="jg-autopsy5-article">
            <section className="jg-autopsy5-section jg-autopsy5-origin" id="claim-origin" data-testid="section-claim-origin">
              <div className="jg-autopsy5-section-number">01 <span>THE CLAIM</span></div>
              <div className="jg-autopsy5-section-content">
                <h2>Where the 75% figure comes from</h2>
                <p className="jg-autopsy5-lead">
                  It does not come from a study. The claim appears in résumé
                  optimisation marketing—products built to solve the problem
                  the number describes.
                </p>
                <p>
                  HRTact followed the citation chain to résumé-optimisation
                  vendor Preptel and its coverage in a 2012 article. That is a
                  source-chain review, not a published dataset establishing the figure. Later
                  repetitions cite other repetitions; follow the chain far
                  enough and it ends at a blog post, not a dataset.
                </p>
                <p>
                  The distinction matters: an old unsourced sales claim is not
                  evidence that three quarters of applications are deleted by
                  software.
                </p>
                <div className="jg-autopsy5-provenance-note">
                  <span className="jg-autopsy5-note-mark" aria-hidden="true">i</span>
                  <p>
                    <strong>Provenance note.</strong> HRTact documents the
                    citation chain and discusses 2012 vendor coverage; it does
                    not establish the claim with primary research data.{" "}
                    <a
                      href="https://hrtact.com/2020/10/05/your-job-application-was-rejected-by-a-human-not-a-computer/"
                      target="_blank"
                      rel="noreferrer"
                      data-testid="source-hrtact-provenance"
                    >
                      Read HRTact’s account <span aria-hidden="true">↗</span>
                    </a>
                  </p>
                </div>

                <div className="jg-autopsy5-table-wrap" id="evidence-table" data-testid="anchor-evidence-table">
                  <table className="jg-autopsy5-table">
                    <caption>
                      Three claims, and what their cited evidence supports
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Claim</th>
                        <th scope="col">Source &amp; scope</th>
                        <th scope="col">What holds up</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidenceRows.map((row) => (
                        <tr key={row.claim} data-testid={`row-evidence-${row.tone}`}>
                          <th scope="row">{row.claim}</th>
                          <td><a href={row.href} target="_blank" rel="noopener noreferrer" data-testid={`source-evidence-${row.tone}`}>{row.source}</a></td>
                          <td><span className={`jg-autopsy5-result jg-autopsy5-result-${row.tone}`}>{row.finding}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="jg-autopsy5-table-note">
                  Enhancv interviewed 25 recruiters across more than 10 named
                  platforms in September and October 2025. It is a small
                  qualitative sample, not nationally representative. It is
                  cited because it directly asked the question—not because 25
                  interviews settle it.
                </p>
              </div>
            </section>

            <section className="jg-autopsy5-section" id="systems" data-testid="section-systems">
              <div className="jg-autopsy5-section-number">02 <span>THE MECHANISM</span></div>
              <div className="jg-autopsy5-section-content">
                <h2>What these systems actually do</h2>
                <p className="jg-autopsy5-lead">
                  “Rejected by a bot” and “not reached in a ranked list” are
                  different problems. The fix depends on which one you face.
                </p>
                <div className="jg-autopsy5-qa-list">
                  {questions.map((item) => (
                    <section className="jg-autopsy5-qa" id={item.id} key={item.id}>
                      <div className="jg-autopsy5-qa-number">{item.number}</div>
                      <div>
                        <h3>{item.question}</h3>
                        <div className="jg-autopsy5-qa-answer">{item.answer}</div>
                      </div>
                    </section>
                  ))}
                </div>

                <aside className="jg-autopsy5-interpretation" aria-label="Why the distinction matters">
                  <span className="jg-autopsy5-interpretation-label">A more useful diagnosis</span>
                  <p>
                    The 75% claim survives because it is comforting: it makes
                    the problem a machine’s fault and the fix a formatting job.
                    A candidate who thinks a robot deleted their CV may buy a
                    robot-proof CV. A candidate ranked 180th out of 244 has a
                    harder, more useful problem to work on.
                  </p>
                </aside>
              </div>
            </section>

            <section className="jg-autopsy5-section jg-autopsy5-actions" id="recommendations" data-testid="section-recommendations">
              <div className="jg-autopsy5-section-number">03 <span>THE RESPONSE</span></div>
              <div className="jg-autopsy5-section-content">
                <h2>What the evidence supports doing instead</h2>
                <p className="jg-autopsy5-lead">
                  Fix the things that can change how your application is read.
                  Then spend your effort where it can change whether it is read.
                </p>
                <ol className="jg-autopsy5-recommendation-list">
                  {recommendations.map((item) => (
                    <li key={item.number} data-testid={`recommendation-${item.number}`}>
                      <span className="jg-autopsy5-recommendation-number">{item.number}</span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                      </div>
                      <span className="jg-autopsy5-recommendation-arrow" aria-hidden="true">↗</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </article>
        </div>

        <section className="jg-autopsy5-cta" id="free-autopsy" data-testid="anchor-free-autopsy">
          <div className="jg-autopsy5-cta-inner">
            <div className="jg-autopsy5-cta-copy">
              <span className="jg-autopsy5-cta-eyebrow">A next step, not a promise</span>
              <h2>Want to know which of these applies to yours?</h2>
              <p>
                There are about eight reasons applications go unanswered.
                Formatting is one, and it is rarely the only one. The free
                Autopsy reads what you actually sent and names which cause your
                evidence points to, with a confidence level.
              </p>
              <p>
                If your CV is fine and your targeting is not, it says that. If
                the evidence is not enough to tell, it says that too.
              </p>
              <a
                className="jg-autopsy5-cta-button"
                href={`${base}/free-autopsy/`}
                data-testid="cta-free-autopsy"
              >
                Start the free Autopsy <span aria-hidden="true">→</span>
              </a>
              <p className="jg-autopsy5-cta-disclosure">
                This link starts with a free email signup. We’ll send
                instructions by email; this page does not scan your CV
                immediately.
              </p>
            </div>
            <div className="jg-autopsy5-cta-aside" aria-label="What to expect">
              <span className="jg-autopsy5-cta-aside-index">BEFORE YOU GO</span>
              <div className="jg-autopsy5-cta-aside-line">
                <span>01</span><p>Free email signup</p>
              </div>
              <div className="jg-autopsy5-cta-aside-line">
                <span>02</span><p>Instructions arrive by email</p>
              </div>
              <div className="jg-autopsy5-cta-aside-line">
                <span>03</span><p>A diagnosis grounded in your evidence</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="jg-autopsy5-footer" id="sources" data-testid="section-sources">
          <div className="jg-autopsy5-footer-main">
            <div>
              <span className="jg-autopsy5-footer-label">Sources &amp; limits</span>
              <h2>Evidence should be inspectable.</h2>
              <p>
                We sell a diagnostic, which gives us a commercial interest in
                you believing your applications are fixable. So every figure
                here is linked, dated, and stated with its sample size and
                limits. Job Genie is not affiliated with any job board,
                employer, or recruitment agency.
              </p>
            </div>
            <div className="jg-autopsy5-source-list">
              <a
                href="https://enhancv.com/blog/does-ats-reject-resumes/"
                target="_blank"
                rel="noreferrer"
                data-testid="source-enhancv"
              >
                <span className="jg-autopsy5-source-num">01</span>
                <span><strong>Enhancv</strong><small>Does ATS reject résumés? · November 2025</small></span>
                <span className="jg-autopsy5-source-out" aria-hidden="true">↗</span>
              </a>
              <a
                href="https://www.greenhouse.com/recruiting-benchmarks"
                target="_blank"
                rel="noreferrer"
                data-testid="source-greenhouse"
              >
                <span className="jg-autopsy5-source-num">02</span>
                <span><strong>Greenhouse</strong><small>Recruiting benchmarks · March 2026</small></span>
                <span className="jg-autopsy5-source-out" aria-hidden="true">↗</span>
              </a>
              <a
                href="https://hrtact.com/2020/10/05/your-job-application-was-rejected-by-a-human-not-a-computer/"
                target="_blank"
                rel="noreferrer"
                data-testid="source-hrtact"
              >
                <span className="jg-autopsy5-source-num">03</span>
                <span><strong>HRTact</strong><small>Discussion of the traced 2012 claim · October 2020</small></span>
                <span className="jg-autopsy5-source-out" aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <div className="jg-autopsy5-footer-bottom">
            <span>Written and maintained by Job Genie · Reviewed 6 October 2026</span>
            <a href={`${base}/methodology`} data-testid="link-methodology">
              See our methodology <span aria-hidden="true">→</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
