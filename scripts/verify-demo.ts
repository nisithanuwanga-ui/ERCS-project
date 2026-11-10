import assert from "node:assert/strict";
import argon2 from "argon2";
import request from "supertest";
import { createApp } from "../backend/src/app.js";
import { config } from "../backend/src/config.js";
import { pool } from "../backend/src/database.js";
import { assertLocalDemoEnvironment } from "../backend/src/demo-policy.js";
import { migrate } from "../backend/src/migrate.js";
import { seedDemoAccounts } from "../backend/src/seed-demo.js";
import { demoAccounts } from "./demo-accounts.js";

let checks = 0;
const originalEnvironment = config.NODE_ENV;
try {
  assertLocalDemoEnvironment(config.NODE_ENV, config.DATABASE_URL);
  await migrate();
  const preserved = (
    await pool.query(
      "SELECT id,role,active,session_version,password_hash FROM users WHERE NOT is_demo ORDER BY id",
    )
  ).rows;
  const first = await seedDemoAccounts(demoAccounts);
  const idsBefore = (
    await pool.query("SELECT id,email FROM users WHERE is_demo ORDER BY email")
  ).rows;
  const second = await seedDemoAccounts(demoAccounts);
  assert.equal(second.created, 0);
  assert.equal(second.existing, 5);
  assert.deepEqual(
    (
      await pool.query(
        "SELECT id,email FROM users WHERE is_demo ORDER BY email",
      )
    ).rows,
    idsBefore,
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT id,role,active,session_version,password_hash FROM users WHERE NOT is_demo ORDER BY id",
      )
    ).rows,
    preserved,
  );
  console.log(
    `PASS explicit local demo seed (${first.created} created), repeated seed preserved IDs and data`,
  );
  checks++;
  const app = createApp();
  const agents: Array<ReturnType<typeof request.agent>> = [];
  for (const account of demoAccounts) {
    const stored = (
      await pool.query("SELECT * FROM users WHERE email=$1", [account.email])
    ).rows[0];
    assert.equal(stored.is_demo, true);
    assert.notEqual(stored.password_hash, account.password);
    assert.ok(await argon2.verify(stored.password_hash, account.password));
    const agent = request.agent(app);
    agents.push(agent);
    const token = (await agent.get("/api/auth/csrf")).body.data.token;
    const login = await agent
      .post("/api/auth/login")
      .set("Origin", config.APP_ORIGIN)
      .set("X-CSRF-Token", token)
      .send({
        email: account.email,
        password: account.password,
        remember: false,
      });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.equal(login.body.data.role, account.role);
    assert.equal(login.body.data.is_demo, true);
    assert.equal("password_hash" in login.body.data, false);
    const me = await agent.get("/api/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.data.is_demo, true);
    console.log(
      `PASS hashed ${account.role} demo account and real CSRF/session login`,
    );
    checks++;
  }
  config.NODE_ENV = "production";
  await assert.rejects(
    seedDemoAccounts(demoAccounts),
    /restricted to development/,
  );
  for (let index = 0; index < demoAccounts.length; index++) {
    const account = demoAccounts[index];
    const existingAgent = agents[index];
    assert.equal((await existingAgent.get("/api/auth/me")).status, 401);
    const agent = request.agent(app);
    const token = (await agent.get("/api/auth/csrf")).body.data.token;
    const login = await agent
      .post("/api/auth/login")
      .set("Origin", config.APP_ORIGIN)
      .set("X-CSRF-Token", token)
      .send({
        email: account.email,
        password: account.password,
        remember: false,
      });
    assert.equal(login.status, 401, JSON.stringify(login.body));
  }
  console.log(
    "PASS production rejects seeding, all demo logins, and pre-existing demo sessions",
  );
  checks++;
  console.log(`${checks} demo account verification checks passed.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  config.NODE_ENV = originalEnvironment;
  await pool.end();
}
