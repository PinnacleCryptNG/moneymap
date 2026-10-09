// Checks every external source link in the product catalogue (src/data/products.ts).
// Broken (404/410, DNS failure) fails the run; sites that block automated checks (401/403/429) are reported as warnings.
import { readFileSync } from "node:fs";

const urls = [...new Set(readFileSync("src/data/products.ts", "utf8").match(/https:\/\/[^\s"'`)]+/g) ?? [])];
let broken = 0;
for (const url of urls) {
  let status = 0;
  let note = "";
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": "MoneyMap link check (+https://moneymap-kuld.onrender.com)" } });
      status = res.status;
      if (res.ok || method === "GET") break;
    } catch (e) {
      note = e.cause?.code ?? e.cause?.message ?? e.message;
    }
  }
  const blocked = [401, 403, 429].includes(status);
  const ok = status >= 200 && status < 400;
  if (!ok && !blocked) broken++;
  console.log(`${ok ? "OK  " : blocked ? "WARN" : "FAIL"}  ${status || `no response (${note})`}  ${url}`);
}
console.log(`\n${urls.length} links checked, ${broken} broken`);
process.exit(broken ? 1 : 0);
