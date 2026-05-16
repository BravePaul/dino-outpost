#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("test-results/regression");
const BASELINE = path.join(ROOT, "baseline");
const CURRENT = path.join(ROOT, "current");
const REPORT = path.join(ROOT, "report.html");

if (!fs.existsSync(CURRENT)) {
  console.error("No current screenshots found. Run: npm run regression:capture");
  process.exit(1);
}

const currents = fs
  .readdirSync(CURRENT)
  .filter((f) => f.endsWith(".png"))
  .sort();

if (currents.length === 0) {
  console.error(`No .png files in ${CURRENT}. Run: npm run regression:capture`);
  process.exit(1);
}

const hasBaseline = fs.existsSync(BASELINE);

const rows = currents
  .map((name) => {
    const baselineExists = hasBaseline && fs.existsSync(path.join(BASELINE, name));
    const baselineCell = baselineExists
      ? `<img src="baseline/${name}" alt="baseline ${name}">`
      : `<div class="missing">no baseline yet</div>`;
    return `
    <section>
      <h2>${name}</h2>
      <div class="pair">
        <figure>
          <figcaption>baseline</figcaption>
          ${baselineCell}
        </figure>
        <figure>
          <figcaption>current</figcaption>
          <img src="current/${name}" alt="current ${name}">
        </figure>
      </div>
    </section>`;
  })
  .join("\n");

const timestamp = new Date().toISOString();
const baselineNote = hasBaseline
  ? `Comparing current against locked baseline.`
  : `No baseline locked yet. Approve current with <code>npm run regression:baseline</code> after review.`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Dino Outpost — Regression Report</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background:#15171c; color:#dde; margin:0; padding:24px; }
  h1 { font-weight: 300; margin: 0 0 4px; }
  p.meta { color:#889; font-size: 12px; margin: 0 0 24px; }
  section { margin-bottom: 32px; }
  h2 { font-size: 13px; font-weight: 500; color:#9aa; margin: 0 0 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  figure { margin: 0; }
  figcaption { font-size: 11px; color:#778; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
  img { width: 100%; display:block; border: 1px solid #2a2d35; background: #000; }
  .missing { aspect-ratio: 16/9; display:flex; align-items:center; justify-content:center; color:#556; border:1px dashed #333; font-size:12px; }
  code { background:#222; padding: 1px 6px; border-radius: 3px; font-size: 12px; }
</style>
</head>
<body>
  <h1>Regression Report</h1>
  <p class="meta">${timestamp} — ${baselineNote}</p>
  ${rows}
</body>
</html>`;

fs.writeFileSync(REPORT, html);
console.log(`Wrote ${REPORT}`);
console.log(`Open with: open "${REPORT}"`);
