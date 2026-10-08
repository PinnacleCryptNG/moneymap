// Shared HTTP client for outbound calls to Zenith systems: timeout, bounded retries, and health tracking.

export interface AdapterHealth {
  /** "demo" = simulated inside MoneyMap; "http" = calling a configured Zenith endpoint. */
  mode: "demo" | "http";
  /** Host only — never credentials or paths. */
  target: string | null;
  calls: number;
  failures: number;
  lastOkAt: string | null;
  lastError: { at: string; message: string } | null;
}

export function newHealth(mode: AdapterHealth["mode"], baseUrl?: string): AdapterHealth {
  return { mode, target: baseUrl ? new URL(baseUrl).host : null, calls: 0, failures: 0, lastOkAt: null, lastError: null };
}

export function trackOk(h: AdapterHealth) {
  h.calls++;
  h.lastOkAt = new Date().toISOString();
}

export function trackFail(h: AdapterHealth, e: unknown) {
  h.calls++;
  h.failures++;
  h.lastError = { at: new Date().toISOString(), message: e instanceof Error ? e.message : String(e) };
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

export interface HttpOptions {
  baseUrl: string;
  /** Sent as a bearer token. In production: a client-credentials token or mTLS instead. */
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** JSON request with a timeout. Retries network errors and 5xx/429 with backoff; never retries other 4xx. */
export async function request<T>(
  opts: HttpOptions,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(150 * 2 ** (attempt - 1));
    try {
      const res = await fetch(new URL(path, opts.baseUrl), {
        method,
        headers: {
          accept: "application/json",
          ...(body !== undefined && { "content-type": "application/json" }),
          ...(opts.apiKey && { authorization: `Bearer ${opts.apiKey}` }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
      });
      if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
      const err = new UpstreamError(`${method} ${path} → HTTP ${res.status}`, res.status);
      if (res.status < 500 && res.status !== 429) throw err;
      last = err;
    } catch (e) {
      if (e instanceof UpstreamError && e.status !== null && e.status < 500 && e.status !== 429) throw e;
      last = e instanceof Error && e.name === "TimeoutError" ? new UpstreamError(`${method} ${path} timed out`, null) : e;
    }
  }
  throw last instanceof Error ? last : new UpstreamError(String(last), null);
}
