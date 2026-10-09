// Builds a contact sheet of review stills: node scripts/sheet.mjs <prefix> <cols> <cellWidth> <out>
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "/home/user/moneymap/node_modules/playwright/index.mjs";
const [, , prefix, cols = "5", cw = "380", out = "out/sheet.png"] = process.argv;
const dir = path.resolve("out/stills");
const files = readdirSync(dir).filter((f) => f.startsWith(prefix)).sort();
const html = `<html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:6px;padding:6px">${files.map((f) => `<div style="position:relative"><img src="file://${dir}/${f}" style="width:${cw}px;display:block"><span style="position:absolute;left:4px;top:4px;background:#000c;color:#fff;font:12px monospace;padding:1px 4px">${f.replace(/\D+/g, " ").trim()}</span></div>`).join("")}</body></html>`;
writeFileSync("out/sheet.html", html);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: Number(cols) * (Number(cw) + 6) + 6, height: 400 } });
await p.goto("file://" + path.resolve("out/sheet.html"));
await p.waitForTimeout(500);
await p.screenshot({ path: out, fullPage: true });
await b.close();
