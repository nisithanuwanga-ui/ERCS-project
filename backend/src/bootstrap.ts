import argon2 from "argon2";
import { z } from "zod";
import { pool, transaction, audit } from "./database.js";
import { passwordSchema } from "./validation.js";
const v = z
  .object({
    BOOTSTRAP_EMAIL: z.email().transform((v) => v.toLowerCase()),
    BOOTSTRAP_NAME: z.string().min(2),
    BOOTSTRAP_PASSWORD: passwordSchema,
  })
  .parse(process.env);
try {
  const hash = await argon2.hash(v.BOOTSTRAP_PASSWORD);
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(91732)");
    if (
      (
        await db.query(
          "SELECT id FROM users WHERE role='administrator' AND active",
        )
      ).rowCount
    )
      throw new Error(
        "An active administrator already exists. Use authorized invitations.",
      );
    const user = (
      await db.query(
        "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'administrator') RETURNING id",
        [v.BOOTSTRAP_NAME, v.BOOTSTRAP_EMAIL, hash],
      )
    ).rows[0];
    await audit(db, user.id, "admin.bootstrapped", "users", user.id);
  });
  console.log(
    "Administrator provisioned. Remove BOOTSTRAP_PASSWORD from the environment.",
  );
} finally {
  await pool.end();
}
