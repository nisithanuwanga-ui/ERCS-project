import { pool } from "../backend/src/database.js";
import { seedDemoAccounts } from "../backend/src/seed-demo.js";
import { demoAccounts } from "./demo-accounts.js";
try {
  const result = await seedDemoAccounts(demoAccounts);
  console.log(
    `Development demo accounts ready: ${result.created} created, ${result.existing} existing. Public example credentials are documented in docs/DEMO-ACCOUNTS.md.`,
  );
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
