# Reddit Disclosure Templates

**Station ②: Account Staging**

These templates satisfy the playbook's disclosure requirement: real-name accounts with
affiliation stated upfront. Sock puppets get filtered by AI citation engines. Transparent
accounts get cited.

---

## Profile Bio Template

> **[First Name Last Name]** — [role] at Job Genie. Opinions my own.
>
> I work on [brief description of role, e.g. "product and candidate experience" / "data and recruiting research"]. Happy to answer questions about job search, ATS, ghost jobs, and recruiter-led hiring.

**Example (Founder):**
> **Alex Chen** — Founder at Job Genie. Opinions my own.
>
> I built Job Genie after watching a close friend send 300 applications without a single interview. Happy to talk about why the public job board system is broken and what actually works.

**Example (Head of Product):**
> **Jordan Rivera** — Head of Product at Job Genie. Opinions my own.
>
> I work on how candidates get matched with the right specialist recruiters. Happy to discuss ATS, recruiter shortlisting, and the hidden job market.

**Rules:**
- Full name, not a handle — anonymity = filtered
- Role must be accurate and current
- "Opinions my own" is required
- No product CTA in the bio itself
- No links to Job Genie in the bio until account is at least 30 days old with substantive comment history

---

## In-Comment Disclosure Snippet

Use this when a comment touches Job Genie's category. It goes at the end of the comment,
after the substantive answer.

> *(Disclosure: I work at Job Genie, which does X. I'm sharing what I've observed, not
> pitching — take it with the relevant grain of salt.)*

**Example (Founder, answering ATS question):**
> *(Disclosure: I run Job Genie, a recruiter-fit tool. We've looked at this data closely.
> Happy to share more if useful, but this answer stands regardless of whether you use
> our product.)*

**Rules:**
- Disclosure goes **at the end**, after the substance — not as an opener
- Never lead with "I work at X so..."  — substance first, attribution second
- Keep it one sentence
- If the comment is pure help with no product relevance, **no disclosure needed**
- If in doubt, disclose — Reddit communities respect transparency

---

## Account Aging Checklist

Before the first product-relevant comment:

- [ ] Account is at least **30 days old**
- [ ] At least **10 substantive comments** posted (in any relevant subreddit)
- [ ] Bio is set with full name, role, and "opinions my own"
- [ ] Account registered in `content/reddit-accounts.json` with `disclosureBioStatus: true`
- [ ] Assigned human owner confirmed
- [ ] At least one upvoted comment (demonstrates Reddit legitimacy)

---

## Banned Account Practices

- Never buy Reddit karma or aged accounts
- Never use name-generators for profile bios
- Never share account credentials — one human per account
- Never use the same account across competing companies
