// Builds every MoneyMap brand file from one drawing: favicons, app icons, the social image and
// the brand kit in docs/brand. Run with `npm run brand`; output is committed.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const NIGHT = "#071226";
const MINT = "#2ee6a8";
const FONT_LINK = '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">';

/** The mark. `ring` adds the contour around the goal (dropped at tiny sizes); `bleed` fills the square for app icons. */
function mark({ ring = true, bleed = false, mono = null, frame = true } = {}) {
  const route = mono ?? "url(#rt)";
  const dotStart = mono ?? "#ffffff";
  const dotGoal = mono ?? MINT;
  const tail = mono ?? "#ffffff";
  const bg = frame && !mono ? `<rect width="64" height="64" rx="${bleed ? 0 : 18}" fill="url(#bg)"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop stop-color="#12274f"/><stop offset="1" stop-color="#050d1d"/></linearGradient>
    <linearGradient id="rt" x1="12" y1="49" x2="43" y2="15" gradientUnits="userSpaceOnUse"><stop stop-color="#7aa2ff"/><stop offset="1" stop-color="${MINT}"/></linearGradient>
  </defs>
  ${bg}
  <g${bleed ? ' transform="translate(6.4 6.4) scale(.8)"' : ""}>
    ${ring ? `<circle cx="43" cy="16" r="10" stroke="${mono ?? MINT}" stroke-opacity=".25" stroke-width="2"/>` : ""}
    <path d="M43 16 L52 49" stroke="${tail}" stroke-opacity=".26" stroke-width="6" stroke-linecap="round"/>
    <path d="M12 49 L21.5 17 L32 37 L43 16" stroke="${route}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="12" cy="49" r="4.5" fill="${dotStart}"/>
    <circle cx="43" cy="16" r="6" fill="${dotGoal}"/>
  </g>
</svg>`;
}

function horizontal(theme) {
  const ink = theme === "dark" ? "#ffffff" : "#0a1628";
  const map = theme === "dark" ? MINT : "#047857";
  const inner = mark().replace(/<svg[^>]*>/, "").replace("</svg>", "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 64" fill="none">
  <svg width="64" height="64" viewBox="0 0 64 64">${inner}</svg>
  <text x="80" y="43" font-family="Geist, Inter, system-ui, sans-serif" font-size="34" font-weight="600" letter-spacing="-1.1" fill="${ink}">Money<tspan fill="${map}">Map</tspan></text>
</svg>`;
}

const ogHtml = `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}<style>
  body{margin:0;width:1200px;height:630px;font-family:Geist,Inter,system-ui,sans-serif;color:#fff;overflow:hidden;
    background:radial-gradient(60% 80% at 88% 0%,rgb(46 230 168/.20),transparent 60%),radial-gradient(50% 70% at 0% 100%,rgb(47 107 255/.25),transparent 60%),linear-gradient(160deg,#0b1b38,#071226 55%,#050d1d)}
  .wrap{position:absolute;inset:0;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:18px;font-size:34px;font-weight:600;letter-spacing:-1px}
  .brand b{color:${MINT};font-weight:600}
  h1{margin:0;font-size:84px;line-height:1;font-weight:600;letter-spacing:-3.5px}
  h1 i{font-family:"Instrument Serif",Georgia,serif;font-weight:400;color:${MINT};letter-spacing:-1px}
  p{margin:22px 0 0;max-width:620px;font-size:30px;line-height:1.35;color:rgb(255 255 255/.7);letter-spacing:-.3px}
  .foot{font-size:22px;color:rgb(255 255 255/.5)}
  svg.route{position:absolute;right:-30px;bottom:-30px;opacity:.9}
</style></head><body>
<svg class="route" width="470" height="318" viewBox="0 0 620 420" fill="none">
  <g stroke="#fff" stroke-opacity=".06">${Array.from({ length: 7 }, (_, k) => `<ellipse cx="470" cy="110" rx="${(k + 1) * 46}" ry="${(k + 1) * 30}"/>`).join("")}</g>
  <path d="M60 380 L230 150 L330 260 L470 110" stroke="url(#g)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M470 110 L560 380" stroke="#fff" stroke-opacity=".2" stroke-width="10" stroke-linecap="round"/>
  <circle cx="60" cy="380" r="14" fill="#fff"/><circle cx="470" cy="110" r="34" stroke="${MINT}" stroke-opacity=".3" stroke-width="3"/><circle cx="470" cy="110" r="18" fill="${MINT}"/>
  <defs><linearGradient id="g" x1="60" y1="380" x2="470" y2="110" gradientUnits="userSpaceOnUse"><stop stop-color="#7aa2ff"/><stop offset="1" stop-color="${MINT}"/></linearGradient></defs>
</svg>
<div class="wrap">
  <div class="brand"><span style="width:60px;height:60px;display:block">${mark()}</span><span>Money<b>Map</b></span></div>
  <div><h1>Your money, <i>mapped.</i><br>One right move.</h1><p>See where your money is going — and the one Zenith product that helps.</p></div>
  <div class="foot">Zenith Bank Zecathon 6.0 · Prototype with sample data</div>
</div></body></html>`;

const sheetHtml = `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}<style>
  body{margin:0;width:1600px;font-family:Geist,Inter,system-ui,sans-serif;background:#f3f6fa;color:#0a1628}
  .pad{padding:64px}
  h1{font-size:44px;margin:0;font-weight:600;letter-spacing:-1.5px} h1 i{font-family:"Instrument Serif";font-weight:400}
  h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#56657c;font-weight:500;margin:48px 0 16px}
  .row{display:flex;gap:20px;flex-wrap:wrap;align-items:stretch}
  .tile{border-radius:24px;padding:36px;display:flex;align-items:center;justify-content:center;min-height:150px}
  .sw{width:220px;border-radius:20px;overflow:hidden;background:#fff;border:1px solid #e2e8f0}
  .sw div{height:110px} .sw p{margin:0;padding:14px 16px;font-size:15px} .sw small{display:block;color:#56657c;font-family:monospace;margin-top:2px}
  .type{background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:32px;flex:1}
  .note{font-size:17px;color:#334159;line-height:1.6;max-width:900px}
</style></head><body><div class="pad">
<h1>MoneyMap <i>brand</i></h1>
<p class="note">The mark is an “M” drawn as a route: it starts at a white “you are here” dot, climbs, and reaches a mint goal at the summit. The faint last leg says the road carries on.</p>
<h2>Logo</h2>
<div class="row">
  <div class="tile" style="background:#fff;border:1px solid #e2e8f0;flex:1">${horizontal("light").replace("<svg ", '<svg width="360" ')}</div>
  <div class="tile" style="background:${NIGHT};flex:1">${horizontal("dark").replace("<svg ", '<svg width="360" ')}</div>
  <div class="tile" style="background:#fff;border:1px solid #e2e8f0"><span style="width:120px;display:block">${mark()}</span></div>
  <div class="tile" style="background:${MINT}"><span style="width:110px;display:block">${mark({ mono: NIGHT, frame: false })}</span></div>
</div>
<h2>Colour</h2>
<div class="row">
  ${[["Midnight", NIGHT, "Backgrounds, headers"], ["Mint", MINT, "The goal, main buttons"], ["Route blue", "#2f6bff", "Links, the start of a route"], ["Ink", "#0a1628", "Text"], ["Canvas", "#f3f6fa", "Page background"], ["Amber", "#f59e0b", "Gentle warnings"]]
    .map(([n, c, u]) => `<div class="sw"><div style="background:${c}"></div><p><b>${n}</b><small>${c}</small><span style="color:#56657c;font-size:14px">${u}</span></p></div>`).join("")}
</div>
<h2>Type</h2>
<div class="row">
  <div class="type"><div style="font-size:56px;font-weight:600;letter-spacing:-2px">Geist</div><div style="color:#56657c">Headings and text · 400 / 500 / 600</div></div>
  <div class="type"><div style="font-family:'Instrument Serif';font-style:italic;font-size:60px">Instrument Serif</div><div style="color:#56657c">One or two words of a heading, never body text</div></div>
</div>
<h2>App icons</h2>
<div class="row" style="align-items:flex-end">
  ${[180, 96, 64, 32, 16].map((s) => `<div style="text-align:center"><span style="width:${s}px;height:${s}px;display:block">${mark({ ring: s >= 32 })}</span><small style="color:#56657c">${s}px</small></div>`).join("")}
</div>
</div></body></html>`;

mkdirSync("docs/brand", { recursive: true });
const files = {
  "public/logo.svg": mark(),
  "public/favicon.svg": mark({ ring: false }),
  "docs/brand/moneymap-mark.svg": mark(),
  "docs/brand/moneymap-mark-white.svg": mark({ mono: "#ffffff", frame: false }),
  "docs/brand/moneymap-mark-midnight.svg": mark({ mono: NIGHT, frame: false }),
  "docs/brand/moneymap-logo-light.svg": horizontal("light"),
  "docs/brand/moneymap-logo-dark.svg": horizontal("dark"),
};
for (const [path, svg] of Object.entries(files)) writeFileSync(path, svg + "\n");

const browser = await chromium.launch();
async function png(html, path, width, height, { transparent = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, omitBackground: transparent, fullPage: height === 0 });
  await page.close();
}
const iconHtml = (svg, size) => `<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</div></body></html>`;

await png(iconHtml(mark({ ring: false }), 32), "public/favicon-32.png", 32, 32, { transparent: true });
await png(iconHtml(mark({ bleed: true }), 180), "public/apple-touch-icon.png", 180, 180);
await png(iconHtml(mark(), 192), "public/icon-192.png", 192, 192, { transparent: true });
await png(iconHtml(mark(), 512), "public/icon-512.png", 512, 512, { transparent: true });
await png(iconHtml(mark({ bleed: true }), 512), "public/icon-maskable-512.png", 512, 512);
await png(ogHtml, "public/og-image.png", 1200, 630);
await png(`<html><head>${FONT_LINK}</head><body style="margin:0;background:#fff;padding:24px">${horizontal("light").replace("<svg ", '<svg width="560" ')}</body></html>`, "docs/brand/moneymap-logo-light.png", 608, 176);
await png(`<html><head>${FONT_LINK}</head><body style="margin:0;background:${NIGHT};padding:24px">${horizontal("dark").replace("<svg ", '<svg width="560" ')}</body></html>`, "docs/brand/moneymap-logo-dark.png", 608, 176);
await png(sheetHtml, "docs/brand/brand-sheet.png", 1600, 0);
await browser.close();
console.log("Brand files written.");
