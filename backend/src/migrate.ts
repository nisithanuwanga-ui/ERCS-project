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
}
