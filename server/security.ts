// Security controls (step 5): run mode, response headers, CORS policy and rate limits.
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export type RunMode = "demo" | "production";

export interface SecurityConfig {
  /**
   * demo: the hackathon build — demo sign-in, Demo Mode and reset endpoints are available.
   * production: those endpoints don't exist; customers and staff sign in through Zenith (OIDC) only.
   */
  mode: RunMode;
  /** Browser origins allowed to call the API cross-origin. Empty = same origin only. */
  corsOrigins: string[];
  /** Requests per minute per client IP: sign-in/session endpoints, and everything else. False disables (tests). */
  rateLimits: { auth: number; general: number } | false;
}

export function securityConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SecurityConfig {
  const mode: RunMode = env.MONEYMAP_MODE === "production" ? "production" : "demo";
  if (mode === "production") {
    // Fail closed: production must never fall back to a random or default secret, or run without Zenith sign-in.
    const missing = ["MONEYMAP_SECRET", "ZENITH_OIDC_ISSUER", "ZENITH_OIDC_AUDIENCE", "ZENITH_OIDC_JWKS_URL"].filter((k) => !env[k]);
    if (missing.length) throw new Error(`MONEYMAP_MODE=production needs ${missing.join(", ")}.`);
    if ((env.MONEYMAP_SECRET ?? "").length < 32) throw new Error("MONEYMAP_SECRET must be at least 32 characters.");
  }
  return {
    mode,
    corsOrigins: (env.MONEYMAP_CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    rateLimits: {
      auth: Number(env.MONEYMAP_RATE_LIMIT_AUTH ?? 60),
      general: Number(env.MONEYMAP_RATE_LIMIT ?? 600),
    },
  };
}

export const DEFAULT_SECURITY: SecurityConfig = { mode: "demo", corsOrigins: [], rateLimits: false };

/** The app shell's Content Security Policy: own scripts only, Google Fonts for type, no framing. */
const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export function applySecurityHeaders(app: FastifyInstance, cfg: SecurityConfig) {
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
    reply.header("cross-origin-opener-policy", "same-origin");
    if (cfg.mode === "production") reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    if (req.url.startsWith("/api/")) {
      // Financial data must not be cached by browsers or intermediaries.
      reply.header("cache-control", "no-store");
    } else if (!req.url.startsWith("/docs") && String(reply.getHeader("content-type") ?? "").startsWith("text/html")) {
      reply.header("content-security-policy", APP_CSP);
    }
    return payload;
  });
}

/** Fixed-window limiter per client IP. In-memory: fine for one instance; a shared store (e.g. Redis) when scaled out. */
export function rateLimiter(limitPerMinute: number) {
  const windows = new Map<string, { start: number; count: number }>();
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const now = Date.now();
    const key = req.ip;
    const w = windows.get(key);
    if (!w || now - w.start >= 60_000) {
      windows.set(key, { start: now, count: 1 });
      if (windows.size > 10_000) for (const [k, v] of windows) if (now - v.start >= 60_000) windows.delete(k);
      return;
    }
    if (++w.count > limitPerMinute) {
      reply.header("retry-after", String(Math.ceil((w.start + 60_000 - now) / 1000)));
      return reply.code(429).send({ error: "rate_limited", message: "Too many requests. Please wait a moment and try again." });
    }
  };
}
