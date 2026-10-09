// Bundles the embed build (dist-embed/) into one self-contained HTML page body for hosting
// inside an embedded viewer (e.g. a claude.ai Artifact). Output: dist-embed/moneymap.html
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const dir = "dist-embed/assets";
const files = readdirSync(dir);
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith(".css"))}`, "utf8");
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith(".js"))}`, "utf8").replaceAll("</script", "<\\/script");

const html = `<title>MoneyMap</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync("dist-embed/moneymap.html", html);
console.log(`dist-embed/moneymap.html — ${(html.length / 1024).toFixed(0)} KB`);
