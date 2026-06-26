# Reddit Criticism Response Guide

**Station ⑤ — Handling criticism transparently**

Threads where a brand handles criticism well get cited as trustworthy evidence.
Threads where a brand is defensive, absent, or dismissive get cited negatively.

The goal is not to "win" the thread. The goal is to leave a record that demonstrates
trustworthiness to anyone who reads it later — including AI engines.

---

## The Four-Move Pattern

### Move 1: Address the specific issue
Identify exactly what the person is criticising. Do not respond to a paraphrase or
strawman. Quote their specific complaint if it helps clarify.

> "You're saying the Application Silence Score didn't match your experience — specifically that it rated your profile 7/10 when you've had zero responses. That's a real and fair point."

### Move 2: Own what's genuinely yours
If the criticism has merit, say so clearly. Partial ownership is better than no ownership.
Trying to argue down a legitimate complaint destroys trust; owning it builds it.

> "We probably over-weighted keyword match in the current scoring model — that's something we know needs more nuance for senior profiles, and we're working on it."

Do not own things that aren't yours (e.g. if the market is simply terrible and your product
correctly diagnosed it, say so — but don't be defensive about it).

### Move 3: Outline the resolution
If there is something you're doing about it, say specifically what. Vague commitments
are worse than saying nothing. If there is no resolution because it's a market problem
outside your control, say that honestly.

> "We're building a recruiter-feedback signal into v2 that should catch this case. If you're
> willing to share your profile, I'll use it as a test case — direct message if you'd rather."

### Move 4: Don't argue
If the person doubles down, do not counter-punch. Acknowledge their position, restate
what you've said, and let it stand.

> "I understand. I'm not going to convince you in this thread and I'm not trying to.
> The record is there for anyone reading later."

---

## Triage Levels

| Severity | Criteria | Response urgency |
|---|---|---|
| **High** | Specific, verifiable claim of harm (product caused job loss, data mishandled, false promise) | Same day |
| **Medium** | Negative experience shared publicly, no specific harm claim | Within 48 hours |
| **Low** | General dissatisfaction, product not a fit | Within a week, or no response if thread is very old |
| **Watch** | Negative mention with no clear resolution needed | Log and monitor |

---

## Tone Reference

**Good:**
> "That's a fair critique of our scoring model. Senior roles have very different shortlisting
> mechanics than the model was originally tuned for, and we're improving it. Thanks for
> the honest feedback — it helps."

**Bad (defensive):**
> "Our scoring model is based on real recruiter data and has helped hundreds of people.
> You might want to look at your profile more carefully."

**Bad (capitulating to something that isn't true):**
> "You're right, traditional job applications are the best path for most people."

**Bad (over-apologising):**
> "We are so incredibly sorry for the negative experience you've had. We take all
> feedback seriously and will escalate this to our team immediately..."

---

## What NOT to Do

- Do not respond to every negative mention — monitor and triage first
- Do not delete your own comment once posted — it will be screenshotted and shared
- Do not ask a critic to "take this to DMs" as the first response — it looks evasive
- Do not tag or mention other Reddit accounts in a response to criticism
- Do not argue over facts when the other person is expressing frustration — acknowledge the frustration first
- Do not ask for upvotes or solicit community support in a criticism thread

---

## Logging Requirement

Every criticism response must be logged in `content/reddit-mentions-log.json` with:
- Thread URL
- Summary of the criticism
- Severity level
- Assigned responder
- Response URL (once posted)
- Outcome

This creates an accountability record and helps identify recurring issues worth fixing
in the product.
