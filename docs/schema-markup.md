# Job Genie — Schema Markup Reference

---

## 1. Schema Inventory

| Schema type | Where rendered | Purpose |
|---|---|---|
| `Organization` | `index.html` (static) | Brand entity node — anchor for all GEO citations |
| `SoftwareApplication` | `index.html` (static) | App metadata + free offer |
| `FAQPage` (17 pairs) | `index.html` (static) | Full Appendix A FAQ coverage — home page |
| `HowTo` | `index.html` (static) | 3-step Application Autopsy process |
| `Question` (single) | `index.html` (static) | Primary AEO question for home page |
| `WebSite` / `WebPage` | `entry-server.tsx` (per-route) | Per-route page entity + SearchAction |
| `Service` | `entry-server.tsx` (per-route) | Job Genie service + Offer nodes |
| `BreadcrumbList` | `entry-server.tsx` (per-route) | Navigation path for all routes |
| `Question` (per-route) | `entry-server.tsx` (per-route) | AEO primary question for each route |
| `FAQPage` (per-page) | `SEO.tsx` (per-route) | Per-page FAQ accordion content |
| `HowTo` (per-page) | `AEOPage.tsx` (AEO pages) | How-to steps where present |
| `Article` | `AEOPage.tsx` (AEO pages) | Content article metadata |
| `DefinedTerm` / `DefinedTermSet` | `AEOPage.tsx` (glossary page) | Glossary term definitions |
| `BreadcrumbList` | `AEOPage.tsx` (AEO pages) | Navigation path |

---

## 2. Where Each Schema Is Rendered

### `index.html` — Static, pre-rendered, no JS required

These schemas are embedded directly in the HTML template and visible to all crawlers before any JavaScript runs. They are the most authoritative for AI training corpus inclusion.

```html
<!-- Organization: the brand entity node -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://job-genie.ai/#organization",
  "name": "Job Genie",
  "url": "https://job-genie.ai",
  "description": "..."
}
</script>

<!-- SoftwareApplication: app metadata + Offer -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://job-genie.ai/#app",
  ...
}
</script>

<!-- FAQPage: all 17 Appendix A questions -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [ ... 17 Q&A pairs ... ]
}
</script>

<!-- HowTo: 3-step Application Autopsy -->
<!-- Question: primary AEO question -->
```

**Files:** `artifacts/job-genie/index.html` (lines 23–40)

---

### `entry-server.tsx` — Per-route, injected at prerender/SSR time

These schemas are injected into each route's `<head>` during prerendering via `buildHeadHtml()`. They vary per route.

```typescript
// WebSite (home) or WebPage (other routes)
const webPageSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": isHome ? "WebSite" : "WebPage",
  "@id": `${head.canonical}#webpage`,
  ...
});

// Service (all routes)
const serviceSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Job Genie Application Autopsy",
  ...
});

// BreadcrumbList (all routes)
// Question (routes with aeoQuestion set)
```

**File:** `artifacts/job-genie/src/entry-server.tsx` (function `buildHeadHtml`)

---

### `SEO.tsx` — Per-route, rendered by react-helmet-async

`SEO.tsx` is a React component used by individual pages to inject route-specific metadata via Helmet. It outputs FAQPage schema for the page's FAQ accordion.

**File:** `artifacts/job-genie/src/components/SEO.tsx`

---

### `AEOPage.tsx` — AEO landing pages only

Each AEO landing page (7 total) outputs:
- `Article` — content metadata
- `FAQPage` — from `page.faqs[]`
- `HowTo` — from `section.howToSteps[]` (if present)
- `DefinedTerm` — from `page.glossaryTerms[]` (if present)
- `BreadcrumbList`

**File:** `artifacts/job-genie/src/pages/AEOPage.tsx`

---

## 3. How to Add a New Schema

### To `index.html`
Add a new `<script type="application/ld+json">` block before `</head>`. Verify JSON validity with `JSON.parse()` locally or run `pnpm run seo:audit`.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "YourSchemaType",
  ...
}
</script>
```

### To a specific AEO page
Add the schema output to `AEOPage.tsx`. Use the `Helmet` component:

```tsx
import { Helmet } from "react-helmet-async";

// Inside AEOPage render:
const yourSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "...",
  ...
});

<Helmet>
  <script type="application/ld+json">{yourSchema}</script>
</Helmet>
```

### To `entry-server.tsx` (per-route SSR)
Modify `buildHeadHtml()` to include additional schemas for specific routes:

```typescript
const myNewSchema = (isSpecificRoute)
  ? JSON.stringify({ "@context": "https://schema.org", ... })
  : null;

// Add to the `lines` array:
myNewSchema ? `<script type="application/ld+json">${myNewSchema}</script>` : null,
```

---

## 4. Validation Steps

### Local validation
```bash
# JSON.parse check via audit script
pnpm run seo:audit

# Manual check in Node
node -e "const fs = require('fs'); const html = fs.readFileSync('artifacts/job-genie/index.html','utf8'); const blocks = [...html.matchAll(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/g)]; blocks.forEach((b,i) => { try { JSON.parse(b[1]); console.log('Block',i+1,'✓'); } catch(e) { console.error('Block',i+1,'✗',e.message); } });"
```

### External validation
- [Google Rich Results Test](https://search.google.com/test/rich-results) — validates FAQPage, HowTo, Article
- [Schema.org Validator](https://validator.schema.org/) — validates all schema types
- [JSON-LD Playground](https://json-ld.org/playground/) — inspect and debug JSON-LD

---

## 5. Rules and Constraints

### Do
- Match schema content exactly to visible page content (what crawlers see must match what users see)
- Use `@id` anchors for entity nodes to enable knowledge-graph linking
- Include `"@id": "https://job-genie.ai/#organization"` in schemas that reference the Organization node
- Include `"provider": { "@id": "https://job-genie.ai/#organization" }` on Service schemas

### Do not
- **Never add fake reviews or ratings** — `AggregateRating` without real review data is a spam signal and a Google penalty risk
- **Never add schema for content that isn't on the page** — hidden content in schema is a manual action risk
- **Never duplicate the same `@id` in different `@type` contexts** (e.g., two Organization nodes with the same `@id`)
- **Never use `"@type": "Person"` for the Job Genie brand** — it is an Organization
- **Never include the banned 70–80% stat in schema `acceptedAnswer` text** — it surfaces directly in AI training data

### Schema priorities for AEO

| Priority | Schema | Why |
|---|---|---|
| Critical | `FAQPage` + `Question`/`Answer` | Directly targets Featured Snippets and AI Q&A |
| Critical | `Organization` with `@id` | Anchors all GEO citations to a single entity node |
| High | `HowTo` | Targets "how to" queries in rich results |
| High | `BreadcrumbList` | Navigation signals for multi-level AEO pages |
| Medium | `Article` | Content authority signal |
| Medium | `DefinedTerm` | Proprietary vocabulary ownership |
| Low | `SoftwareApplication` | App store-style metadata |
| Avoid | `AggregateRating` | Only when real verified reviews are present |
| Never | Fake/placeholder data | Policy violation + spam signal |
