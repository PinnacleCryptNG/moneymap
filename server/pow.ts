// Bot protection for public sign-in: a small proof-of-work puzzle. A person's browser solves it in well under
// a second; a script opening thousands of sessions pays for every one. Stateless challenges, signed and
// time-limited; each can be used once.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_MS = 2 * 60 * 1000;

export interface PowSolution {
  challenge: string;
  nonce: string;
}

export function powGuard(secret: string, bits: number) {
  const used = new Map<string, number>();
  const sign = (s: string) => createHmac("sha256", secret).update(s).digest("base64url");

  function leadingZeroBits(hash: Buffer) {
    let n = 0;
    for (const byte of hash) {
      if (byte === 0) {
        n += 8;
        continue;
      }
      n += Math.clz32(byte) - 24;
      break;
    }
    return n;
  }

  return {
    bits,
    issue() {
      const body = `${Date.now()}.${randomBytes(12).toString("base64url")}`;
      return { challenge: `${body}.${sign(body)}`, bits };
    },
    /** Null when the solution is valid; otherwise why not. */
    check(sol: PowSolution | undefined): string | null {
      if (bits === 0) return null;
      if (!sol || typeof sol.challenge !== "string" || typeof sol.nonce !== "string") return "Bot check missing. Please reload the page and try again.";
      const parts = sol.challenge.split(".");
      if (parts.length !== 3) return "Bot check invalid.";
      const body = `${parts[0]}.${parts[1]}`;
      const expected = Buffer.from(sign(body));
      const given = Buffer.from(parts[2]);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "Bot check invalid.";
      const age = Date.now() - Number(parts[0]);
      if (!(age >= 0 && age < TTL_MS)) return "Bot check expired. Please try again.";
      if (used.has(sol.challenge)) return "Bot check already used.";
      if (leadingZeroBits(createHash("sha256").update(`${sol.challenge}:${sol.nonce}`).digest()) < bits) return "Bot check not solved.";
      used.set(sol.challenge, Date.now());
      if (used.size > 5000) for (const [k, t] of used) if (Date.now() - t > TTL_MS) used.delete(k);
      return null;
    },
  };
}

/** Solve a challenge (used by scripts and tests; the browser has its own copy in src/services/pow.ts). */
export function solvePow(challenge: string, bits: number): string {
  for (let i = 0; ; i++) {
    const h = createHash("sha256").update(`${challenge}:${i}`).digest();
    let n = 0;
    for (const byte of h) {
      if (byte === 0) {
        n += 8;
        continue;
      }
      n += Math.clz32(byte) - 24;
      break;
    }
    if (n >= bits) return String(i);
  }
}
