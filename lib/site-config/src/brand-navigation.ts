/** Shared by React pages and the server-rendered public FAQ pages. */
export const BRAND_NAV_STYLES = `
.jg-nav-space{height:100px}
.jg-nav{position:fixed;top:10px;left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:1160px;z-index:200;background:rgba(10,16,42,.95);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(245,245,242,.1);border-radius:999px;padding:10px 16px 10px 20px;display:flex;align-items:center;justify-content:space-between;gap:20px;font-family:Manrope,sans-serif;line-height:1.6;color:#F5F5F2}
.jg-nav *{box-sizing:border-box}
.jg-nav .jg-logo{display:flex;align-items:center;gap:9px;font-family:Sora,sans-serif;font-weight:700;font-size:17px;letter-spacing:-.02em;white-space:nowrap;color:#F5F5F2;text-decoration:none}
.jg-logo img{display:block;width:36px;height:36px;object-fit:contain;flex-shrink:0}
.jg-nav .jg-links{display:flex;align-items:center;gap:20px;list-style:none;margin:0;padding:0}
.jg-nav .jg-links a{font-size:14px;font-weight:500;color:rgba(245,245,242,.6);text-decoration:none;white-space:nowrap}
.jg-nav .jg-links a:hover{color:#F5F5F2}
.jg-nav a.jg-cta{display:inline-flex;justify-content:center;background:rgba(245,245,242,.06);border:1px solid rgba(245,245,242,.1);border-radius:999px;padding:9px 18px;color:#F5F5F2;font-size:13px;font-weight:700;text-decoration:none}
.jg-nav a.jg-cta:hover{background:rgba(245,245,242,.1)}
.jg-nav :focus-visible{outline:2px solid #7B79FF;outline-offset:4px}
.jg-menu{display:none}
.jg-menu summary{cursor:pointer;list-style:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#F5F5F2}
.jg-menu summary::-webkit-details-marker{display:none}
.jg-menu summary svg{width:22px;height:22px}
.jg-menu[open] summary .jg-menu-lines{display:none}
.jg-menu summary .jg-menu-close{display:none}
.jg-menu[open] summary .jg-menu-close{display:block}
.jg-menu-panel{position:absolute;top:calc(100% + 10px);left:0;right:0;background:rgba(10,16,42,.98);border:1px solid rgba(245,245,242,.1);border-radius:18px;padding:16px;max-height:calc(100dvh - 100px);overflow:auto;display:flex;flex-direction:column;gap:2px}
.jg-nav .jg-menu-panel a{display:block;padding:10px 14px;color:rgba(245,245,242,.8);font-size:14px;text-decoration:none;border-radius:8px}
.jg-nav .jg-menu-panel a:hover{background:rgba(245,245,242,.07);color:#F5F5F2}
.jg-nav .jg-menu-panel .jg-cta{margin-top:8px;text-align:center;border-radius:999px}
@media(max-width:1100px){.jg-nav .jg-links{display:none}.jg-menu{display:block}}
`;

const NAV_LINKS = [
  ["/#how", "How It Works"],
  ["/#truth-layer", "Evidence layer"],
  ["/#feat", "Features"],
  ["/#price", "Pricing"],
  ["/resources/", "Resources"],
  ["/blog", "Blog"],
  ["/qa", "FAQ"],
];

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderBrandNavigation(base = "") {
  const prefix = escapeAttribute(base.replace(/\/$/, ""));
  const links = NAV_LINKS.map(([path, label]) => `<a href="${prefix}${path}">${label}</a>`);
  const cta = `<a href="${prefix}/free-autopsy/" class="jg-cta" data-jg-cta>Get Free Autopsy</a>`;
  return `<nav class="jg-nav" aria-label="Main navigation">
    <a href="${prefix}/" class="jg-logo" aria-label="Job Genie home"><img src="${prefix}/logo.png" alt="" width="36" height="36" />Job Genie</a>
    <ul class="jg-links">${links.map(link => `<li>${link}</li>`).join("")}<li>${cta}</li></ul>
    <details class="jg-menu"><summary aria-label="Toggle navigation menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path class="jg-menu-lines" d="M3 5h18M3 12h18M3 19h18"/><path class="jg-menu-close" d="m5 5 14 14M19 5 5 19"/></svg></summary><div class="jg-menu-panel">${links.join("")}${cta}</div></details>
  </nav><div class="jg-nav-space" aria-hidden="true"></div>`;
}