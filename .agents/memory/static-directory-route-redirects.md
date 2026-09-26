---
name: Static directory route redirects
description: Why direct HTTP checks of pre-rendered marketing paths can appear to fail despite real pages being served.
---

Static production hosting redirects an extensionless path to its trailing-slash directory URL before serving that directory's pre-rendered index. An HTTP check that does not follow redirects sees 301 with no page head, even though the destination is a real 200 page with its own metadata.

**Why:** A requested acceptance command checked the first response only and incorrectly appeared to fail every resource route. The destination response had unique title, description, canonical and Open Graph metadata; missing paths returned genuine 404.

**How to apply:** For resource-route audits, inspect both the initial Location and the final response using curl -L; don't replace healthy directory indexes with a homepage fallback just to make the first hop return 200.