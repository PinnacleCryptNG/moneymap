// Row-level security, run for real on PostgreSQL (PGlite: Postgres compiled to WebAssembly).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const schema = readFileSync("db/postgres/schema.sql", "utf8");
const rls = readFileSync("db/postgres/rls.sql", "utf8");
let pg: PGlite;

/** Run statements as the API would: role moneymap_app, with the request's identity set. */
async function as(who: { customer?: string; admin?: boolean }, sql: string, params: unknown[] = []) {
  return pg.transaction(async (tx) => {
    await tx.query("SET LOCAL ROLE moneymap_app");
    if (who.customer) await tx.query("SELECT set_config('app.customer_id', $1, true)", [who.customer]);
    if (who.admin) await tx.query("SELECT set_config('app.role', 'admin', true)");
    return tx.query(sql, params);
  });
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(schema);
  await pg.exec(rls);
  await pg.exec(`
    INSERT INTO customers VALUES ('CUST_A', '{}', 'now'), ('CUST_B', '{}', 'now');
    INSERT INTO goals VALUES ('G1', 'CUST_A', 'save_more', 'A goal', 1, 12, 0, NULL, 1, 'now'), ('G2', 'CUST_B', 'save_more', 'B goal', 1, 12, 0, NULL, 1, 'now');
    INSERT INTO recommendations VALUES ('R1', 'CUST_A', 'P', 'P', 'savings', NULL, 90, '[]', 't', 'eligible', 'v', 'recommended', NULL, NULL, NULL, '{}', '[]', '{}', 'now');
    INSERT INTO recommendation_reasons VALUES ('R1', 0, 'k', 'l', 'd');
    INSERT INTO products VALUES ('P', 1, 'active', '{}', 'now');
  `);
}, 60_000);
afterAll(async () => pg?.close());

describe("PostgreSQL row-level security", () => {
  it("matches the SQLite schema table for table", () => {
    const src = readFileSync("server/db.ts", "utf8");
    const tables = (s: string) => [...s.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]).sort();
    expect(tables(schema)).toEqual(tables(src));
  });

  it("a customer sees only their own rows, even with no WHERE clause", async () => {
    const r = await as({ customer: "CUST_A" }, "SELECT id FROM goals");
    expect(r.rows).toEqual([{ id: "G1" }]);
    expect((await as({ customer: "CUST_A" }, "SELECT id FROM customers")).rows).toEqual([{ id: "CUST_A" }]);
  });

  it("with no identity set, nothing is visible", async () => {
    expect((await as({}, "SELECT id FROM goals")).rows).toEqual([]);
  });

  it("a customer can't write rows for someone else, or change another's", async () => {
    await expect(as({ customer: "CUST_A" }, "INSERT INTO goals VALUES ('G3', 'CUST_B', 'save_more', 'x', 1, 12, 0, NULL, 0, 'now')")).rejects.toThrow(/row-level security/);
    const upd = await as({ customer: "CUST_A" }, "UPDATE goals SET label = 'hacked' WHERE id = 'G2'");
    expect(upd.affectedRows).toBe(0);
  });

  it("reasons follow their recommendation's owner", async () => {
    expect((await as({ customer: "CUST_A" }, "SELECT detail FROM recommendation_reasons")).rows).toHaveLength(1);
    expect((await as({ customer: "CUST_B" }, "SELECT detail FROM recommendation_reasons")).rows).toHaveLength(0);
  });

  it("bank staff can read everyone's rows and change the catalogue; customers can't", async () => {
    expect((await as({ admin: true }, "SELECT id FROM goals ORDER BY id")).rows).toHaveLength(2);
    expect((await as({ customer: "CUST_A" }, "UPDATE products SET status = 'inactive'")).affectedRows).toBe(0);
    expect((await as({ admin: true }, "UPDATE products SET status = 'inactive'")).affectedRows).toBe(1);
  });

  it("the audit log is append-only", async () => {
    await as({ customer: "CUST_A" }, "INSERT INTO audit_log (at, actor, action, detail, prev_hash, hash) VALUES ('now', 'customer', 'x', 'y', 'p', 'h')");
    expect((await as({ customer: "CUST_A" }, "SELECT * FROM audit_log")).rows).toHaveLength(0);
    await expect(as({ admin: true }, "DELETE FROM audit_log")).rejects.toThrow(/permission denied/);
    expect((await as({ admin: true }, "SELECT * FROM audit_log")).rows).toHaveLength(1);
  });
});
