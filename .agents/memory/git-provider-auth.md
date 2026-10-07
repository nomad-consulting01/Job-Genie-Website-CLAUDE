---
name: Git provider versus workspace push authentication
description: Native Git connection indicators do not prove command-line write access.
---

Verify GitHub write access with a push dry run; neither a successful public fetch nor the Git pane's “Active” indicator proves that workspace Git commands can authenticate a push.

**Why:** The native provider showed active and fetching succeeded, while command-line pushes still rejected credentials after reconnection and a workspace refresh.

**How to apply:** Compare Git pane status with the command-line error before repeatedly requesting reconnection. Do not change a correct remote URL or force-push to address authentication. If preparing a merge for a user-initiated Git pane push, preserve both histories and clearly distinguish a completed local merge from an actual push. Native Git providers are distinct from application API integrations.
