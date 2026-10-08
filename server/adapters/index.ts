// Integration adapters (step 4). Each Zenith system MoneyMap touches sits behind one small interface with a
// demo implementation (simulated inside MoneyMap) and an HTTP implementation for a configured endpoint.
// Switching from demo to the bank is configuration only — see docs/INTEGRATION.md.
import { applicationAdapter, type ApplicationAdapter } from "./applications";
import { coreBankingAdapter, type CoreBankingAdapter } from "./coreBanking";
import type { HttpOptions } from "./http";
import { identityAdapter, type IdentityAdapter, type OidcConfig } from "./identity";
import { notificationAdapter, type NotificationAdapter } from "./notifications";

export interface Adapters {
  identity: IdentityAdapter;
  coreBanking: CoreBankingAdapter;
  notifications: NotificationAdapter;
  applications: ApplicationAdapter;
  /** Shared secret for signed inbound transaction webhooks; null = webhooks need an admin token. */
  feedSecret: string | null;
}

export interface AdapterConfig {
  oidc?: OidcConfig | null;
  coreBanking?: HttpOptions | null;
  notifications?: HttpOptions | null;
  applications?: HttpOptions | null;
  feedSecret?: string | null;
}

export function createAdapters(c: AdapterConfig = {}, opts: { allowDemoTokens?: boolean } = {}): Adapters {
  return {
    identity: identityAdapter(c.oidc ?? null, opts),
    coreBanking: coreBankingAdapter(c.coreBanking ?? null),
    notifications: notificationAdapter(c.notifications ?? null),
    applications: applicationAdapter(c.applications ?? null),
    feedSecret: c.feedSecret ?? null,
  };
}

/** Read adapter configuration from the environment. Anything not set stays in demo mode. */
export function adapterConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AdapterConfig {
  const http = (prefix: string): HttpOptions | null =>
    env[`${prefix}_URL`] ? { baseUrl: withSlash(env[`${prefix}_URL`]!), apiKey: env[`${prefix}_API_KEY`], timeoutMs: Number(env.ZENITH_TIMEOUT_MS ?? 4000) } : null;
  return {
    oidc:
      env.ZENITH_OIDC_ISSUER && env.ZENITH_OIDC_AUDIENCE && env.ZENITH_OIDC_JWKS_URL
        ? { issuer: env.ZENITH_OIDC_ISSUER, audience: env.ZENITH_OIDC_AUDIENCE, jwksUrl: env.ZENITH_OIDC_JWKS_URL, customerClaim: env.ZENITH_OIDC_CUSTOMER_CLAIM, adminRole: env.ZENITH_OIDC_ADMIN_ROLE }
        : null,
    coreBanking: http("ZENITH_CORE_BANKING"),
    notifications: http("ZENITH_NOTIFICATIONS"),
    applications: http("ZENITH_APPLICATIONS"),
    feedSecret: env.ZENITH_FEED_SECRET ?? null,
  };
}

const withSlash = (u: string) => (u.endsWith("/") ? u : `${u}/`);
