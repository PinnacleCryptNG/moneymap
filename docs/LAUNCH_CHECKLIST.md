# Launch checklist

Two checklists the team asked to track before launch. Each item has MoneyMap's current status:

- ✅ **Done**
- 🟡 **Partly done**
- ⬜ **To do**
- ➖ **Doesn't apply**, with the reason

*Last checked: 9 October 2026.*

## Security

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Hide API keys | ✅ | No keys in the frontend. Server secrets (`MONEYMAP_SECRET`, `ZENITH_*_API_KEY`, `ZENITH_FEED_SECRET`) come from environment variables only. |
| 2 | Purge Git secrets | ✅ | Git history scanned: no real keys or passwords committed. Test files use obvious dummy values. Render generates `MONEYMAP_SECRET` itself. |
| 3 | Use public DB key | ➖ | The browser never talks to the database directly; every read and write goes through the API. There is no database key to expose. |
| 4 | Enable row-level security | 🟡 | SQLite has no RLS. Instead, every query is scoped to the signed-in customer on the server. Enable Postgres RLS when moving to PostgreSQL. |
| 5 | Encrypt sensitive data | 🟡 | Encrypted in transit (HTTPS). Not encrypted at rest yet: the SQLite file on Render is plain. Production: encrypted Postgres plus field encryption for answers and statements. |
| 6 | Enforce server-side auth | ✅ | Every customer and admin route checks a signed token on the server. Production mode accepts only Zenith sign-in. |
| 7 | Lock record access | ✅ | Customers can only reach their own records; another customer's recommendation returns 404. Tested. |
| 8 | Block field tampering | ✅ | Unknown fields are rejected, and the customer id always comes from the token, never from the request body. Tested. |
| 9 | Rate limit login | ✅ | 60 sign-ins a minute per IP, plus 1,200 requests a minute in general. Tested. |
| 10 | Hash passwords | ➖ | MoneyMap stores no passwords. Customers sign in through Zenith. |
| 11 | Scan dependencies | ✅ | `npm audit` runs in CI on every push; currently 0 vulnerabilities. |
| 12 | Add bot protection | 🟡 | Rate limits only. Add a CAPTCHA (for example Cloudflare Turnstile) on the public demo sign-in if it's abused. In production, MoneyMap sits behind Zenith's login. |
| 13 | Parameterize queries | ✅ | Every query uses `?` placeholders. The only text joined into SQL is fixed table and column names in code. |
| 14 | Validate all input | ✅ | JSON Schema on every body and query; ranges checked; bank statement lines validated. |
| 15 | Escape user content | ✅ | React escapes all text, the app never injects raw HTML, and a strict Content Security Policy blocks injected scripts. |
| 16 | Restrict file uploads | ➖ | MoneyMap has no file uploads. |
| 17 | Trim API responses | 🟡 | Profile and export endpoints return only what's needed. `POST /recommendations` still returns the full engine result (for the Why page); trim it to the fields the screens use. |
| 18 | Add security headers | ✅ | CSP, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy, plus HSTS in production. |
| 19 | Force HTTPS | ✅ | Render redirects HTTP to HTTPS (301). HSTS is sent in production mode. |
| 20 | Secure session cookies | ➖ | No cookies: sessions use bearer tokens. Tokens sit in browser storage, protected by the CSP. Production uses Zenith's session instead. |

## Website

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Privacy policy page | ⬜ | Needed. Data handling is documented in `SECURITY.md`; it needs turning into a customer-facing page. |
| 2 | Terms & conditions page | ⬜ | Needed. Must say MoneyMap gives guidance, not financial advice, and that product terms are subject to Zenith Bank's current requirements. |
| 3 | Secrets off the frontend | ✅ | See security item 1. |
| 4 | Force HTTPS | ✅ | See security item 19. |
| 5 | Cookie consent banner | ➖ | No cookies, trackers or analytics. Browser storage holds only what the app needs to work. Add a banner if analytics are added (item 19). |
| 6 | Meta titles + descriptions | 🟡 | The site has one title and description. Each page should set its own title. |
| 7 | Social preview image | ⬜ | Add an Open Graph image and tags so shared links show a preview. |
| 8 | Add a favicon | ✅ | `public/logo.svg`. Add PNG sizes for older devices and iOS. |
| 9 | Sitemap + robots.txt | ⬜ | Add both. Only the landing page should be indexed; app pages are private. |
| 10 | Alt text on images | ✅ | Every image has alt text, and decorative icons are hidden from screen readers. |
| 11 | Compress your images | ➖ | The app uses only one SVG logo and icons. Compress the social preview image when it's added. |
| 12 | Check page load speed | 🟡 | The app is about 530 KB of script before compression. The bigger delay is Render's free plan waking up (30–60 s). Measure with Lighthouse; consider an always-on plan and splitting the bank view out of the main bundle. |
| 13 | Fix color contrast | 🟡 | Colours were chosen for contrast but not formally audited. Run an automated accessibility check (axe) in CI. |
| 14 | Make it mobile friendly | ✅ | Every core screen is checked on a phone-sized screen in CI, with no sideways scrolling. |
| 15 | Custom 404 page | ⬜ | Unknown addresses currently go back to the home page. Add a friendly "page not found" page. |
| 16 | Fix broken links | 🟡 | Internal links are covered by QA. External source links to zenithbank.com aren't checked automatically. |
| 17 | Form validation | ✅ | Every form validates input with clear messages, including amounts, ranges and goals. |
| 18 | Spam protection | 🟡 | Rate limits only. MoneyMap has no public contact or email forms. See bot protection. |
| 19 | Analytics | ⬜ | Decide whether to add any. If so, use privacy-friendly analytics (for example Plausible) on the landing page only, never on customers' financial screens, and update the privacy policy. |
| 20 | One clear call to action | ✅ | The landing page leads with "Build my MoneyMap". |

## Summary

- **Done:** 19
- **Partly done:** 9
- **To do:** 6 — privacy policy, terms, social preview image, sitemap and robots.txt, 404 page, an analytics decision
- **Doesn't apply:** 6
