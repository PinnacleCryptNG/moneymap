# Launch checklist

Two checklists the team asked to track before launch, with MoneyMap's status and how each item is checked.

- ✅ **Done**
- ➖ **Doesn't apply**, with the reason

*Last checked: 9 October 2026. Automated checks run in CI on every push; the live site is checked with `npm run smoke -- https://moneymap-kuld.onrender.com`.*

## Security

| # | Item | Status | How |
|---|---|---|---|
| 1 | Hide API keys | ✅ | No keys in the frontend. Server secrets (`MONEYMAP_SECRET`, `MONEYMAP_DATA_KEY`, `ZENITH_*`) come from environment variables only. |
| 2 | Purge Git secrets | ✅ | Git history scanned: no real keys or passwords were ever committed. Test files use obvious dummy values. Render generates `MONEYMAP_SECRET` itself. |
| 3 | Use public DB key | ➖ | The browser never talks to the database; every read and write goes through the API. There is no database key to expose. |
| 4 | Enable row-level security | ✅ | `db/postgres/rls.sql` enables and forces RLS on every customer table. `server/__tests__/rls.test.ts` proves it on real PostgreSQL (PGlite): customers see only their own rows, can't write other customers' rows, staff can read but only they change the catalogue, and the audit log is append-only. The current SQLite store has no RLS, so there every query is scoped in code. |
| 5 | Encrypt sensitive data | ✅ | In transit: HTTPS. At rest: AES-256-GCM field encryption of narrations, answers, messages, goal names, evidence and explanations (`server/fieldCrypto.ts`). A test scans the raw tables for amounts, merchants and employers and finds none. Amounts stay numeric for calculation, so production adds disk-level encryption. |
| 6 | Enforce server-side auth | ✅ | Every customer and admin route checks a signed token on the server. Production mode accepts only Zenith sign-in. Tested. |
| 7 | Lock record access | ✅ | Customers can only reach their own records; another customer's recommendation returns 404. Tested. |
| 8 | Block field tampering | ✅ | Unknown fields are rejected, and the customer id always comes from the token, never the request body. Tested. |
| 9 | Rate limit login | ✅ | 60 sign-ins a minute per IP; 1,200 requests a minute in general. Tested. |
| 10 | Hash passwords | ➖ | MoneyMap stores no passwords. Customers sign in through Zenith. |
| 11 | Scan dependencies | ✅ | `npm audit` runs in CI on every push: 0 vulnerabilities. |
| 12 | Add bot protection | ✅ | Proof-of-work puzzle on every demo sign-in (`server/pow.ts`), on top of the rate limits. Solved invisibly by real browsers in under a second. Tested, and checked on the live site. |
| 13 | Parameterize queries | ✅ | Every query uses `?` placeholders. The only text joined into SQL is fixed table and column names in code. |
| 14 | Validate all input | ✅ | JSON Schema on every body and query; ranges checked; bank statement lines validated. |
| 15 | Escape user content | ✅ | React escapes all text, the app never injects raw HTML, and the CSP blocks injected scripts (QA confirmed it blocks an injected script). |
| 16 | Restrict file uploads | ➖ | MoneyMap has no file uploads. |
| 17 | Trim API responses | ✅ | Engine responses send products as short references instead of the full catalogue. The profile and export endpoints return only their own fields. |
| 18 | Add security headers | ✅ | CSP, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy on every response; HSTS in production. Checked on the live site. |
| 19 | Force HTTPS | ✅ | HTTP redirects to HTTPS (301), checked on the live site. HSTS in production mode. |
| 20 | Secure session cookies | ➖ | No cookies: sessions use bearer tokens, protected by the CSP. Production uses Zenith's session. |

## Website

| # | Item | Status | How |
|---|---|---|---|
| 1 | Privacy policy page | ✅ | `/#/privacy`, written to the Nigeria Data Protection Act. Contact and retention details are marked as placeholders, to be confirmed with Zenith. |
| 2 | Terms & conditions page | ✅ | `/#/terms`: guidance not advice, no guarantees, product terms subject to Zenith Bank. |
| 3 | Secrets off the frontend | ✅ | See security item 1. |
| 4 | Force HTTPS | ✅ | See security item 19. |
| 5 | Cookie consent banner | ➖ | No cookies and no trackers. The visit counter stores no identifiers, so there's nothing to consent to; the privacy policy says so. |
| 6 | Meta titles + descriptions | ✅ | Each screen sets its own title; the site has a description, canonical URL and theme colour. |
| 7 | Social preview image | ✅ | `og-image.png` (1200×630) with Open Graph and Twitter tags. Checked on the live site. |
| 8 | Add a favicon | ✅ | New MoneyMap mark: SVG favicon, 32 px PNG, Apple touch icon, app icons (192, 512, maskable) and a web manifest. Full brand kit in `docs/brand`, rebuilt with `npm run brand`. |
| 9 | Sitemap + robots.txt | ✅ | `robots.txt` allows only the public page and points to `sitemap.xml`. Both checked on the live site. |
| 10 | Alt text on images | ✅ | Every image has alt text and icons are hidden from screen readers. The automated accessibility audit passes on every screen. |
| 11 | Compress your images | ✅ | The social image is a 59 KB PNG; icons are 1–13 KB. The rest is one SVG logo. |
| 12 | Check page load speed | ✅ | The bank view and legal pages now load only when visited: the main script fell from 529 KB to 368 KB (106 KB compressed). A GitHub Actions job pings the site every 10 minutes so Render's free plan doesn't fall asleep. |
| 13 | Fix color contrast | ✅ | axe-core audits 16 screens on phone and desktop in CI. It found low contrast on the primary buttons, a green badge and red buttons; all are fixed, with 0 serious issues now. |
| 14 | Make it mobile friendly | ✅ | Every core screen is checked on a phone-sized screen in CI, with no sideways scrolling. |
| 15 | Custom 404 page | ✅ | In-app "This page isn't on the map." page, plus a real 404 response for unknown addresses on the server. Checked on the live site. |
| 16 | Fix broken links | ✅ | Internal links are covered by QA. External source links are checked by `npm run links` and a weekly GitHub Actions job (this sandbox's network blocks those sites, so the check runs on GitHub). |
| 17 | Form validation | ✅ | Every form validates input with clear messages, including amounts, ranges and goals. |
| 18 | Spam protection | ✅ | Rate limits plus the proof-of-work check on sign-in. MoneyMap has no public contact forms. |
| 19 | Analytics | ✅ | Privacy-friendly and first-party: an anonymous daily count of visits to the home, privacy and terms pages only. No cookies, IP addresses or identifiers; Do Not Track and Global Privacy Control are respected. Shown in the bank view. |
| 20 | One clear call to action | ✅ | The landing page leads with "Build my MoneyMap". |

## Summary

- **Done:** 35
- **Doesn't apply:** 5

Nothing is left to do.
