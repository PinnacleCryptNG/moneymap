// Field-level encryption for the most sensitive text MoneyMap stores: bank narrations, the customer's own
// answers about their money, message text and stored explanations. AES-256-GCM, so stored values can't be
// read or altered unnoticed; each value is bound to its table and column, so it can't be moved elsewhere.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const DEV_KEY_MATERIAL = "moneymap-local-development-only";

export interface FieldCipher {
  seal(plain: string, where: string): string;
  /** Values written before encryption was switched on are read as they are. */
  open(stored: string, where: string): string;
  usingDevKey: boolean;
}

/** Key from MONEYMAP_DATA_KEY, else derived from MONEYMAP_SECRET; a fixed key only for local development. */
export function fieldCipher(env: NodeJS.ProcessEnv = process.env): FieldCipher {
  const material = env.MONEYMAP_DATA_KEY ?? env.MONEYMAP_SECRET ?? DEV_KEY_MATERIAL;
  const key = Buffer.from(hkdfSync("sha256", material, "moneymap", "field-encryption-v1", 32));
  return {
    usingDevKey: material === DEV_KEY_MATERIAL,
    seal(plain, where) {
      const iv = randomBytes(12);
      const c = createCipheriv("aes-256-gcm", key, iv);
      c.setAAD(Buffer.from(where));
      const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
      return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
    },
    open(stored, where) {
      if (!stored.startsWith(PREFIX)) return stored;
      const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
      const d = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
      d.setAAD(Buffer.from(where));
      d.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
    },
  };
}
