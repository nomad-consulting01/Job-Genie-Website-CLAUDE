'use strict';

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, convertInchesToTwip, PageBreak,
  ExternalHyperlink
} = require('docx');
const fs = require('fs');
const path = require('path');

// ─── helpers ────────────────────────────────────────────────────────────────
const h1 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 160 },
});

const h2 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 320, after: 120 },
});

const h3 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 240, after: 80 },
});

const p = (text, { bold = false, italic = false, color = undefined } = {}) =>
  new Paragraph({
    children: [new TextRun({ text, bold, italic, color, size: 22 })],
    spacing: { before: 60, after: 120 },
  });

const bullet = (text, level = 0) =>
  new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    bullet: { level },
    spacing: { before: 40, after: 40 },
  });

const callout = (label, text) => new Paragraph({
  children: [
    new TextRun({ text: `${label}  `, bold: true, size: 22 }),
    new TextRun({ text, size: 22, italics: true }),
  ],
  spacing: { before: 80, after: 80 },
  indent: { left: convertInchesToTwip(0.35) },
  shading: { type: ShadingType.CLEAR, fill: 'EFF6FF' },
  border: {
    left: { style: BorderStyle.THICK, size: 12, color: '3B82F6' },
  },
});

const divider = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' } },
  spacing: { before: 200, after: 200 },
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const twoColTable = (rows, headerRow = null) => {
  const makeCell = (text, isHeader = false, bg = 'FFFFFF') =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: isHeader, size: isHeader ? 20 : 20 })],
        spacing: { before: 40, after: 40 },
      })],
      shading: { type: ShadingType.CLEAR, fill: bg },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    });

  const docRows = [];
  if (headerRow) {
    docRows.push(new TableRow({
      children: headerRow.map(h => makeCell(h, true, '1E3A5F')),
      tableHeader: true,
    }));
  }
  rows.forEach(([col1, col2], i) => {
    docRows.push(new TableRow({
      children: [
        makeCell(col1, false, i % 2 === 0 ? 'F8FAFC' : 'FFFFFF'),
        makeCell(col2, false, i % 2 === 0 ? 'F8FAFC' : 'FFFFFF'),
      ],
    }));
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: docRows,
    margins: { top: 60, bottom: 60 },
  });
};

// ─── document content ────────────────────────────────────────────────────────
const children = [

  // ── COVER ──────────────────────────────────────────────────────────────────
  new Paragraph({
    children: [new TextRun({ text: 'Job Genie — How It Works', bold: true, size: 52, color: '1E3A5F' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 800, after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'A Plain-English Guide for First-Year CS Students', size: 28, color: '64748B', italics: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'August 2026', size: 22, color: '94A3B8' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 1200 },
  }),

  pageBreak(),

  // ── SECTION 1 ──────────────────────────────────────────────────────────────
  h1('1. The Big Picture'),
  p('Job Genie is a website (job-genie.ai) that helps people who are struggling to get responses after sending out job applications. It answers questions like "Why am I getting ghosted?" and "Are these job listings even real?" with expert, well-researched articles.'),
  p('But here is the interesting part — almost none of those articles were written by a human sitting at a desk. They were written automatically by the software itself, using a combination of:'),
  bullet('Reddit — where real job seekers post their real frustrations'),
  bullet('Claude — an AI model (like a smarter version of ChatGPT) that drafts the answers'),
  bullet('Gemini — a different AI that generates the images for each article'),
  bullet('A scheduler — a clock inside the server that runs tasks automatically every night'),
  p('Think of it like a newsroom that runs 24 hours a day but never needs a journalist to show up. The software decides what to write about, writes it, publishes it, and then measures how people respond to it — all on its own.'),

  callout('🎓 CS Concept:', 'This pattern is called an "agentic loop" — software that takes actions, observes results, and decides what to do next, without a human pressing a button each time.'),

  divider(),

  // ── SECTION 2 ──────────────────────────────────────────────────────────────
  h1('2. The Building Blocks'),
  p('Before diving into how the loops work, you need to understand the three main pieces of the system.'),

  h2('2.1  The API Server'),
  p('An API server is a program that runs in the cloud and answers questions from other programs. Think of it like a restaurant kitchen — customers (browsers, bots, other software) place orders at the counter, and the kitchen prepares and returns the food.'),
  p('Job Genie\'s API server is written in TypeScript and runs on Node.js. It does several jobs at once:'),
  bullet('Serves article content to the website'),
  bullet('Accepts analytics events from visitors ("this person clicked the sign-up button")'),
  bullet('Runs the automated loops every night'),
  bullet('Exposes an admin dashboard so the human owner can review what the AI wrote'),

  h2('2.2  The Database'),
  p('A database is where the system remembers things. Imagine a giant spreadsheet — except the rows and columns have strict rules about what can go in them. Job Genie uses PostgreSQL (a very popular database used by companies like Instagram and Spotify).'),
  p('The most important tables are:'),
  twoColTable([
    ['questions', 'A job-seeker question found on Reddit, e.g. "Why do I never get a callback?"'],
    ['answers', 'The AI-generated answer to that question, with a quality score'],
    ['content_assets', 'A finished piece of content (blog post, LinkedIn post, newsletter) ready to publish'],
    ['loop_runs', 'A log of every time a loop ran — when it started, what it did, how much it cost'],
    ['blog_redirects', 'A record of duplicate articles, so the old URL sends visitors to the better one'],
    ['reactor_invite_posts', 'Facebook posts with lots of reactions that are worth following up on'],
  ], ['Table', 'What it stores']),

  h2('2.3  The Frontend (the Website)'),
  p('The website is built with React — a JavaScript library made by Meta (Facebook) that is used on millions of websites. When you open job-genie.ai in a browser, React draws the page on your screen.'),
  p('The site has two kinds of visitors:'),
  bullet('Regular users — they read articles, sign up for the newsletter, and never see the back end'),
  bullet('The admin (the owner) — they log into a hidden dashboard to review AI-written content, manage experiments, and monitor the loops'),

  divider(),

  // ── SECTION 3 ──────────────────────────────────────────────────────────────
  h1('3. The Nightly Pipeline — Five Loops in a Row'),
  p('Every night, starting at 2 AM, the system runs five automated processes back-to-back. Each one feeds its output into the next, like an assembly line in a factory.'),

  new Paragraph({
    children: [new TextRun({ text: '2:00 AM   Listing Scraper', bold: true, size: 22, color: '1E3A5F' })],
    spacing: { before: 120, after: 20 },
    indent: { left: convertInchesToTwip(0.5) },
  }),
  new Paragraph({
    children: [new TextRun({ text: '        ↓', size: 22, color: '94A3B8' })],
    spacing: { before: 0, after: 20 },
    indent: { left: convertInchesToTwip(0.5) },
  }),
  new Paragraph({
    children: [new TextRun({ text: '3:00 AM   Loop 1  —  Ingest + Answer', bold: true, size: 22, color: '1E3A5F' })],
    spacing: { before: 0, after: 20 },
    indent: { left: convertInchesToTwip(0.5) },
  }),
  new Paragraph({
    children: [new TextRun({ text: '        ↓', size: 22, color: '94A3B8' })],
    spacing: { before: 0, after: 20 },
    indent: { left: convertInchesToTwip(0.5) },
  }),
  new Paragraph({
    children: [new TextRun({ text: '4:00 AM   Loop 2  —  Asset Generation', bold: true, size: 22, color: '1E3A5F' })],
    spacing: { before: 0, after: 20 },
    indent: { left: convertInchesToTwip(0.5) },
  }),
  new Paragraph({
    children: [new TextRun({ text: '        ↓', size: 22, color: '94A3B8' })],
    spacing: { before: 0, after: 20 },
    indent: { left: convertInchesToTwip(0.5) },
  }),
  new Paragraph({
    children: [new TextRun({ text: '5:00 AM   Loop 3  —  Blog Enrichment + Publishing', bold: true, size: 22, color: '1E3A5F' })],
    spacing: { before: 0, after: 20 },
    indent: { left: convertInchesToTwip(0.5) },
  }),
  new Paragraph({
    children: [new TextRun({ text: '        ↓', size: 22, color: '94A3B8' })],
    spacing: { before: 0, after: 20 },
    indent: { left: convertInchesToTwip(0.5) },
  }),
  new Paragraph({
    children: [new TextRun({ text: '6:00 AM   Loop 4  —  Distribution (email + LinkedIn)', bold: true, size: 22, color: '1E3A5F' })],
    spacing: { before: 0, after: 200 },
    indent: { left: convertInchesToTwip(0.5) },
  }),

  divider(),

  h2('3.0  The Listing Scraper  (2:00 AM — no AI, free to run)'),
  p('The scraper is the system\'s eyes and ears. Its only job is to go to Reddit and collect questions that real job seekers are asking.'),

  h3('Where it looks'),
  p('It visits several Reddit communities (called "subreddits"):'),
  bullet('r/jobs'),
  bullet('r/careerguidance'),
  bullet('r/cscareerquestions'),
  bullet('r/recruitinghell'),
  bullet('r/resumes'),
  bullet('r/jobsearchhacks'),

  h3('What it does with what it finds'),
  p('Reddit posts are messy. The scraper cleans them up using a process called "normalization" — stripping punctuation, lowercasing everything, removing filler words — so two posts asking essentially the same question look identical to the computer.'),
  p('Then it runs a similarity check. This is basically the scraper asking: "Have we already seen a question like this one?" It uses a technique called cosine similarity, which measures how much two pieces of text overlap in vocabulary. If the overlap is above 75%, the new question is considered a duplicate and is thrown away.'),

  callout('🎓 CS Concept:', 'Cosine similarity is a number between 0 and 1. Two identical sentences score 1.0. Two completely unrelated sentences score 0.0. The threshold of 0.75 means "at least 75% similar in word choice." This is the same math used in spam filters and search engines.'),

  p('Every unique question is saved to the questions table with a status of "pending" — waiting for Loop 1 to answer it.'),
  p('The scraper waits 30 seconds (plus some random extra time) between each Reddit visit so it does not get blocked for making too many requests too fast. This pattern — slowing down to be polite to a server — is called rate limiting.'),

  divider(),

  h2('3.1  Loop 1 — Ingest and Answer  (3:00 AM)'),
  p('Loop 1 is where the AI does its first real work. It picks up the pending questions left by the scraper and writes answers to them.'),

  h3('Budget check'),
  p('Before sending anything to Claude, Loop 1 does arithmetic. Claude charges by the token — roughly one token per word. Loop 1 adds up how many tokens it has spent so far and stops asking Claude questions once it has spent $2.00. This prevents a runaway loop from generating a surprise cloud bill.'),

  callout('🎓 CS Concept:', 'API calls to AI models are billed by usage (tokens). Guarding against runaway cost by checking a budget before each call is standard practice in production AI applications.'),

  h3('Asking Claude'),
  p('For each question, the system sends Claude a "prompt" — a carefully worded instruction. The prompt tells Claude to write a thorough, honest answer as if it were a career coach, and to return the answer in a specific format the code can parse.'),
  p('Claude sends back the answer as structured text. The code reads it, extracts the first paragraph (the "first block", which is the most important), and gives the answer a quality score from 1–10.'),

  h3('Quality gate'),
  p('Only answers that score 7.0 or higher are accepted. Lower-quality answers are discarded. This means the AI self-edits — low-effort outputs never make it to the website.'),
  p('Accepted answers are saved to the answers table. Rejected ones update the questions table with a "failed" status.'),

  h3('Telling Google'),
  p('After a successful run, Loop 1 pings Google\'s sitemap endpoint — essentially sending Google a message that says "new content is available, please come crawl it." This speeds up how quickly new articles appear in search results.'),

  divider(),

  h2('3.2  Loop 2 — Multi-Channel Asset Generation  (4:00 AM)'),
  p('Loop 2 takes the accepted answers from Loop 1 and turns each one into multiple pieces of content — one for every channel the business uses to reach people.'),

  h3('What is a "channel"?'),
  p('A channel is a platform where content gets published. Job Genie currently publishes to:'),
  twoColTable([
    ['blog_post', 'An article on the job-genie.ai website'],
    ['newsletter', 'An email sent to subscribers via Beehiiv'],
    ['linkedin', 'A post on LinkedIn'],
    ['email_nurture', 'A follow-up email in an automated sequence'],
  ], ['Channel', 'Where it goes']),

  h3('One answer, four assets'),
  p('Loop 2 sends Claude one big prompt per answer, asking it to write all four channel versions at once. Each version has a different length, tone, and format suited to that platform — a LinkedIn post is punchy and short, a blog post is long and detailed.'),
  p('Each output is saved as a row in the content_assets table with a status of "pending", ready for Loop 3 to finish and publish.'),

  divider(),

  h2('3.3  Loop 3 — Blog Enrichment and Publishing  (5:00 AM)'),
  p('Loop 3 is the most complex step. It takes the raw blog_post assets from Loop 2, finishes polishing them, and publishes them to the website.'),

  h3('Step 1: Duplicate check (the cannibalization guard)'),
  p('Before doing any expensive AI work, Loop 3 first asks: "Does an article covering this question already exist on the site?"'),
  p('It loads every published article\'s normalized question and runs the same cosine similarity check the scraper used. If the new article is more than 80% similar to an existing one, it is flagged as a duplicate (or "cannibalization" — a term from SEO meaning two of your own pages compete against each other in search results).'),
  p('Duplicates are automatically redirected: the system writes a rule that says "if anyone visits /blog/the-new-duplicate, send them to /blog/the-better-existing-article instead." These rules are stored in the blog_redirects table and applied by the server in real time — visitors and Google never see the duplicate.'),

  callout('🎓 CS Concept:', 'An HTTP redirect (specifically a "301 Permanent Redirect") tells a browser or search engine: "the content you want lives somewhere else now, permanently." Google transfers all the ranking credit from the old URL to the new one. This is why preventing duplicates is important for SEO.'),

  h3('Step 2: SEO metadata'),
  p('For non-duplicate posts, Claude is asked to write the SEO-critical fields: a compelling page title, a meta description (the snippet Google shows in search results), a URL-friendly slug, and topic tags.'),

  h3('Step 3: Hero image'),
  p('A second AI model — Gemini — generates a unique illustration for the top of each article. The image is saved to cloud storage and its URL is attached to the article.'),

  h3('Step 4: Publish to Facebook'),
  p('The finished article is posted to the Job Genie Facebook Page. This is done via the Facebook Graph API — a set of web endpoints that Facebook provides so developers can post, read, and react to content programmatically.'),

  h3('Step 5: Cache invalidation'),
  p('The website caches its sitemap (a list of all pages) so it does not rebuild it on every single visitor request. After publishing, Loop 3 clears that cache and pings Google again to announce the new page.'),

  callout('🎓 CS Concept:', 'Caching means saving a computed result so you can reuse it instead of recomputing it. Cache invalidation is deleting that saved result when it becomes stale. Cache invalidation is famously one of the hardest problems in computer science because doing it wrong causes users to see outdated content.'),

  divider(),

  h2('3.4  Loop 4 — Distribution  (6:00 AM)'),
  p('Loop 4 handles the non-blog channels — newsletter and LinkedIn. It picks up the "scheduled" content_assets from Loop 2, sends them to the appropriate platforms, and records the external post IDs so the system can check engagement later.'),

  divider(),

  // ── SECTION 4 ──────────────────────────────────────────────────────────────
  h1('4. The Always-On Background Services'),
  p('Three more services run independently of the main pipeline. They never stop — they wake up on their own schedule throughout the day and night.'),

  h2('4.1  The Voice Loop  (8 AM daily + Sunday 1 AM)'),
  p('The "voice" of an article is its tone and style — whether it sounds formal, casual, empathetic, punchy, etc. Job Genie runs multiple voice variants at the same time to find out which style gets the most engagement.'),

  h3('Daily metrics run (8 AM)'),
  p('Every morning, the Voice Loop fetches engagement data from Facebook (likes, comments, shares) for every published article. It then attributes those numbers to whichever voice variant that article used.'),

  h3('The bandit algorithm'),
  p('Here is where it gets interesting. The system does not just average the numbers and pick the winner. It uses a technique called Thompson Sampling (a type of "multi-armed bandit" algorithm).'),
  p('Imagine a row of slot machines. You want to maximize winnings, but you do not know which machine pays out best. A naive strategy would be to try each machine equally — but that wastes pulls on bad machines once you have a hint about which ones are good. Thompson Sampling balances "exploration" (trying arms you have not tested much) with "exploitation" (sticking with arms that have looked good so far).'),
  p('Each voice variant has two counters: alpha (wins) and beta (losses). The algorithm draws a random sample from the probability distribution those counters define. The arm with the highest sample score gets chosen. Arms with few data points have wide, uncertain distributions — so they get explored more. Arms with lots of data have narrow distributions — so consistent winners naturally dominate.'),

  callout('🎓 CS Concept:', 'Multi-armed bandit problems are a classic topic in reinforcement learning. Thompson Sampling is a Bayesian approach — it models uncertainty explicitly rather than just tracking averages. The same algorithm is used by Netflix to decide which thumbnails to show you.'),

  h3('Weekly self-improvement (Sunday 1 AM)'),
  p('Once a week, the Voice Loop reads the bandit ledger and asks Claude to propose improvements: retire variants that have consistently underperformed, and create new hybrid variants that blend the best qualities of top performers. The proposals wait in a queue for the admin to approve or dismiss — the human stays in the loop for this decision.'),

  h2('4.2  The Reactor Invite Harvester  (every 6 hours)'),
  p('When someone "reacts" to a Facebook post (likes, loves, angries, etc.), they are a high-signal potential follower — they clearly saw the content and had a strong enough feeling to click a button.'),
  p('Every six hours, the harvester calls the Facebook Graph API to fetch the latest reaction counts for every recent Job Genie post. It calculates the delta — how many new reactions since last time — and stores this in reactor_invite_posts.'),
  p('The admin can then review a queue of posts that have crossed a reaction threshold, and mark the reactors as "invited" to follow the page. This is a manual outreach workflow — the software identifies the right moment; the human decides when to act.'),

  h2('4.3  The A/B Experiment System'),
  p('Job Genie also runs A/B tests on the website itself — testing different headlines, button text, and page copy to see which version converts more visitors into newsletter subscribers.'),

  h3('How a visitor gets assigned'),
  p('The first time someone visits the site, the server creates a unique visitor ID and stores it in a browser cookie that lasts two years. Every time that visitor loads a page, the system looks up their ID and returns the same variant they got before — consistency matters, because showing someone a different headline on every visit would ruin the test.'),

  h3('How the test measures results'),
  p('Every meaningful action — page view, button click, sign-up — fires an event that is sent to the /api/events endpoint. The events are stored and later aggregated per variant, so the system can compare: "Did visitors who saw Headline A sign up more often than visitors who saw Headline B?"'),

  h3('Declaring a winner'),
  p('Currently, the admin reviews experiment results in the dashboard and manually declares a winner. The winning variant then becomes the default for all visitors.'),

  divider(),

  // ── SECTION 5 ──────────────────────────────────────────────────────────────
  h1('5. How the Website Gets Content to Google'),
  p('For a website to appear in search results, Google needs to be able to find and read it. This involves several pieces working together.'),

  h2('5.1  Server-Side Rendering (SSR) and Prerendering'),
  p('A normal React website is a JavaScript file that runs in your browser to build the HTML. But search engine crawlers often struggle to run JavaScript — they prefer to receive the finished HTML directly.'),
  p('Job Genie solves this two ways:'),
  bullet('Prerendering — at build time, the system runs the React app on the server, generates the final HTML for every known page, and saves those HTML files. When Google visits the page, it gets back complete HTML instantly.'),
  bullet('Dynamic SSR — for blog posts that were published after the last build, the Express server generates the HTML on-the-fly for each request, including all SEO tags and structured data.'),

  h2('5.2  JSON-LD Structured Data'),
  p('JSON-LD is a way to embed machine-readable information inside a web page. Google reads it to understand what a page is about and sometimes shows special rich results in search (e.g. a FAQ section directly in the search results).'),
  p('Each Job Genie article includes JSON-LD that tells Google: "This is a question, here is the answer, here is who wrote it, here is when it was published."'),

  h2('5.3  Sitemap'),
  p('A sitemap is an XML file that lists every page on the site and when it was last updated. Job Genie generates this dynamically and caches it. Every time a new article is published, the cache is cleared and Google is pinged to come fetch the updated sitemap.'),

  h2('5.4  Canonical URLs and Redirects'),
  p('A canonical URL is the "official" address for a piece of content. If the same article can be reached at two different URLs, you tell Google which one is the real one. Job Genie does this both with HTML tags and with HTTP 301 redirects, ensuring link authority is never split between duplicate pages.'),

  divider(),

  // ── SECTION 6 ──────────────────────────────────────────────────────────────
  h1('6. Putting It All Together'),
  p('Here is the full story of a single article, from a stranger\'s Reddit post to a live search result:'),

  twoColTable([
    ['2:00 AM', 'The Listing Scraper finds a Reddit post: "Why do I get ghosted after every first-round interview?" It normalizes the text, checks it is not a duplicate, and saves it to the questions table as "pending."'],
    ['3:00 AM', 'Loop 1 picks up the question. It checks the budget, sends the question to Claude, and gets back a detailed answer scoring 8.2/10. The answer is saved.'],
    ['4:00 AM', 'Loop 2 takes the answer and generates four content versions: a long blog post, a short LinkedIn post, a newsletter blurb, and a follow-up email.'],
    ['5:00 AM', 'Loop 3 picks up the blog post version. It checks — no duplicate found. It asks Claude for an SEO title and URL slug. It asks Gemini for an image. It posts to Facebook. The article goes live on the website.'],
    ['5:01 AM', 'Google is notified via sitemap ping. Within hours, Googlebot visits the new URL and indexes the article.'],
    ['8:00 AM', 'The Voice Loop checks Facebook engagement. The article used "voice variant B." 12 reactions recorded. Variant B\'s alpha counter goes up.'],
    ['6 hours later', 'The Reactor Harvester sees those 12 reactions crossed the threshold. The admin is shown the post in the invite queue.'],
    ['Days later', 'A job seeker types "why do I get ghosted after interviews" into Google. The article appears. They click. They sign up for the newsletter. An experiment event fires. The A/B test records the conversion for whichever headline variant they saw.'],
  ], ['When', 'What happens']),

  divider(),

  // ── SECTION 7 ──────────────────────────────────────────────────────────────
  h1('7. Key Computer Science Concepts in This System'),
  twoColTable([
    ['Agentic loops', 'Software that takes actions, observes results, and loops — without a human triggering each step. Loop 1–4 are all agentic loops.'],
    ['REST API', 'A standard way for programs to talk to each other over HTTP. The /api/* routes are REST endpoints.'],
    ['Database + ORM', 'PostgreSQL stores the data. Drizzle is the ORM (Object-Relational Mapper) — it lets TypeScript code talk to the database using typed objects instead of raw SQL strings.'],
    ['Cosine similarity', 'A math formula that measures how similar two pieces of text are by comparing the words they share. Used in the scraper and Loop 3 duplicate detection.'],
    ['Token budget', 'AI models charge per token (≈ per word). The loops check cost before each API call to avoid runaway spending.'],
    ['Caching + invalidation', 'The sitemap is cached for speed. When content changes, the cache is cleared (invalidated) so visitors always get fresh data.'],
    ['HTTP 301 redirect', 'A permanent redirect that tells browsers and search engines "this URL has moved, forever." Used to consolidate duplicate articles.'],
    ['Thompson Sampling', 'A Bayesian algorithm for choosing between options under uncertainty. Used by the Voice Loop to find the best writing style.'],
    ['Server-Side Rendering', 'Generating HTML on the server (not in the browser) so search engines can read the page without running JavaScript.'],
    ['A/B testing', 'Running two versions of something simultaneously to measure which performs better. Controlled by visitor ID cookies and event tracking.'],
    ['Webhooks / event pipeline', 'Every visitor action fires an event to /api/events. This stream of events is the raw data the experiment system uses to measure results.'],
    ['Rate limiting', 'Intentionally slowing down requests to external services (Reddit, Facebook) to avoid being blocked or throttled.'],
  ], ['Concept', 'How Job Genie uses it']),

  divider(),

  new Paragraph({
    children: [new TextRun({ text: 'End of document', size: 20, color: '94A3B8', italics: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
  }),
];

// ─── build and write ─────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Job Genie',
  title: 'Job Genie — How It Works (CS Student Edition)',
  description: 'Plain-English explainer of the Job Genie system for first-year CS students',
  styles: {
    default: {
      heading1: {
        run: { bold: true, size: 32, color: '1E3A5F' },
        paragraph: { spacing: { before: 400, after: 160 } },
      },
      heading2: {
        run: { bold: true, size: 26, color: '1D4ED8' },
        paragraph: { spacing: { before: 320, after: 120 } },
      },
      heading3: {
        run: { bold: true, size: 22, color: '374151' },
        paragraph: { spacing: { before: 200, after: 80 } },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(1.2),
          right: convertInchesToTwip(1.2),
        },
      },
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  const outPath = path.join(__dirname, '../attached_assets/job-genie-cs-explainer.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('Written to', outPath);
});
