import argon2 from "argon2";
import type { Role } from "../../shared/domain.js";
import { config } from "./config.js";
import { audit, transaction } from "./database.js";
import { assertLocalDemoEnvironment } from "./demo-policy.js";

// This guarded service is invoked only by explicit development tooling.
// Public example passwords live in scripts/, outside production compilation.
export interface DemoAccount {
  email: string;
  password: string;
  name: string;
  role: Role;
}

export async function seedDemoAccounts(
  demoAccounts: ReadonlyArray<DemoAccount>,
) {
  assertLocalDemoEnvironment(config.NODE_ENV, config.DATABASE_URL);
  return transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(91732)");
    let created = 0;
    for (const account of demoAccounts) {
      const existing = (
        await db.query("SELECT * FROM users WHERE email=$1 FOR UPDATE", [
          account.email,
        ])
      ).rows[0];
      if (existing) {
        if (!existing.is_demo)
          throw new Error(
            `Refusing to overwrite a non-demo account: ${account.email}`,
          );
        if (
          existing.role !== account.role ||
          !existing.active ||
          !(await argon2.verify(existing.password_hash, account.password))
        )
          throw new Error(
            `Demo account ${account.email} was modified. No account or credential was overwritten.`,
          );
        continue;
      }
      const hash = await argon2.hash(account.password);
      const user = (
        await db.query(
          "INSERT INTO users(name,email,password_hash,role,is_demo) VALUES($1,$2,$3,$4,true) RETURNING id",
          [account.name, account.email, hash, account.role],
        )
      ).rows[0];
      await audit(db, user.id, "demo.account_seeded", "users", user.id, {
        development_only: true,
        role: account.role,
      });
      created++;
    }
    return { created, existing: demoAccounts.length - created };
  });
}
