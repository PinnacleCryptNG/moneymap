// Minimal signed bearer tokens (HMAC-SHA256) for the demo.
// In production MoneyMap runs inside the Zenith app and reuses its OAuth 2.0 / OpenID Connect session.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface Session {
  sub: string;
  role: "customer" | "admin";
  exp: number;
}

const SECRET = process.env.MONEYMAP_SECRET ?? randomBytes(32).toString("hex");
const TTL_SECONDS = 8 * 60 * 60;

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (data: string) => createHmac("sha256", SECRET).update(data).digest("base64url");

export function issueToken(sub: string, role: Session["role"]): string {
  const payload = b64(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS } satisfies Session));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (s.exp < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}
