---
name: Git provider versus workspace push authentication
description: Native Git connection indicators do not prove command-line write access.
---

Verify GitHub write access with a push dry run; neither a successful public fetch nor the Git pane's “Active” indicator proves that workspace Git commands can authenticate a push.

**Why:** The native provider showed active and fetching succeeded, while command-line pushes still rejected credentials after reconnection and a workspace refresh.

**How to apply:** Compare Git pane status with the command-line error before repeatedly requesting reconnection. Do not change a correct remote URL or force-push to address authentication. If preparing a merge for a user-initiated Git pane push, preserve both histories and clearly distinguish a completed local merge from an actual push. Native Git providers are distinct from application API integrations.

GitHub's `github-source-control` connection is a special native Git provider: its integration instructions say Git and GitHub CLI authentication is automatic and no separate project attachment is needed. A search result of `not_added` is therefore not sufficient evidence of missing attachment.

**Why:** The connection search reported `not_added`, but attaching it returned `connectionAlreadyAdded: true` and explicitly described the provider as already active.

**How to apply:** Trust the returned provider-specific instructions; do not infer missing project binding from the generic search status. Check authorization context when credentials are rejected, but do not assume generic connector authorization cards support this native provider.

The generic reconnection and connection actions can reject this source-control connection despite its authorization context reporting healthy. Reconnection reported it was not connected; the first-time connection action required an underlying connector or MCP provider identifier.

**Why:** Native Git provider connections do not behave like ordinary application connectors across these interfaces.

**How to apply:** If those actions reject the native provider, stop repeating them. Use the native Git provider settings, or offer a separately authorized secure credential fallback for command-line pushes. Clearly state that a fallback does not repair the Git pane's provider indicator.

A user-authorized, repository-scoped token supplied through Replit Secrets can authenticate a transient Git credential helper when native authentication fails. Keep the helper destination-scoped and per-command; never persist credentials in remote URLs, source, or Git configuration.

**Why:** This fallback passed GitHub's push-access check after native authentication and provider reconnection actions failed.

**How to apply:** Disable credential tracing, keep helper output internal to Git, preserve remote history, and recommend revoking the short-lived token and removing its Secret after the push. Do not describe the fallback as repairing native Git provider status.
