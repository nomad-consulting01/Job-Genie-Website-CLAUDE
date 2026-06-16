# AEO Skill — Answer Engine Optimisation for Job Genie

## What is AEO?
Answer Engine Optimisation (AEO) is the practice of structuring content so it is selected by AI assistants (ChatGPT, Perplexity, Gemini, Claude, Bing Copilot) as the canonical answer to a user query.

Unlike classic SEO (targeting blue-link rank), AEO targets **zero-click extraction**: the AI engine reads and quotes your page directly.

## AEO Content Requirements

### 1. Answer-First Structure
Every Q&A page must open with a 40–60 word standalone paragraph that directly answers the question. This paragraph must:
- Name the subject immediately (not "It is..." — say "Application Silence is...")
- Be complete and quotable in isolation
- Contain the exact keyword phrase from the question title

### 2. Schema Markup
Every Q&A page must include:
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "<Exact question text>",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "<answer_first_block verbatim>"
    }
  }]
}
```

### 3. Metadata
- `<title>`: question text + " | Job Genie"
- `<meta name="description">`: answer_first_block truncated to 160 chars
- `<link rel="canonical">`: exact page URL
- OG + Twitter card tags

### 4. Breadcrumb Schema
Always add BreadcrumbList JSON-LD: Home → Job Search FAQ → [question]

### 5. Page Signals
- `<h1>`: exact question text
- Answer-first block immediately after `<h1>` (no intro text before it)
- Supporting `<h2>` sections for elaboration
- Internal link back to Job Genie home and CTA to free autopsy

## URL Slug Convention
Slugs are derived from the normalised question:
- Lower-case
- Non-alphanumeric characters stripped
- Spaces replaced with hyphens
- Max 80 characters
- Served at `/qa/<slug>` (job-genie SPA route) and `/api/qa/<slug>` (JSON API)

## Quality Gate (minimum score 7.0/10)
Evaluated by Claude against:
1. Directly answers the stated question (2 pts)
2. Job-Genie framing and vocabulary (2 pts)
3. No fluff or filler (2 pts)
4. Factually careful (2 pts)
5. answer_first_block is standalone (2 pts)
6. answer_first_block appears verbatim in answer_md (2 pts)

Total /12 → divide by 1.2 → score /10

## robots.txt Requirements
```
User-agent: *
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: meta-externalagent
Allow: /

User-agent: facebookexternalhit
Allow: /

Sitemap: https://job-genie.ai/sitemap.xml
```

## Content Vocabulary (always use)
- Application Silence Score
- Recruiter-Fit Gap / Recruiter-Fit Matrix
- Truth Layer
- Recruiter-Ready Brief
- Hidden job market
- Ghost jobs / ghost job listings
- Application Silence

## Loop 1 Trigger Points
- Automatic: daily at 3 AM (node-cron)
- Manual: POST /api/admin/loops/loop1/run (Bearer ADMIN_TOKEN)
- Manual seed: POST /api/admin/corpus/questions (for Quora/LinkedIn content)
