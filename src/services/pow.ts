// Solves the server's bot-protection puzzle (see server/pow.ts) using the browser's built-in SHA-256.
function zeroBits(bytes: Uint8Array) {
  let n = 0;
  for (const b of bytes) {
    if (b === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(b) - 24;
  }
  return n;
}

export async function solvePow(challenge: string, bits: number): Promise<string> {
  const enc = new TextEncoder();
  for (let i = 0; ; i++) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`${challenge}:${i}`)));
    if (zeroBits(digest) >= bits) return String(i);
  }
}
