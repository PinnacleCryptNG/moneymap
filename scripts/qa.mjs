// MoneyMap end-to-end QA (Phase 2, Phase H).
// Builds nothing itself: run `npm run build` first, then `npm run qa`.
// Starts `vite preview`, drives every core path in a real browser at phone and desktop sizes,
// and fails loudly on any broken screen, console error or horizontal overflow.
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4321;
// QA_URL=https://your-app.onrender.com runs the checks against a deployed site instead of a local server.
const REMOTE = process.env.QA_URL?.replace(/\/$/, "");
const BASE = `${REMOTE ?? `http://localhost:${PORT}`}/#`;
const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function portInUse() {
  try {
    await fetch(`http://localhost:${PORT}/`);
    return true;
  } catch {
    return false;
  }
}
if (!REMOTE && (await portInUse())) {
  console.error(`Port ${PORT} is already in use — stop whatever is running there and retry.`);
  process.exit(1);
}

async function waitForServer() {
  // A sleeping free-tier host can take up to a minute to wake.
  const target = REMOTE ? `${REMOTE}/api/v1/health` : `http://localhost:${PORT}/`;
  for (let i = 0; i < (REMOTE ? 600 : 50); i++) {
    try {
      const r = await fetch(target);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("preview server did not start");
}

// QA_SERVER=1: run against the real MoneyMap server (build with `npm run build:server-app` first).
const SERVER_MODE = process.env.QA_SERVER === "1" || Boolean(REMOTE);
const server = REMOTE
  ? null
  : SERVER_MODE
  ? spawn("node", ["--disable-warning=ExperimentalWarning", "--import", "tsx", "server/index.ts"], {
      stdio: "ignore",
      detached: true,
      env: { ...process.env, PORT: String(PORT), MONEYMAP_DB: ":memory:", NODE_ENV: "test" },
    })
  : spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
// Kill the whole process group (npx spawns children) so the port is free for the next run.
const stopServer = () => {
  try {
    if (server) process.kill(-server.pid, "SIGTERM");
  } catch {
    /* already stopped */
  }
};
const launchOpts = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

try {
  await waitForServer();
  const browser = await chromium.launch(launchOpts);

  async function session(name, viewport, fn) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // Web fonts can be blocked by sandboxed networks; that's not an app error.
      if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|ERR_CERT|net::ERR/.test(m.text())) errors.push(m.text());
    });
    try {
      await fn(page);
    } catch (e) {
      check(`${name}: flow completed`, false, e.message.split("\n")[0]);
    }
    check(`${name}: no JavaScript errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  const go = async (page, path) => {
    await page.goto(BASE + path);
    await page.waitForTimeout(250);
  };
  const healthy = async (page, label) => {
    const text = await page.locator("#root").innerText();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    const vw = page.viewportSize().width;
    check(`${label}: renders`, text.trim().length > 40 && !text.includes("Something interrupted the app"));
    check(`${label}: no horizontal scroll`, width <= vw, `${width}px > ${vw}px`);
  };
  const demoLoad = async (page, who) => {
    await go(page, "/");
    await page.getByRole("button", { name: "Open Demo Mode" }).click();
    const card = page.getByRole("dialog").locator("li").filter({ hasText: who });
    await card.getByRole("button", { name: "Load instantly" }).click();
    await page.waitForURL(/#\/app$/);
    await page.waitForTimeout(200);
  };

  for (const [size, viewport] of [["desktop", { width: 1366, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    // 1. Sarah: full core journey through onboarding, with invalid input first.
    await session(`Sarah journey (${size})`, viewport, async (page) => {
      await go(page, "/");
      await healthy(page, `Landing (${size})`);
      await page.getByRole("button", { name: "Build my MoneyMap" }).click();
      await page.getByLabel("Target amount").fill("");
      await page.getByRole("button", { name: "Continue" }).click();
      check(`Goal validation: empty amount (${size})`, await page.getByText("Enter a target amount.").isVisible());
      await page.getByLabel("Target amount").fill("500");
      check(`Goal validation: tiny amount (${size})`, await page.getByText("Enter at least ₦10,000.").isVisible());
      await page.getByLabel("Target amount").fill("1000000");
      await page.getByLabel("Timeline (months)").fill("500");
      check(`Goal validation: long timeline (${size})`, await page.getByText(/120 months/).isVisible());
      await page.getByLabel("Timeline (months)").fill("12");
      await page.getByRole("button", { name: "Continue" }).click();
      check(`Consent: promise shown (${size})`, await page.getByText("Our promise").isVisible());
      await page.getByRole("button", { name: "Allow all" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      check(`Map ready (${size})`, await page.getByText("Your financial map is ready").isVisible());
      await page.getByRole("button", { name: "See my recommendation" }).click();
      await page.getByText("We found a strong match.").waitFor({ timeout: 5000 });
      await healthy(page, `Recommendation (${size})`);
      check(`Recommends SAVE4ME (${size})`, await page.getByRole("heading", { name: "SAVE4ME" }).isVisible());
      for (const label of ["Why it fits", "Why now", "What influenced this", "Your choice"]) {
        check(`Recommendation section "${label}" (${size})`, await page.getByRole("heading", { name: label }).isVisible());
      }
      check(`Engine steps shown (${size})`, await page.getByText("How MoneyMap reached this").isVisible());
      check(`₦83,333 estimate (${size})`, await page.getByText("₦83,333").isVisible());

      await page.getByRole("button", { name: "Useful" }).click();
      check(`Feedback stored (${size})`, (await page.getByRole("button", { name: "Useful" }).getAttribute("aria-pressed")) === "true");

      await page.getByRole("link", { name: /^Why this\?/ }).click();
      await page.getByRole("heading", { name: /Why did MoneyMap recommend/ }).waitFor();
      for (const label of ["Your goal", "Your financial context", "The product fit", "The timing", "Your data", "Eligibility"]) {
        check(`Why section "${label}" (${size})`, await page.getByRole("heading", { name: label, exact: true }).isVisible());
      }
      await healthy(page, `Why this (${size})`);

      await page.getByRole("link", { name: "View product" }).click();
      await page.getByRole("heading", { name: "Published information" }).waitFor();
      check(`Product: published info with sources (${size})`, (await page.getByRole("link", { name: /source/ }).count()) >= 1);
      check(`Product: no invented terms (${size})`, await page.getByText("Subject to Zenith Bank's current requirements", { exact: false }).first().isVisible());
      await page.getByRole("button", { name: "Confirm eligibility" }).click();
      await page.getByText(/You appear to meet|need confirming|don't currently meet/).waitFor({ timeout: 5000 });
      await page.getByRole("button", { name: "Request to open" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
      await page.getByText(/Request submitted/).waitFor({ timeout: 3000 });
      check(`Product action recorded (${size})`, true);
      await go(page, "/app/recommendation");
      await page.waitForTimeout(900);
      check(`Requested product not recommended again (${size})`, !(await page.getByRole("heading", { name: "SAVE4ME" }).isVisible()));


      for (const path of ["/app", "/app/map", "/app/goals", "/app/products", "/app/activity", "/app/settings"]) {
        await go(page, path);
        await healthy(page, `${path} (${size})`);
      }
    });

    // 2. Exposure control: "Not relevant" never comes back.
    await session(`Exposure control (${size})`, viewport, async (page) => {
      await demoLoad(page, "Sarah");
      await go(page, "/app/recommendation");
      await page.getByText("We found a strong match.").waitFor({ timeout: 5000 });
      await page.getByRole("button", { name: "Not relevant" }).first().click();
      await page.getByRole("button", { name: "Check my MoneyMap again" }).click();
      await page.waitForTimeout(900);
      check(`Dismissed product not shown again (${size})`, !(await page.getByRole("heading", { name: "SAVE4ME" }).isVisible()));
      check(`Shows the held-back state (${size})`, await page.getByText("Nothing needs your attention.").isVisible());
    });

    // 3. Tolu's map: figures read from his transactions.
    await session(`Account reading (${size})`, viewport, async (page) => {
      await demoLoad(page, "Tolu");
      await go(page, "/app/map");
      check(`Account read from transactions (${size})`, await page.getByRole("heading", { name: "How MoneyMap read your account" }).isVisible());
      check(`Salary detected from narrations (${size})`, await page.getByText(/Salary/).first().isVisible());
      check(`Raw bank narrations shown (${size})`, (await page.getByText(/^(POS|WEB|NIP|SAVE4ME|GLO)/).count()) > 0);
    });

    // 3b. Step 3: money arrives — Sarah gets one message, then MoneyMap holds back; Tolu's bonus is noticed, nothing sent.
    const simulate = async (page, label) => {
      await page.getByRole("button", { name: "Open Demo Mode" }).click();
      await page.getByRole("dialog").getByRole("button", { name: label }).click();
      await page.waitForTimeout(900);
    };
    await session(`Event triggers (${size})`, viewport, async (page) => {
      await demoLoad(page, "Sarah");
      await simulate(page, "Salary lands");
      check(`Salary → message badge (${size})`, await page.getByRole("link", { name: "Messages, 1 unread" }).isVisible());
      check(`Salary → payday banner on dashboard (${size})`, await page.getByRole("region", { name: "New message" }).getByText(/SAVE4ME/).first().isVisible());
      await simulate(page, "Bonus arrives");
      await go(page, "/app/inbox");
      await healthy(page, `Messages (${size})`);
      check(`Inbox: one message (${size})`, (await page.getByRole("heading", { name: /SAVE4ME/ }).count()) === 1);
      check(`Inbox: bonus checked, nothing sent (${size})`, await page.getByText("Checked — nothing sent", { exact: true }).isVisible());
      check(`Inbox: weekly limit explained (${size})`, await page.getByRole("region", { name: "What MoneyMap noticed" }).getByText(/at most one a week/).isVisible());
      await go(page, "/app/map");
      check(`New salary line on the statement (${size})`, await page.getByText(/SALARY OCT 2026/).first().isVisible());

      await demoLoad(page, "Tolu");
      await simulate(page, "Bonus arrives");
      check(`Tolu bonus → no message badge (${size})`, await page.getByRole("link", { name: "Messages", exact: true }).isVisible());
      await go(page, "/app/inbox");
      check(`Tolu: bonus noticed, nothing sent (${size})`, await page.getByText("Checked — nothing sent", { exact: true }).isVisible());
    });

    // 4. Tolu: no match, then a new goal changes the answer.
    await session(`No-match customer (${size})`, viewport, async (page) => {
      await demoLoad(page, "Tolu");
      check(`Tolu dashboard: nothing needed (${size})`, await page.getByText("Nothing needs your attention.").isVisible());
      await go(page, "/app/recommendation");
      await page.getByText("Nothing needs your attention.").waitFor({ timeout: 5000 });
      check(`No-match copy (${size})`, await page.getByText("We'll let you know when something genuinely relevant comes up.").isVisible());
      check(`No-match shows what was checked (${size})`, await page.getByText("What we checked").isVisible());
      await healthy(page, `No-match screen (${size})`);

      await go(page, "/app/goals");
      await page.getByRole("button", { name: "New goal" }).click();
      const dlg = page.getByRole("dialog");
      await dlg.getByLabel("What are you working towards?").selectOption("major_expense");
      await dlg.getByLabel("What's the expense for?").selectOption("vehicle");
      await dlg.getByLabel("Target amount").fill("6000000");
      await dlg.getByLabel("Timeline (months)").fill("12");
      await dlg.getByRole("button", { name: "Save goal" }).click();
      await go(page, "/app/recommendation");
      await page.getByText(/We found a/).waitFor({ timeout: 5000 });
      check(`New car goal → Asset Finance (${size})`, await page.getByRole("heading", { name: "Asset Finance" }).isVisible());
    });

    // 5. Consent states.
    await session(`Consent (${size})`, viewport, async (page) => {
      await demoLoad(page, "Sarah");
      await go(page, "/app/settings");
      await page.getByRole("button", { name: "Withdraw all consent" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Withdraw all" }).click();
      await go(page, "/app");
      check(`Withdrawn data shows "Not shared" (${size})`, (await page.getByText("Not shared").count()) >= 4);
      await go(page, "/app/recommendation");
      await page.getByText("Nothing needs your attention.").waitFor({ timeout: 5000 });
      check(`No data → no recommendation (${size})`, true);

      await go(page, "/");
      await page.getByRole("button", { name: "Build my MoneyMap" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Skip for now" }).click();
      check(`Skip for now → no forced match (${size})`, await page.getByText("Nothing needs your attention.").isVisible());
    });

    // 6. Error and empty states.
    await session(`Error & empty states (${size})`, viewport, async (page) => {
      await demoLoad(page, "Sarah");
      await go(page, "/app/settings");
      await page.getByLabel(/Simulate a connection error/).check();
      await go(page, "/app/recommendation");
      await page.getByText("We couldn't update your MoneyMap.").waitFor({ timeout: 5000 });
      check(`Error state with Try again (${size})`, await page.getByRole("button", { name: "Try again" }).isVisible());
      await go(page, "/app/settings");
      await page.getByLabel(/Simulate a connection error/).uncheck();
      await go(page, "/app/goals");
      await page.getByRole("button", { name: /^Delete/ }).first().click();
      check(`Empty goal state (${size})`, await page.getByText("Give your money somewhere to go.").isVisible());
    });

    // 7. Bank view and governance.
    await session(`Bank view (${size})`, viewport, async (page) => {
      for (const path of ["/admin", "/admin/products", "/admin/engine", "/admin/audit"]) {
        await go(page, path);
        await healthy(page, `${path} (${size})`);
      }
      await go(page, "/admin/products");
      await page.getByRole("switch", { name: "SAVE4ME active" }).click();
      await demoLoad(page, "Sarah");
      await go(page, "/app/recommendation");
      await page.waitForTimeout(900);
      check(`Deactivated product never recommended (${size})`, !(await page.getByRole("heading", { name: "SAVE4ME" }).isVisible()));
      await go(page, "/admin/products");
      await page.getByRole("switch", { name: "SAVE4ME active" }).click();
    });
  }

  await browser.close();
} finally {
  stopServer();
}

console.log(`QA mode: ${REMOTE ? `deployed site ${REMOTE}` : SERVER_MODE ? "MoneyMap server (API mode)" : "static preview (local mode)"}`);
console.log(results.join("\n"));
console.log(`\n${results.length - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
