import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Deterministic social cards. Run manually when the shared social metadata changes.
const root = fileURLToPath(new URL('../', import.meta.url));
const cards = JSON.parse(readFileSync(`${root}src/data/autopsy-social.json`, 'utf8'));
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
mkdirSync(`${root}public/social`, { recursive: true });

for (const [slug, card] of Object.entries(cards)) {
  const a = card.accent;
  let diagram;
  if (slug === 'free-autopsy') {
    diagram = [0, 1, 2].map((i) => `<rect x="${840 + i * 20}" y="${230 + i * 85}" width="${270 - i * 40}" height="55" rx="8" fill="${a}" opacity="${.9 - i * .25}"/><text x="${865 + i * 20}" y="${264 + i * 85}" fill="#10152d" font-size="17">${['Résumé screen', 'Recruiter pass', 'Silence'][i]}</text>`).join('');
  } else if (slug === 'free-autopsy2') {
    diagram = [260, 225, 185, 150, 100].map((w, i) => `<text x="824" y="${249 + i * 46}" fill="#9aabc6" font-size="15">${i + 1}</text><rect x="850" y="${230 + i * 46}" width="${w}" height="25" rx="5" fill="${a}" opacity="${i < 3 ? .9 : .25}"/>`).join('') + `<path d="M818 361h310" stroke="#f5f5f5" stroke-dasharray="5 5"/><text x="850" y="477" fill="#bec9df" font-size="16">Illustrative shortlist</text>`;
  } else if (slug === 'free-autopsy3') {
    diagram = `<path d="M810 326h35m0 0v-83h50m-50 83h50m-50 0v83h50" fill="none" stroke="${a}" stroke-width="3"/>` + ['Job boards', 'Career pages', 'Recruiters'].map((text, i) => `<rect x="895" y="${218 + i * 83}" width="235" height="52" rx="9" fill="#18233b" stroke="${a}" stroke-opacity=".5"/><text x="916" y="${251 + i * 83}" fill="#e7edf6" font-size="18">${text}</text>`).join('');
  } else {
    diagram = `<rect x="812" y="205" width="310" height="290" rx="15" fill="#18233b" stroke="${a}" stroke-opacity=".5"/><text x="836" y="245" fill="${a}" font-size="13">ILLUSTRATIVE PREVIEW</text><circle cx="867" cy="311" r="35" fill="none" stroke="${a}" stroke-width="9"/><text x="926" y="306" fill="#e7edf6" font-size="18">Score</text><text x="926" y="333" fill="#9aabc6" font-size="15">Sample data</text><path d="M837 381h252m-252 36h215m-215 36h237" stroke="${a}" stroke-opacity=".5" stroke-width="9"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#0c1228"/>
    <path d="M60 115h1080" stroke="#26334c"/>
    <g font-family="DejaVu Sans">
      <text x="60" y="76" fill="#f4f6fb" font-size="30" font-weight="bold">Job Genie</text>
      <text x="60" y="170" fill="${a}" font-size="16" letter-spacing="2">${escape(card.label)}</text>
      ${card.lines.map((line, i) => `<text x="58" y="${258 + i * 73}" fill="#f4f6fb" font-size="60" font-weight="bold">${escape(line)}</text>`).join('')}
      <text x="60" y="495" fill="#b4c0d8" font-size="22">${escape(card.subtitle)}</text>
      ${diagram}
      <text x="60" y="583" fill="${a}" font-size="17">APPLICATION AUTOPSY</text>
      <text x="930" y="583" fill="#b4c0d8" font-size="17">job-genie.ai</text>
    </g>
  </svg>`;
  const tmp = `/tmp/${slug}-social.svg`;
  writeFileSync(tmp, svg);
  execFileSync('magick', ['-background', 'none', tmp, `${root}public${card.image}`]);
  rmSync(tmp);
  console.log(`Generated ${card.image}`);
}