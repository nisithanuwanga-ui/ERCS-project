<<<<<<< HEAD
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { pool, transaction } from "./database.js";
export async function migrate() {
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(716529)");
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
    for (const name of (await readdir(dir))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(`${dir}/${name}`, "utf8");
      const normalized = sql.replace(/\r\n/g, "\n");
      const checksum = createHash("sha256").update(normalized).digest("hex");
      const rawChecksum = createHash("sha256").update(sql).digest("hex");
      const previous = (
        await db.query("SELECT checksum FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rows[0];
      if (
        previous &&
        previous.checksum !== checksum &&
        previous.checksum !== rawChecksum
      )
        throw new Error(`Migration checksum mismatch: ${name}`);
      if (!previous) {
        await db.query(sql);
        await db.query(
          "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
          [name, checksum],
        );
        console.log(`Applied ${name}`);
      }
    }
  });
}
if (
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.js")
) {
  migrate()
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
      return pool.end();
    });
=======
import { readFile } from "node:fs/promises";
import { pool } from "./db.js";

try {
  const migration = await readFile(
    new URL("../sql/001_create_incidents.sql", import.meta.url),
    "utf8",
  );
  await pool.query(migration);
  console.log("Database migrations completed successfully");
} catch (error) {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
>>>>>>> origin/main
}
