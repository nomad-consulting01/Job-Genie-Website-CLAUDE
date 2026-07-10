---
name: Facebook Page posting token setup
description: How to get a working long-lived token for server-side posting to a Facebook Page via Graph API, and common pitfalls that produce confusing errors.
---

To post to a Facebook Page's `/feed` from a server, you need a **Page Access Token**, not a User token, App token, or raw System User token.

Working setup (Business Manager System User flow):
1. Create a System User in Business Settings → Users → System Users.
2. Assign the app to the System User under Business Settings → Accounts → Apps (People/Assign) with a role — otherwise token generation shows "No permissions available".
3. Assign the target Page to the System User under Business Settings → Accounts → Pages — otherwise the `pages_*` permissions won't appear as selectable when generating a token, even if the app is assigned.
4. Generate the System User token with `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
5. **This System User token itself cannot post to the page** — exchange it for the page-scoped token: `GET /{page-id}?fields=access_token&access_token={system_user_token}`. Verify with `GET /debug_token?input_token={token}` — a working page token shows `"type": "PAGE"` and `"profile_id"` matching the page ID; the system user token shows `"type": "SYSTEM_USER"` with no target/profile_id.

**Why:** Errors are easy to misdiagnose — "(#100) global id not allowed" usually means the Page ID is wrong for that app (e.g. leftover ID from a differently-scoped app); "(#200) requires pages_manage_posts..." with a token that *does* have that scope in `/debug_token` usually means it's the System User token (unscoped) rather than the page-exchanged token.

**How to apply:** When wiring any Meta/Facebook Page automation, always store the page-exchanged token (type PAGE) as the credential, and re-derive it via step 5 if posting fails with permission errors despite correct-looking scopes.
