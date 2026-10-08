// A stand-in for Zenith's systems, implementing MoneyMap's integration contract (docs/INTEGRATION.md).
// Used by the integration tests, and runnable on its own to try MoneyMap's HTTP adapters:
//   npm run mock:zenith      (then start MoneyMap with the ZENITH_* variables it prints)
// It is NOT Zenith's real API — it shows the shape MoneyMap needs any adapter to provide.
import { createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { RawTransaction } from "../src/types";

export interface MockZenith {
  url: string;
  /** Requests received, newest last. */
  calls: { method: string; path: string; headers: IncomingMessage["headers"]; body: unknown }[];
  /** Make the next N calls to a path prefix fail with this status (or hang past the timeout with 0). */
  failNext(pathPrefix: string, times: number, status?: number): void;
  /** Statement lines served for a customer. */
  setStatement(customerId: string, lines: RawTransaction[]): void;
  /** Sign an ID token for a customer, as the Zenith app's sign-in would issue. */
  idToken(customerId: string, overrides?: Record<string, unknown>): string;
  issuer: string;
  audience: string;
  close(): Promise<void>;
}

export async function startMockZenith(port = 0): Promise<MockZenith> {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "mock-key-1";
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, use: "sig", alg: "RS256" };
  const statements = new Map<string, RawTransaction[]>();
  const failures: { prefix: string; times: number; status: number }[] = [];
  const seen = new Map<string, string>();
  const calls: MockZenith["calls"] = [];

  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString();
    const url = new URL(req.url ?? "/", "http://mock");
    const body = raw ? JSON.parse(raw) : undefined;
    calls.push({ method: req.method ?? "", path: url.pathname, headers: req.headers, body });
    const send = (status: number, data?: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(data === undefined ? "" : JSON.stringify(data));
    };

    const f = failures.find((x) => url.pathname.startsWith(x.prefix) && x.times > 0);
    if (f) {
      f.times--;
      if (f.status === 0) return; // never answers: the caller's timeout fires
      return send(f.status, { error: "simulated" });
    }

    if (req.method === "GET" && url.pathname === "/.well-known/jwks.json") return send(200, { keys: [jwk] });
    const m = url.pathname.match(/^\/customers\/([^/]+)\/transactions$/);
    if (req.method === "GET" && m) {
      const from = url.searchParams.get("from") ?? "0000-00-00";
      return send(200, { transactions: (statements.get(decodeURIComponent(m[1])) ?? []).filter((t) => t.date >= from) });
    }
    if (req.method === "POST" && (url.pathname === "/messages" || url.pathname === "/product-requests")) {
      // Idempotency: the same key returns the same reference instead of acting twice.
      const key = String(req.headers["idempotency-key"] ?? randomUUID());
      const prefix = url.pathname === "/messages" ? "MSG" : "ZEN-REQ";
      if (!seen.has(key)) seen.set(key, `${prefix}-${String(seen.size + 1).padStart(5, "0")}`);
      return send(201, url.pathname === "/messages" ? { reference: seen.get(key), channel: "push" } : { reference: seen.get(key) });
    }
    send(404, { error: "not_found" });
  });
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const issuer = `${url}/`;
  const audience = "moneymap";

  return {
    url,
    calls,
    issuer,
    audience,
    failNext: (prefix, times, status = 503) => failures.push({ prefix, times, status }),
    setStatement: (id, lines) => statements.set(id, lines),
    idToken(customerId, overrides = {}) {
      const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const nowS = Math.floor(Date.now() / 1000);
      const head = b64({ alg: "RS256", typ: "JWT", kid });
      const claims = b64({ iss: issuer, aud: audience, sub: customerId, iat: nowS, exp: nowS + 600, ...overrides });
      const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(privateKey).toString("base64url");
      return `${head}.${claims}.${sig}`;
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

// Run standalone.
if (process.argv[1]?.endsWith("mockZenith.ts")) {
  const port = Number(process.env.MOCK_ZENITH_PORT ?? 9090);
  const z = await startMockZenith(port);
  console.log(`Mock Zenith on ${z.url}. Start MoneyMap with:
  ZENITH_CORE_BANKING_URL=${z.url} ZENITH_NOTIFICATIONS_URL=${z.url} ZENITH_APPLICATIONS_URL=${z.url} \\
  ZENITH_OIDC_ISSUER=${z.issuer} ZENITH_OIDC_AUDIENCE=${z.audience} ZENITH_OIDC_JWKS_URL=${z.url}/.well-known/jwks.json \\
  ZENITH_FEED_SECRET=change-me npm start
A sample ID token for Sarah (valid 10 minutes):
  ${z.idToken("CUST_SARAH")}`);
}
