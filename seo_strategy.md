# SEO Strategy

## In scope
- Public marketing pages on the Job Genie web app
- Prerendered AEO pages and the homepage
- Public blog content and blog listing pages
- Public answers / Q&A pages
- Public legal / trust pages (`/terms`, `/privacy`, `/data-deletion`)

## Out of scope
- Authenticated or internal product flows behind the app experience
- Admin pages (`/admin/**`)
- Legacy experiment landing variants routed through `/:slug` that are already marked `noindex` in `artifacts/job-genie/src/data/variants.json`, unless they are promoted as canonical SEO targets in a future strategy update

## Target audience
- Mid-career and specialist professionals experiencing "application silence"
- Senior engineers and career changers who are not getting interview traction
- Job seekers looking for recruiter-fit, hidden job market, and ghost job guidance

## Primary keywords
- application silence
- application silence score
- ghost jobs
- hidden job market
- recruiter-fit gap
- why am I not getting job interview responses

## Dismissed categories
- None yet.

## Notes
- The public site is now hybrid prerender + API SSR: homepage, AEO pages, and legal pages are prerendered, while `/blog`, `/answers`, `/answers/:slug`, `/qa`, `/qa/:slug`, `/sitemap.xml`, and `/llms.txt` are served by the API artifact at canonical root paths.
- The current highest-impact gaps are concentrated in the `/qa` section: discovery coverage (internal links + sitemap/llms.txt), missing social preview images, and a broken favicon path in API-rendered HTML.
