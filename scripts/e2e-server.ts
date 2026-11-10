import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import argon2 from "argon2";
import { freePort } from "./free-port.js";
import type { Server } from "node:http";
import type { Pool } from "pg";
import type { ViteDevServer } from "vite";
const databasePort = await freePort();
const password = randomBytes(24).toString("hex");
const dbDir = await mkdtemp(resolve(tmpdir(), "ercs-test-db-e2e-"));
const db = new EmbeddedPostgres({
  databaseDir: dbDir,
  user: "ercs_e2e",
  password,
  port: databasePort,
  persistent: true,
  authMethod: "scram-sha-256",
  autoRehydrateSymlinks: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: console.error,
});
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = `postgresql://ercs_e2e:${password}@127.0.0.1:${databasePort}/postgres`;
process.env.SESSION_SECRET = randomBytes(40).toString("hex");
process.env.APP_ORIGIN = "http://127.0.0.1:5175";
process.env.API_TARGET = "http://127.0.0.1:3005";
let databaseStarted = false;
let pool: Pool | undefined;
let server: Server | undefined;
let vite: ViteDevServer | undefined;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (vite) await vite.close();
  if (server) {
    const current = server;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        current.closeAllConnections();
        resolve();
      }, 5000);
      timer.unref();
      current.close(() => {
        clearTimeout(timer);
        resolve();
      });
      current.closeIdleConnections();
    });
  }
  if (pool) await pool.end();
  // Never stop a failed-to-start process: the helper's stop promise can wait
  // forever for an exit event which already happened.
  if (databaseStarted) await db.stop();
  if (dbDir) {
    try {
      await rm(dbDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    } catch {}
  }
}
function shutdown() {
  void stop().catch((error: unknown) => {
    console.error("E2E shutdown failed:", error);
    process.exitCode = 1;
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

try {
  await db.initialise();
  if (!stopping) {
    await db.start();
    databaseStarted = true;
    const { migrate } = await import("../backend/src/migrate.js");
    await migrate();
    pool = (await import("../backend/src/database.js")).pool;
    const hash = await argon2.hash("E2eOnlyPassword123!");
    for (const role of [
      "administrator",
      "coordinator",
      "resource_manager",
      "field_officer",
      "viewer",
    ]) {
      await pool.query(
        "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4)",
        [role, `${role}@ercs.test`, hash, role],
      );
    }
    const { createApp } = await import("../backend/src/app.js");
    server = createApp().listen(3005, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server!.once("listening", resolve);
      server!.once("error", reject);
    });
    const { createServer } = await import("vite");
    vite = await createServer({
      server: { host: "127.0.0.1", port: 5175, strictPort: true },
    });
    await vite.listen();
    console.log("E2E isolated database, API and frontend ready.");
  }
} catch (error) {
  console.error("E2E startup failed:", error);
  process.exitCode = 1;
  await stop();
}
