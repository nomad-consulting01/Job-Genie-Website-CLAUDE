#!/usr/bin/env node
/**
 * Validates content/landing-pages.json against the LandingPage TypeScript
 * interface defined in artifacts/job-genie/src/data/landing-pages.ts.
 *
 * Run:  node scripts/validate-landing-pages.mjs
 * Exit: 0 on success, 1 if any page fails validation.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isString(v) {
  return typeof v === "string";
}

function isStringArray(v) {
  return Array.isArray(v) && v.every(isString);
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Load and parse data
// ---------------------------------------------------------------------------

let raw;
try {
  raw = readFileSync(join(root, "content/landing-pages.json"), "utf8");
} catch (err) {
  console.error(`ERROR: Could not read content/landing-pages.json — ${err.message}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error(`ERROR: content/landing-pages.json is not valid JSON — ${err.message}`);
  process.exit(1);
}

if (!data || !Array.isArray(data.pages)) {
  console.error('ERROR: landing-pages.json must have a top-level "pages" array.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Validators (mirror the TS interfaces exactly)
// ---------------------------------------------------------------------------

function validateFAQItem(item, path) {
  const errors = [];
  if (!isPlainObject(item)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (!isString(item.q)) errors.push(`${path}.q must be a string`);
  if (!isString(item.a)) errors.push(`${path}.a must be a string`);
  return errors;
}

function validateSourceItem(item, path) {
  const errors = [];
  if (!isPlainObject(item)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (!isString(item.text)) errors.push(`${path}.text must be a string`);
  if (!isString(item.source)) errors.push(`${path}.source must be a string`);
  return errors;
}

function validateGlossaryTerm(item, path) {
  const errors = [];
  if (!isPlainObject(item)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (!isString(item.term)) errors.push(`${path}.term must be a string`);
  if (!isString(item.definition)) errors.push(`${path}.definition must be a string`);
  return errors;
}

function validatePageSection(section, path) {
  const errors = [];
  if (!isPlainObject(section)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (!isString(section.heading)) errors.push(`${path}.heading must be a string`);
  if (!isString(section.body)) errors.push(`${path}.body must be a string`);

  if (section.list !== undefined) {
    if (!isStringArray(section.list)) {
      errors.push(`${path}.list must be an array of strings`);
    }
  }

  if (section.howToSteps !== undefined) {
    if (!Array.isArray(section.howToSteps)) {
      errors.push(`${path}.howToSteps must be an array`);
    } else {
      section.howToSteps.forEach((step, i) => {
        if (!isPlainObject(step)) {
          errors.push(`${path}.howToSteps[${i}] must be an object`);
        } else {
          if (!isString(step.name)) errors.push(`${path}.howToSteps[${i}].name must be a string`);
          if (!isString(step.text)) errors.push(`${path}.howToSteps[${i}].text must be a string`);
        }
      });
    }
  }

  if (section.comparisonTable !== undefined) {
    if (!isPlainObject(section.comparisonTable)) {
      errors.push(`${path}.comparisonTable must be an object`);
    } else {
      const ct = section.comparisonTable;
      if (!isStringArray(ct.headers)) {
        errors.push(`${path}.comparisonTable.headers must be an array of strings`);
      }
      if (!Array.isArray(ct.rows)) {
        errors.push(`${path}.comparisonTable.rows must be an array of string arrays`);
      } else if (!ct.rows.every(isStringArray)) {
        errors.push(`${path}.comparisonTable.rows must be an array of string arrays`);
      }
    }
  }

  return errors;
}

function validateCta(cta, path) {
  const errors = [];
  if (!isPlainObject(cta)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (!isString(cta.headline)) errors.push(`${path}.headline must be a string`);
  if (!isString(cta.buttonText)) errors.push(`${path}.buttonText must be a string`);
  if (!isString(cta.buttonUrl)) errors.push(`${path}.buttonUrl must be a string`);
  return errors;
}

function validateLandingPage(page, index) {
  if (!isPlainObject(page)) {
    return [`pages[${index}] must be an object`];
  }

  const slug = isString(page.slug) ? page.slug : `[index ${index}]`;
  const p = `pages[${index}] (slug: "${slug}")`;
  const errors = [];

  // Required string fields
  const requiredStrings = [
    "slug", "metaTitle", "metaDescription", "canonicalUrl",
    "robots", "primaryQuestion", "h1", "directAnswer", "llmSummary",
  ];
  for (const field of requiredStrings) {
    if (!isString(page[field])) {
      errors.push(`${p}: "${field}" must be a string`);
    }
  }

  // keyTakeaways: string[]  (empty array is valid per the TS interface)
  if (!isStringArray(page.keyTakeaways)) {
    errors.push(`${p}: "keyTakeaways" must be an array of strings`);
  }

  // schemas: string[]
  if (!isStringArray(page.schemas)) {
    errors.push(`${p}: "schemas" must be an array of strings`);
  }

  // sections: PageSection[]
  if (!Array.isArray(page.sections)) {
    errors.push(`${p}: "sections" must be an array`);
  } else {
    page.sections.forEach((section, i) => {
      errors.push(...validatePageSection(section, `${p}.sections[${i}]`));
    });
  }

  // faqs: FAQItem[]
  if (!Array.isArray(page.faqs)) {
    errors.push(`${p}: "faqs" must be an array`);
  } else {
    page.faqs.forEach((faq, i) => {
      errors.push(...validateFAQItem(faq, `${p}.faqs[${i}]`));
    });
  }

  // sources: SourceItem[]
  if (!Array.isArray(page.sources)) {
    errors.push(`${p}: "sources" must be an array`);
  } else {
    page.sources.forEach((src, i) => {
      errors.push(...validateSourceItem(src, `${p}.sources[${i}]`));
    });
  }

  // cta: { headline, buttonText, buttonUrl }
  errors.push(...validateCta(page.cta, `${p}.cta`));

  // glossaryTerms?: GlossaryTerm[]  (optional)
  if (page.glossaryTerms !== undefined) {
    if (!Array.isArray(page.glossaryTerms)) {
      errors.push(`${p}: "glossaryTerms" must be an array when present`);
    } else {
      page.glossaryTerms.forEach((term, i) => {
        errors.push(...validateGlossaryTerm(term, `${p}.glossaryTerms[${i}]`));
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let totalErrors = 0;

try {
  data.pages.forEach((page, index) => {
    const errors = validateLandingPage(page, index);
    if (errors.length > 0) {
      errors.forEach((e) => console.error(`  ✗ ${e}`));
      totalErrors += errors.length;
    }
  });
} catch (err) {
  console.error(`ERROR: Unexpected failure during validation — ${err.message}`);
  process.exit(1);
}

if (totalErrors > 0) {
  console.error(`\nvalidate-landing-pages: FAILED — ${totalErrors} error(s) in content/landing-pages.json`);
  process.exit(1);
} else {
  const count = data.pages.length;
  console.log(`validate-landing-pages: OK — ${count} page${count !== 1 ? "s" : ""} passed`);
}
