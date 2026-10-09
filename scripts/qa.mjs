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
      // QA opens many demo sessions in quick succession; lift the per-IP sign-in limit for this local run only.
      env: { ...process.env, PORT: String(PORT), MONEYMAP_DB: ":memory:", NODE_ENV: "test", MONEYMAP_RATE_LIMIT_AUTH: "1000", MONEYMAP_RATE_LIMIT: "100000" },
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

  async function session(name, viewport, fn, contextOptions = {}) {
    const ctx = await browser.newContext({ viewport, ...contextOptions });
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
    // Pages loaded on demand (bank view, legal pages) show "Loading…" for a moment first.
    await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 10000 }).catch(() => undefined);
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

      // "Your money": exact amounts, ranges, "not sure", goals and variable income.
      check(`Money questions shown (${size})`, await page.getByRole("heading", { name: "Tell us about your money" }).isVisible());
      await page.getByLabel("Personal account").check();
      await page.getByLabel("Personal account", { exact: true }).last().fill("120000");
      await page.getByRole("button", { name: /₦100,000 for school fees/ }).click();
      await page.getByRole("radiogroup", { name: "Do you have a fixed monthly income?" }).getByRole("radio", { name: "Yes" }).click();
      await page.getByLabel("Fixed monthly income", { exact: true }).fill("450000");
      await page.getByRole("radiogroup", { name: "Do you have income that changes from month to month?" }).getByRole("radio", { name: "Yes" }).click();
      await page.getByLabel("Name this income").fill("Hair business");
      await page.getByLabel("Hair business — from").fill("150000");
      await page.getByLabel("Hair business — to").fill("50000");
      await page.getByRole("radio", { name: "Break it down" }).click();
      await page.getByRole("radiogroup", { name: "Food: how would you like to answer?" }).getByRole("radio", { name: "Range" }).click();
      await page.getByLabel("Food — from").fill("60000");
      await page.getByLabel("Food — to").fill("80000");
      await page.getByLabel("Rent", { exact: true }).fill("50000");
      await page.getByRole("radiogroup", { name: "Electricity: how would you like to answer?" }).getByRole("radio", { name: "I'm not sure" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      check(`Money validation: backwards range caught (${size})`, await page.getByText(/Hair business: the first amount should be lower/).isVisible());
      await page.getByLabel("Hair business — from").fill("50000");
      await page.getByLabel("Hair business — to").fill("150000");
      await healthy(page, `Money questions (${size})`);
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
      for (const label of ["Your goal", "Your money", "The product fit", "The timing", "Your data", "Can you get it?"]) {
        check(`Why section "${label}" (${size})`, await page.getByRole("heading", { name: label, exact: true }).isVisible());
      }
      await healthy(page, `Why this (${size})`);

      await page.getByRole("link", { name: "View product" }).click();
      await page.getByRole("heading", { name: "Published information" }).waitFor();
      check(`Product: published info with sources (${size})`, (await page.getByRole("link", { name: /source/ }).count()) >= 1);
      check(`Product: no invented terms (${size})`, await page.getByText("Subject to Zenith Bank's current requirements", { exact: false }).first().isVisible());
      await page.getByRole("button", { name: "Check if I qualify" }).click();
      await page.getByText(/You appear to meet|need confirming|don't currently meet/).waitFor({ timeout: 5000 });
      await page.getByRole("button", { name: "Request to open" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
      await page.getByText(/Request submitted/).waitFor({ timeout: 3000 });
      check(`Product action recorded (${size})`, true);
      check(`Zenith reference shown (${size})`, await page.getByText(/Zenith ref DEMO-/).isVisible());
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

    // 3c. Step 5: data rights — download a copy, then erase.
    await session(`Data rights (${size})`, viewport, async (page) => {
      await demoLoad(page, "Sarah");
      await go(page, "/app/settings");
      const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download my data" }).click()]);
      check(`Data export downloaded (${size})`, file.suggestedFilename() === "moneymap-data-CUST_SARAH.json");
      await page.getByRole("button", { name: "Delete my MoneyMap data" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
      await page.waitForTimeout(900);
      check(`After erasure, left the app (${size})`, !/#\/app/.test(page.url()), page.url());
      await go(page, "/app");
      check(`After erasure, onboarding starts again (${size})`, /#\/onboarding/.test(page.url()));
    });

    // 3d. Answers stand in for a statement the customer doesn't share.
    await session(`Answers without sharing (${size})`, viewport, async (page) => {
      await go(page, "/");
      await page.getByRole("button", { name: "Open Demo Mode" }).click();
      await page.getByRole("dialog").locator("li").filter({ hasText: "Tolu" }).getByRole("button", { name: "Walk through onboarding" }).click();
      await page.getByRole("radio", { name: /Save more/ }).check({ force: true });
      await page.getByLabel("Target amount").fill("500000");
      await page.getByLabel("Timeline (months)").fill("10");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("radiogroup", { name: "Do you have a fixed monthly income?" }).getByRole("radio", { name: "Yes" }).click();
      await page.getByLabel("Fixed monthly income", { exact: true }).fill("300000");
      await page.getByRole("radio", { name: "One total" }).click();
      await page.getByRole("radiogroup", { name: "Total monthly expenses: how would you like to answer?" }).getByRole("radio", { name: "Range" }).click();
      await page.getByLabel("Total monthly expenses — from").fill("150000");
      await page.getByLabel("Total monthly expenses — to").fill("200000");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Skip for now" }).click();
      check(`Map preview uses answers (${size})`, (await page.locator("dd").filter({ hasText: "Stable" }).count()) > 0);
      await page.getByRole("button", { name: "Go to my MoneyMap" }).click();
      await go(page, "/app/map");
      check(`Map: "What you told us" (${size})`, await page.getByRole("heading", { name: "What you told us" }).isVisible());
      check(`Map: income marked as from answers (${size})`, await page.getByText("from what you told us").first().isVisible());
      check(`Map: signal source is your answers (${size})`, (await page.getByText("Source: What you told us").count()) > 0);
      await go(page, "/app/my-money");
      check(`My money page keeps answers (${size})`, (await page.getByLabel("Fixed monthly income", { exact: true }).inputValue()) === "300,000");
      await healthy(page, `My money (${size})`);
    });

    // 3e. Accessibility: colour contrast and other serious issues (axe-core) on every key screen.
    await session(`Accessibility (${size})`, viewport, async (page) => {
      // Audit the settled page, as people who turn off animations see it.
      await page.emulateMedia({ reducedMotion: "reduce" });
      const audit = async (label) => {
        await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
        const r = await page.evaluate(async () => {
          // eslint-disable-next-line no-undef
          const res = await axe.run(document, { resultTypes: ["violations"] });
          return res.violations
            .filter((v) => v.impact === "serious" || v.impact === "critical")
            .map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
        });
        check(`No serious accessibility issues: ${label} (${size})`, r.length === 0, r.join(" ; "));
      };
      const HEADINGS = { "/privacy": "How MoneyMap uses your information", "/terms": "Using MoneyMap", "/nowhere": "This page isn't on the map." };
      for (const [path, label] of [["/", "landing"], ["/privacy", "privacy"], ["/terms", "terms"], ["/nowhere", "not found"]]) {
        await go(page, path);
        if (HEADINGS[path]) check(`${label} page content (${size})`, await page.getByRole("heading", { level: 1, name: HEADINGS[path] }).isVisible());
        await audit(label);
      }
      await go(page, "/");
      await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacy policy" }).click();
      await page.getByRole("heading", { level: 1, name: HEADINGS["/privacy"] }).waitFor({ timeout: 5000 });
      check(`Footer link to privacy works (${size})`, (await page.title()).startsWith("Privacy policy"));
      await demoLoad(page, "Sarah");
      const SCREENS = [["/app", "dashboard"], ["/app/map", "map"], ["/app/recommendation", "recommendation"], ["/app/recommendation/why", "why"], ["/app/products", "products"], ["/app/goals", "goals"], ["/app/my-money", "my money"], ["/app/inbox", "messages"], ["/app/activity", "activity"], ["/app/settings", "settings"], ["/admin", "bank view"], ["/admin/integrations", "integrations"]];
      for (const [path, label] of SCREENS) {
        await go(page, path);
        await page.waitForTimeout(400);
        await audit(label);
      }
      // The same screens in dark mode: every colour has a dark value that must stay readable.
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
      for (const [path, label] of [["/", "landing"], ["/privacy", "privacy"], ["/nowhere", "not found"], ...SCREENS]) {
        await go(page, path);
        await page.waitForTimeout(400);
        await audit(`${label}, dark`);
      }
    }, { bypassCSP: true }); // the audit tool is injected as a script; the app's own CSP would rightly block it

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
      await page.getByRole("button", { name: "Turn off all permissions" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Turn them all off" }).click();
      await go(page, "/app");
      check(`Withdrawn data shows "Not shared" (${size})`, (await page.getByText("Not shared").count()) >= 4);
      await go(page, "/app/recommendation");
      await page.getByText("Nothing needs your attention.").waitFor({ timeout: 5000 });
      check(`No data → no recommendation (${size})`, true);

      await go(page, "/");
      await page.getByRole("button", { name: "Build my MoneyMap" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Skip this" }).click();
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
      for (const path of ["/admin", "/admin/products", "/admin/engine", "/admin/integrations", "/admin/audit"]) {
        await go(page, path);
        await healthy(page, `${path} (${size})`);
      }
      await go(page, "/admin/integrations");
      await page.getByRole("heading", { name: "Core banking" }).waitFor({ timeout: 5000 });
      check(`Integrations: four adapters listed (${size})`, (await page.getByText("Simulated", { exact: true }).count()) === 4);
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
