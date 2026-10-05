/** Identical listing-page styling before and after the React app loads. */
export const BLOG_INDEX_STYLES = `
html,body{margin:0}
.jg-blog,.jg-blog *,.jg-blog *::before,.jg-blog *::after{box-sizing:border-box}
.jg-blog{min-height:100vh;background:var(--nn,#0A102A);color:var(--wh,#F5F5F2);font-family:Manrope,sans-serif;line-height:1.6}
.jg-blog .blog-main{max-width:1024px;margin:0 auto;padding:48px 24px 64px}
.jg-blog .blog-intro{margin-bottom:48px}
.jg-blog .blog-eyebrow{display:inline-flex;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:6px 14px;border-radius:999px;background:rgba(74,71,255,.1);border:1px solid rgba(74,71,255,.2);color:#7B79FF;margin:0 0 20px}
.jg-blog h1,.jg-blog h2{font-family:Sora,sans-serif;color:#F5F5F2}
.jg-blog .blog-title{font-size:clamp(34px,5vw,56px);font-weight:800;line-height:1.08;letter-spacing:-.03em;margin:0 0 24px}
.jg-blog .blog-lead{font-size:18px;line-height:1.75;color:rgba(245,245,242,.6);max-width:680px;margin:0}
.jg-blog .blog-newsletter{color:#2DD4BF;text-decoration:underline;text-underline-offset:3px}
.jg-blog .blog-count{font-size:12px;color:rgba(245,245,242,.6);margin:0 0 24px}
.jg-blog .blog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;list-style:none;margin:0;padding:0}
.jg-blog .blog-card-link{display:block;text-decoration:none;color:inherit;height:100%}
.jg-blog .blog-card{background:#141D44;border:1px solid rgba(245,245,242,.1);border-radius:20px;padding:24px;height:100%;display:flex;flex-direction:column;transition:background .2s,border-color .2s}
.jg-blog .blog-card:hover{background:#18224D;border-color:rgba(123,121,255,.45)}
.jg-blog .blog-meta{display:flex;align-items:center;flex-wrap:wrap;gap:12px;font-size:12px;color:rgba(245,245,242,.6);margin-bottom:14px}
.jg-blog .blog-newsletter-label{color:#2DD4BF;font-weight:600}
.jg-blog .blog-card-title{font-size:18px;font-weight:700;line-height:1.45;letter-spacing:-.02em;margin:0 0 12px;flex:1}
.jg-blog .blog-card-title a{color:inherit;text-decoration:none}
.jg-blog .blog-card:hover .blog-card-title{color:#A8A6FF}
.jg-blog .blog-description{font-size:14px;line-height:1.75;color:rgba(245,245,242,.6);margin:0 0 20px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.jg-blog .blog-card-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto}
.jg-blog .blog-tags{display:flex;flex-wrap:wrap;gap:8px}
.jg-blog .blog-tag{font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(74,71,255,.1);color:#A8A6FF;border:1px solid rgba(123,121,255,.3)}
.jg-blog .blog-external{font-size:11px;color:rgba(245,245,242,.6);margin-left:auto;white-space:nowrap}
.jg-blog .blog-empty{text-align:center;padding:80px 0;color:rgba(245,245,242,.6)}
.jg-blog .blog-empty-icon{font-size:40px;margin-bottom:16px}
.jg-blog .blog-error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#FCA5A5;border-radius:14px;padding:24px;text-align:center;font-size:14px}
.jg-blog .blog-cta-section{border-top:1px solid rgba(245,245,242,.1);padding:48px 24px;text-align:center}
.jg-blog .blog-cta-section p{color:rgba(245,245,242,.6);font-size:14px;margin:0 0 20px}
.jg-blog .blog-cta{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#4A47FF,#5D5BFF);color:#F5F5F2;font-family:Manrope,sans-serif;font-size:15px;font-weight:700;padding:14px 26px;border-radius:999px;text-decoration:none;transition:box-shadow .2s}
.jg-blog .blog-cta:hover{box-shadow:0 8px 36px rgba(74,71,255,.4)}
.jg-blog :focus-visible{outline:2px solid #7B79FF;outline-offset:4px}
@media(max-width:640px){.jg-blog .blog-grid{grid-template-columns:1fr}.jg-blog .blog-main{padding:32px 20px 48px}.jg-blog .blog-title{font-size:34px}.jg-blog .blog-lead{font-size:16px}}
`;