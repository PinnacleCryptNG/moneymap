// MoneyMap server: the REST API plus the built customer app, in one process.
//   npm run build:server-app   (builds the frontend in API mode into dist/)
//   npm start                   (serves API on /api/v1, docs on /docs, app on /)
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "./app";
import { openDb } from "./db";

const db = openDb();
const app = await buildApp(db, { logger: process.env.NODE_ENV !== "test" });

const dist = resolve(process.env.MONEYMAP_DIST ?? "dist");
if (existsSync(dist)) {
  await app.register(fastifyStatic, { root: dist, wildcard: false });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith("/api/") ? reply.code(404).send({ error: "not_found", message: "No such endpoint." }) : reply.sendFile("index.html"),
  );
}

const port = Number(process.env.PORT ?? 8080);
await app.listen({ port, host: "0.0.0.0" });
console.log(`MoneyMap API on http://localhost:${port}/api/v1 · docs on /docs${existsSync(dist) ? " · app on /" : ""}`);
