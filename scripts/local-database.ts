import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
if (process.env.NODE_ENV === "production")
  throw new Error("Local database is development-only.");
await mkdir(".local-db", { recursive: true });
const secretPath = resolve(".local-db/connection.json");
const secret = existsSync(secretPath)
  ? JSON.parse(await readFile(secretPath, "utf8"))
  : {
      password: randomBytes(24).toString("hex"),
      session: randomBytes(40).toString("hex"),
    };
if (!existsSync(secretPath))
  await writeFile(secretPath, JSON.stringify(secret), { mode: 0o600 });
const db = new EmbeddedPostgres({
  databaseDir: resolve(".local-db/data"),
  user: "ercs",
  password: secret.password,
  port: 55432,
  persistent: true,
  authMethod: "scram-sha-256",
  autoRehydrateSymlinks: true,
  onLog: () => {},
  onError: console.error,
  postgresFlags: ["-h", "127.0.0.1"],
});
if (!existsSync(".local-db/data/PG_VERSION")) await db.initialise();
await db.start();
const client = db.getPgClient();
await client.connect();
if (
  !(await client.query("SELECT 1 FROM pg_database WHERE datname='ercs'"))
    .rowCount
)
  await client.query("CREATE DATABASE ercs");
await client.end();
if (!existsSync(".env"))
  await writeFile(
    ".env",
    `NODE_ENV=development\nPORT=3001\nAPP_ORIGIN=http://127.0.0.1:5173\nDATABASE_URL=postgresql://ercs:${secret.password}@127.0.0.1:55432/ercs\nSESSION_SECRET=${secret.session}\nTRUST_PROXY=0\n`,
    { mode: 0o600 },
  );
console.log(
  "Development PostgreSQL ready on 127.0.0.1:55432. Configuration is in ignored .env. Run npm run db:migrate, then provision the first administrator with npm run db:bootstrap.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await db.stop();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
setInterval(() => {}, 60000);
