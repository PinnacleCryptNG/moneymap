// Renders the final videos: 1920x1080 (desktop) and 1080x1920 (Instagram, X), high quality H.264 + AAC.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const only = process.argv[2];
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
mkdirSync("out", { recursive: true });
for (const [id, file] of [["Landscape", "MoneyMap-demo-1920x1080.mp4"], ["Portrait", "MoneyMap-demo-1080x1920.mp4"]]) {
  if (only && only !== id) continue;
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  let last = -10;
  await renderMedia({
    composition, serveUrl, browserExecutable,
    codec: "h264", crf: 14, pixelFormat: "yuv420p", x264Preset: "slow",
    audioCodec: "aac", audioBitrate: "320k",
    concurrency: 4,
    outputLocation: `out/${file}`,
    onProgress: ({ progress }) => { const p = Math.round(progress * 100); if (p >= last + 10) { last = p; console.log(id, p + "%"); } },
  });
  console.log("wrote out/" + file);
}
