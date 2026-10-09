// Renders review frames of every scene (both layouts) so they can be checked before the final export.
// Usage: node scripts/stills.mjs [Landscape|Portrait] [frame,frame,...]
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const T = JSON.parse(readFileSync(new URL("../src/timeline.json", import.meta.url)));
const [, , which, list] = process.argv;
const comps = which ? [which] : ["Landscape", "Portrait"];
let frames = list ? list.split(",").map(Number) : [];
if (!frames.length) {
  for (const s of T.scenes) {
    const a = s.startBar * T.barFrames, d = s.bars * T.barFrames;
    frames.push(a + Math.round(d * 0.25), a + Math.round(d * 0.6), a + d - 14);
  }
  frames.unshift(0);
}
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const out = path.resolve("out/stills");
mkdirSync(out, { recursive: true });
for (const id of comps) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  for (const frame of frames) {
    await renderStill({ composition, serveUrl, frame, output: `${out}/${id}-${String(frame).padStart(4, "0")}.png`, browserExecutable });
  }
  console.log(id, "stills:", frames.join(","));
}
