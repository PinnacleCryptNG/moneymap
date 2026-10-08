// Identity: who is calling. Demo = MoneyMap's own signed tokens. Production = the Zenith app's OpenID Connect
// ID/access token (RS256 JWT), verified against the issuer's published keys (JWKS). MoneyMap never sees a password.
import { createPublicKey, verify as verifySig, type KeyObject } from "node:crypto";
import { verifyToken, type Session } from "../auth";
import { newHealth, trackFail, trackOk, type AdapterHealth } from "./http";

export interface IdentityAdapter {
  name: "identity";
  health: AdapterHealth;
  /** Returns the session for a bearer token, or null if it isn't valid. */
  verify(token: string | undefined): Promise<Session | null>;
}

export interface OidcConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
  /** Claim holding MoneyMap's customer id (default "sub"). */
  customerClaim?: string;
}

const CLOCK_SKEW_S = 60;
const JWKS_TTL_MS = 10 * 60 * 1000;

export function identityAdapter(oidc: OidcConfig | null): IdentityAdapter {
  const health = newHealth(oidc ? "http" : "demo", oidc?.jwksUrl);
  let keys: Map<string, KeyObject> | null = null;
  let fetchedAt = 0;

  async function key(kid: string): Promise<KeyObject | null> {
    const stale = !keys || Date.now() - fetchedAt > JWKS_TTL_MS;
    // Refetch on an unknown kid too (key rotation), at most once a minute.
    if (stale || (!keys!.has(kid) && Date.now() - fetchedAt > 60_000)) {
      try {
        const res = await fetch(oidc!.jwksUrl, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(`JWKS HTTP ${res.status}`);
        const { keys: jwks } = (await res.json()) as { keys: { kid?: string; kty?: string; use?: string }[] };
        keys = new Map(
          jwks
            .filter((k) => k.kty === "RSA" && k.kid && (!k.use || k.use === "sig"))
            .map((k) => [k.kid!, createPublicKey({ key: k as Parameters<typeof createPublicKey>[0] & object as never, format: "jwk" })]),
        );
        fetchedAt = Date.now();
        trackOk(health);
      } catch (e) {
        trackFail(health, e);
        if (!keys) return null;
      }
    }
    return keys?.get(kid) ?? null;
  }

  async function verifyJwt(token: string): Promise<Session | null> {
    const [h, p, s] = token.split(".");
    try {
      const header = JSON.parse(Buffer.from(h, "base64url").toString()) as { alg?: string; kid?: string };
      // Only RS256: rejects "none" and HMAC algorithm-confusion tokens.
      if (header.alg !== "RS256" || !header.kid) return null;
      const k = await key(header.kid);
      if (!k || !verifySig("RSA-SHA256", Buffer.from(`${h}.${p}`), k, Buffer.from(s, "base64url"))) return null;
      const c = JSON.parse(Buffer.from(p, "base64url").toString()) as Record<string, unknown>;
      const nowS = Date.now() / 1000;
      const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
      if (c.iss !== oidc!.issuer || !aud.includes(oidc!.audience)) return null;
      if (typeof c.exp !== "number" || c.exp + CLOCK_SKEW_S < nowS) return null;
      if (typeof c.nbf === "number" && c.nbf - CLOCK_SKEW_S > nowS) return null;
      const sub = c[oidc!.customerClaim ?? "sub"];
      return typeof sub === "string" && sub ? { sub, role: "customer", exp: c.exp } : null;
    } catch {
      return null;
    }
  }

  return {
    name: "identity",
    health,
    async verify(token) {
      if (!token) return null;
      // MoneyMap's own tokens have two parts; a JWT has three. Demo tokens keep working alongside OIDC.
      if (oidc && token.split(".").length === 3) return verifyJwt(token);
      return verifyToken(token);
    },
  };
}
