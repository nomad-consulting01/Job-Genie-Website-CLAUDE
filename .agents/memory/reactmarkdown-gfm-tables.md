---
name: ReactMarkdown GFM tables and raw HTML
description: react-markdown silently fails to render pipe tables and inline HTML tags unless extra plugins are wired in.
---

By default `react-markdown` only supports CommonMark. Markdown tables (`| a | b |`) render as literal pipe-separated text, and raw HTML tags (e.g. `<br/>`) render as escaped literal text, unless you explicitly add:

- `remark-gfm` (via `remarkPlugins={[remarkGfm]}`) for GFM tables, strikethrough, task lists.
- `rehype-raw` (via `rehypePlugins={[rehypeRaw]}`) to parse raw HTML embedded in markdown source.

**Why:** hit this building a data table with multi-line cells (title + description via `<br/>`) in a legal/marketing page — output showed raw `| --- |` and `<br/>` text until both plugins were added.

**How to apply:** whenever markdown content needs tables or inline HTML, add both packages and wire them into the `<ReactMarkdown>` call; don't assume table/HTML support is built in.
