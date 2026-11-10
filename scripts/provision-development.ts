import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import argon2 from "argon2";
import { config } from "../backend/src/config.js";
import { pool, audit, transaction } from "../backend/src/database.js";
if (
  config.NODE_ENV !== "development" ||
  !config.DATABASE_URL.includes("127.0.0.1:55432")
)
  throw new Error(
    "This utility only provisions the project-local development database.",
  );
try {
  const password = `Dev!${randomBytes(18).toString("hex")}A1`;
  const hash = await argon2.hash(password);
  const created = await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(91732)");
    if (
      (
        await db.query(
          "SELECT id FROM users WHERE role='administrator' AND active",
        )
      ).rowCount
    )
      return false;
    const item = (
      await db.query(
        "INSERT INTO users(name,email,password_hash,role) VALUES('Development administrator','admin@ercs.local',$1,'administrator') RETURNING id",
        [hash],
      )
    ).rows[0];
    await audit(db, item.id, "admin.bootstrapped", "users", item.id);
    return true;
  });
  if (created) {
    await writeFile(
      ".local-db/administrator.txt",
      `Development access only\nEmail: admin@ercs.local\nPassword: ${password}\n`,
      { mode: 0o600 },
    );
    console.log(
      "Development administrator created. Credentials are in ignored .local-db/administrator.txt. No operational demo records were created.",
    );
  } else
    console.log("An administrator already exists; no account was changed.");
} finally {
  await pool.end();
}
