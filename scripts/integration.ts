import EmbeddedPostgres from "embedded-postgres";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import request from "supertest";
import argon2 from "argon2";
import { freePort } from "./free-port.js";
const databasePort = await freePort();
const password = randomBytes(24).toString("hex");
const external = process.env.TEST_DATABASE_URL;
if (external && !/(test|127\.0\.0\.1|localhost)/.test(external))
  throw new Error(
    "Use a disposable TEST_DATABASE_URL containing test or loopback host.",
  );
const dbDir = external ? "" : await mkdtemp(resolve(tmpdir(), "ercs-test-db-"));
const embedded = external
  ? null
  : new EmbeddedPostgres({
      databaseDir: dbDir,
      user: "ercs_test",
      password,
      port: databasePort,
      persistent: true,
      autoRehydrateSymlinks: true,
      authMethod: "scram-sha-256",
      postgresFlags: ["-h", "127.0.0.1"],
      onLog: (message) => {
        if (/FATAL|PANIC|ERROR/.test(message)) console.error(message);
      },
      onError: console.error,
    });
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  external ??
  `postgresql://ercs_test:${password}@127.0.0.1:${databasePort}/postgres`;
process.env.SESSION_SECRET = randomBytes(40).toString("hex");
process.env.APP_ORIGIN = "http://127.0.0.1:5173";
// Test mode keeps production's exact allowlist behavior. Explicitly exercise
// both browser hostnames without enabling development aliases in this fixture.
process.env.TRUSTED_ORIGINS = "http://localhost:5173";
let closePool: (() => Promise<void>) | undefined;
let completed = 0;
let databaseStarted = false;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  completed++;
  console.log(`PASS ${name}`);
}
try {
  if (embedded) {
    await embedded.initialise();
    await embedded.start();
    databaseStarted = true;
  }
  const { pool } = await import("../backend/src/database.js");
  closePool = () => pool.end();
  const { migrate } = await import("../backend/src/migrate.js");
  await migrate();
  await migrate();
  const { createApp } = await import("../backend/src/app.js");
  const app = createApp();
  const testPassword = "IntegrationPassword123!";
  const hash = await argon2.hash(testPassword);
  const actors: Record<
    string,
    { id: string; agent: ReturnType<typeof request.agent> }
  > = {};
  for (const role of [
    "administrator",
    "coordinator",
    "resource_manager",
    "field_officer",
    "viewer",
  ]) {
    const user = (
      await pool.query(
        "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id",
        [role, `${role}@ercs.test`, hash, role],
      )
    ).rows[0];
    actors[role] = { id: user.id, agent: request.agent(app) };
  }
  async function mutate(
    role: string,
    method: "post" | "patch",
    path: string,
    body: object,
    key?: string,
  ) {
    const agent = actors[role].agent;
    const token = (await agent.get("/api/auth/csrf")).body.data.token;
    let call = agent[method](`/api${path}`)
      .set("Origin", process.env.APP_ORIGIN!)
      .set("X-CSRF-Token", token);
    if (key) call = call.set("Idempotency-Key", key);
    return call.send(body);
  }
  for (const role of Object.keys(actors)) {
    const r = await mutate(role, "post", "/auth/login", {
      email: `${role}@ercs.test`,
      password: testPassword,
      remember: false,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const refs = (await actors.coordinator.agent.get("/api/reference-data")).body
    .data;
  const incidentCategory = refs.find(
    (r: { kind: string }) => r.kind === "incident_category",
  ).id;
  const resourceCategory = refs.find(
    (r: { kind: string }) => r.kind === "resource_category",
  ).id;
  const teamType = refs.find(
    (r: { kind: string }) => r.kind === "team_type",
  ).id;
  let incidentId = "",
    resourceId = "",
    requestId = "",
    allocationId = "",
    teamId = "";
  await check("anonymous requests and CSRF rejected", async () => {
    assert.equal((await request(app).get("/api/incidents")).status, 401);
    assert.equal(
      (await actors.coordinator.agent.post("/api/incidents").send({})).status,
      403,
    );
  });
  for (const origin of ["http://127.0.0.1:5173", "http://localhost:5173"]) {
    await check(
      `login, session rotation and logout from ${origin}`,
      async () => {
        const agent = request.agent(app);
        assert.equal((await agent.get("/api/auth/me")).status, 401);
        const csrf = await agent.get("/api/auth/csrf").set("Origin", origin);
        assert.equal(csrf.status, 200, JSON.stringify(csrf.body));
        const token = csrf.body.data.token;
        assert.match(token, /^[a-f0-9]{64}$/);
        assert.match(String(csrf.headers["cache-control"]), /no-store/);
        const initialCookie = String(csrf.headers["set-cookie"]);
        assert.match(initialCookie, /ercs\.sid=/);
        assert.match(initialCookie, /HttpOnly/i);
        assert.match(initialCookie, /SameSite=Lax/i);
        assert.doesNotMatch(initialCookie, /Domain=/i);
        const login = await agent
          .post("/api/auth/login")
          .set("Origin", origin)
          .set("X-CSRF-Token", token)
          .send({ email: "viewer@ercs.test", password: testPassword });
        assert.equal(login.status, 200, JSON.stringify(login.body));
        assert.equal(login.body.data.id, actors.viewer.id);
        assert.notEqual(
          String(login.headers["set-cookie"]).split(";")[0],
          initialCookie.split(";")[0],
        );
        assert.match(String(login.headers["set-cookie"]), /HttpOnly/i);
        assert.match(String(login.headers["set-cookie"]), /SameSite=Lax/i);
        assert.equal((await agent.get("/api/auth/me")).status, 200);
        assert.equal((await agent.get("/api/dashboard/summary")).status, 200);
        const rotated = (await agent.get("/api/auth/csrf")).body.data.token;
        assert.notEqual(rotated, token);
        assert.equal(
          (
            await agent
              .post("/api/auth/logout")
              .set("Origin", origin)
              .set("X-CSRF-Token", token)
              .send({})
          ).status,
          403,
        );
        const logout = await agent
          .post("/api/auth/logout")
          .set("Origin", origin)
          .set("X-CSRF-Token", rotated)
          .send({});
        assert.equal(logout.status, 200, JSON.stringify(logout.body));
        assert.match(String(logout.headers["set-cookie"]), /ercs\.sid=;/);
        assert.equal((await agent.get("/api/auth/me")).status, 401);
        assert.equal((await agent.get("/api/dashboard/summary")).status, 401);
      },
    );
  }
  await check(
    "untrusted and missing origins are rejected with a valid session CSRF token",
    async () => {
      const agent = request.agent(app);
      const token = (await agent.get("/api/auth/csrf")).body.data.token;
      const credentials = { email: "viewer@ercs.test", password: testPassword };
      for (const origin of [
        undefined,
        "null",
        "https://attacker.invalid",
        "http://localhost:5174",
        "https://localhost:5173",
        "http://localhost:5173.attacker.invalid",
        "http://localhost:5173/path",
        "http://127.0.0.2:5173",
        "http://127.0.0.1:3001",
      ]) {
        let login = agent.post("/api/auth/login").set("X-CSRF-Token", token);
        if (origin !== undefined) login = login.set("Origin", origin);
        const rejected = await login.send(credentials);
        assert.equal(
          rejected.status,
          403,
          `${String(origin)}: ${JSON.stringify(rejected.body)}`,
        );
        assert.equal(rejected.body.error.code, "CSRF");
        assert.match(rejected.body.error.message, /origin is not allowed/i);
      }
      assert.equal((await agent.get("/api/auth/me")).status, 401);
    },
  );
  await check(
    "trusted origins still require the correct CSRF token and session",
    async () => {
      const agent = request.agent(app);
      const other = request.agent(app);
      const token = (await agent.get("/api/auth/csrf")).body.data.token;
      const otherToken = (await other.get("/api/auth/csrf")).body.data.token;
      for (const origin of ["http://127.0.0.1:5173", "http://localhost:5173"]) {
        for (const csrf of [undefined, "not-a-valid-token", otherToken]) {
          let call = agent.post("/api/auth/login").set("Origin", origin);
          if (csrf !== undefined) call = call.set("X-CSRF-Token", csrf);
          const result = await call.send({
            email: "viewer@ercs.test",
            password: testPassword,
          });
          assert.equal(result.status, 403, JSON.stringify(result.body));
          assert.equal(result.body.error.code, "CSRF");
          assert.match(result.body.error.message, /security token expired/i);
        }
      }
      const noSession = await request(app)
        .post("/api/auth/login")
        .set("Origin", "http://localhost:5173")
        .set("X-CSRF-Token", token)
        .send({ email: "viewer@ercs.test", password: testPassword });
      assert.equal(noSession.status, 403);
      assert.equal((await agent.get("/api/auth/me")).status, 401);
    },
  );
  await check(
    "trusted origins do not bypass credential verification",
    async () => {
      const agent = request.agent(app);
      const token = (await agent.get("/api/auth/csrf")).body.data.token;
      const login = await agent
        .post("/api/auth/login")
        .set("Origin", "http://localhost:5173")
        .set("X-CSRF-Token", token)
        .send({ email: "viewer@ercs.test", password: "WrongPassword123!" });
      assert.equal(login.status, 401, JSON.stringify(login.body));
      assert.equal((await agent.get("/api/auth/me")).status, 401);
    },
  );
  await check(
    "successful sign-ins do not exhaust the failed-attempt limit",
    async () => {
      // A fresh app gives this repeated-login regression its own general API
      // request budget while retaining the real shared authentication router.
      const agent = request.agent(createApp());
      for (let attempt = 0; attempt < 20; attempt++) {
        const token = (await agent.get("/api/auth/csrf")).body.data.token;
        const login = await agent
          .post("/api/auth/login")
          .set("Origin", process.env.APP_ORIGIN!)
          .set("X-CSRF-Token", token)
          .send({ email: "viewer@ercs.test", password: testPassword });
        assert.equal(login.status, 200, JSON.stringify(login.body));
        assert.equal(login.body.data.id, actors.viewer.id);
      }
      assert.equal((await agent.get("/api/auth/me")).status, 200);
      const token = (await agent.get("/api/auth/csrf")).body.data.token;
      assert.equal(
        (
          await agent
            .post("/api/auth/logout")
            .set("Origin", process.env.APP_ORIGIN!)
            .set("X-CSRF-Token", token)
            .send({})
        ).status,
        200,
      );
      assert.equal((await agent.get("/api/auth/me")).status, 401);
    },
  );
  await check("cross-role and privilege escalation denied", async () => {
    assert.equal(
      (await mutate("viewer", "post", "/incidents", {})).status,
      403,
    );
    assert.equal(
      (await mutate("administrator", "post", "/allocations", {})).status,
      403,
    );
    assert.equal(
      (await actors.field_officer.agent.get("/api/users")).status,
      403,
    );
  });
  await check("create incident persists reporter and audit", async () => {
    const r = await mutate("coordinator", "post", "/incidents", {
      title: "Integration flood response",
      category_id: incidentCategory,
      description: "River flooding requires coordinated support.",
      severity: "high",
      priority: "critical",
      location: "Test district",
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    incidentId = r.body.data.id;
    assert.equal(r.body.data.reporter_id, actors.coordinator.id);
    assert.equal(
      (
        await pool.query("SELECT 1 FROM audit_logs WHERE entity_id=$1", [
          incidentId,
        ])
      ).rowCount,
      1,
    );
  });
  await check("field scope prevents unrelated incident reads", async () => {
    assert.equal(
      (await actors.field_officer.agent.get(`/api/incidents/${incidentId}`))
        .status,
      404,
    );
    assert.equal(
      (await actors.field_officer.agent.get("/api/incidents")).body.meta.total,
      0,
    );
  });
  await check("resource quantity and asset validation", async () => {
    const v = {
      name: "Integration medical packs",
      category_id: resourceCategory,
      description: "Test inventory only",
      kind: "stock",
      total_quantity: 10,
      status: "operational",
      location: "Test depot",
      threshold: 2,
    };
    assert.equal(
      (
        await mutate("resource_manager", "post", "/resources", {
          ...v,
          total_quantity: -1,
        })
      ).status,
      400,
    );
    const r = await mutate("resource_manager", "post", "/resources", v);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    resourceId = r.body.data.id;
    assert.equal(r.body.data.available_quantity, 10);
  });
  await check("request creation and sequential review", async () => {
    const r = await mutate("coordinator", "post", "/resource-requests", {
      incident_id: incidentId,
      resource_id: resourceId,
      category_id: null,
      quantity: 8,
      priority: "critical",
      justification: "Medical packs for flood response",
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    requestId = r.body.data.id;
    assert.equal(
      (
        await mutate(
          "coordinator",
          "patch",
          `/resource-requests/${requestId}/status`,
          { status: "approved" },
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await mutate(
          "coordinator",
          "patch",
          `/resource-requests/${requestId}/status`,
          { status: "under_review" },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await mutate(
          "coordinator",
          "patch",
          `/resource-requests/${requestId}/status`,
          { status: "approved" },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT available_quantity FROM resources WHERE id=$1",
          [resourceId],
        )
      ).rows[0].available_quantity,
      10,
    );
  });
  await check("partial allocation, replay, and payload conflict", async () => {
    const key = randomUUID();
    const payload = {
      request_id: requestId,
      resource_id: resourceId,
      quantity: 3,
    };
    const r = await mutate(
      "resource_manager",
      "post",
      "/allocations",
      payload,
      key,
    );
    assert.equal(r.status, 201, JSON.stringify(r.body));
    allocationId = r.body.data.id;
    const replay = await mutate(
      "resource_manager",
      "post",
      "/allocations",
      payload,
      key,
    );
    assert.equal(replay.body.data.id, allocationId);
    assert.equal(
      (
        await mutate(
          "resource_manager",
          "post",
          "/allocations",
          { ...payload, quantity: 2 },
          key,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await pool.query("SELECT status FROM resource_requests WHERE id=$1", [
          requestId,
        ])
      ).rows[0].status,
      "partially_fulfilled",
    );
  });
  await check(
    "concurrent allocation cannot exceed approved outstanding demand",
    async () => {
      const { allocate } =
        await import("../backend/src/modules/allocations.js");
      const user = {
        id: actors.resource_manager.id,
        name: "RM",
        email: "rm@ercs.test",
        role: "resource_manager" as const,
        active: true,
      };
      const outcomes = await Promise.allSettled([
        allocate(
          user,
          { request_id: requestId, resource_id: resourceId, quantity: 4 },
          randomUUID(),
        ),
        allocate(
          user,
          { request_id: requestId, resource_id: resourceId, quantity: 4 },
          randomUUID(),
        ),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(outcomes.filter((r) => r.status === "rejected").length, 1);
      const resource = (
        await pool.query("SELECT * FROM resources WHERE id=$1", [resourceId])
      ).rows[0];
      assert.equal(resource.allocated_quantity, 7);
      assert.equal(resource.available_quantity, 3);
    },
  );
  await check(
    "return replay, over-return rejection, and atomic inventory",
    async () => {
      const key = randomUUID();
      const payload = { quantity: 2, reason: "Operational return" };
      const r = await mutate(
        "resource_manager",
        "post",
        `/allocations/${allocationId}/releases`,
        payload,
        key,
      );
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(
        (
          await mutate(
            "resource_manager",
            "post",
            `/allocations/${allocationId}/releases`,
            payload,
            key,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await mutate(
            "resource_manager",
            "post",
            `/allocations/${allocationId}/releases`,
            { quantity: 2, reason: "Too many" },
            randomUUID(),
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT available_quantity FROM resources WHERE id=$1",
            [resourceId],
          )
        ).rows[0].available_quantity,
        5,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM allocation_releases WHERE allocation_id=$1",
            [allocationId],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await check(
    "inventory edit cannot reduce stock below allocated quantity",
    async () => {
      const r = await mutate(
        "resource_manager",
        "patch",
        `/resources/${resourceId}`,
        {
          name: "Medical packs",
          category_id: resourceCategory,
          description: "Test inventory",
          kind: "stock",
          total_quantity: 1,
          status: "operational",
          location: "Test depot",
          threshold: 2,
        },
      );
      assert.equal(r.status, 409);
    },
  );
  await check(
    "invalid incident transition and premature closure blocked",
    async () => {
      assert.equal(
        (
          await mutate("coordinator", "patch", `/incidents/${incidentId}`, {
            status: "closed",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await mutate("coordinator", "patch", `/incidents/${incidentId}`, {
            status: "active",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await mutate("coordinator", "patch", `/incidents/${incidentId}`, {
            status: "controlled",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await mutate("coordinator", "patch", `/incidents/${incidentId}`, {
            status: "resolved",
          })
        ).status,
        409,
      );
    },
  );
  await check(
    "team assignment enforces conflicts and grants scoped field access",
    async () => {
      const r = await mutate("coordinator", "post", "/teams", {
        name: "Integration rescue unit",
        type_id: teamType,
        lead_id: actors.field_officer.id,
        member_ids: [],
        contact: "Internal test contact",
        status: "operational",
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      teamId = r.body.data.id;
      const assignment = await mutate(
        "coordinator",
        "post",
        `/incidents/${incidentId}/team-assignments`,
        { team_id: teamId },
      );
      assert.equal(assignment.status, 201, JSON.stringify(assignment.body));
      assert.equal(
        (
          await mutate(
            "coordinator",
            "post",
            `/incidents/${incidentId}/team-assignments`,
            { team_id: teamId },
          )
        ).status,
        409,
      );
      assert.equal(
        (await actors.field_officer.agent.get(`/api/incidents/${incidentId}`))
          .status,
        200,
      );
      assert.equal(
        (
          await mutate(
            "field_officer",
            "patch",
            `/team-assignments/${assignment.body.data.id}`,
            { status: "responding" },
          )
        ).status,
        200,
      );
    },
  );
  await check(
    "invitation activation has no client role selection and is single-use",
    async () => {
      const invite = await mutate("administrator", "post", "/users", {
        email: "invited@ercs.test",
        role: "viewer",
      });
      assert.equal(invite.status, 201, JSON.stringify(invite.body));
      const agent = request.agent(app);
      const token = (await agent.get("/api/auth/csrf")).body.data.token;
      const body = {
        token: invite.body.data.token,
        email: "invited@ercs.test",
        name: "Invited operator",
        password: testPassword,
      };
      const activate = (b: object) =>
        agent
          .post("/api/auth/activate")
          .set("Origin", process.env.APP_ORIGIN!)
          .set("X-CSRF-Token", token)
          .send(b);
      assert.equal(
        (await activate({ ...body, role: "administrator" })).status,
        400,
      );
      assert.equal((await activate(body)).status, 201);
      assert.equal((await activate(body)).status, 400);
    },
  );
  await check("last administrator and sensitive read protections", async () => {
    const r = await mutate(
      "administrator",
      "patch",
      `/users/${actors.administrator.id}`,
      { name: "Admin", role: "viewer", active: true },
    );
    assert.equal(r.status, 409);
    const users = (await actors.administrator.agent.get("/api/users")).body
      .data;
    assert.ok(users.every((u: object) => !("password_hash" in u)));
    assert.equal(
      (await actors.viewer.agent.get("/api/audit-logs")).status,
      403,
    );
  });
  await check(
    "real dashboard queries, shortages, filtering and audit reads",
    async () => {
      const r = await actors.coordinator.agent.get(
        "/api/dashboard/summary?days=7",
      );
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.data.counts.active_incidents, 1);
      assert.equal(r.body.data.trends.length, 7);
      assert.equal(
        (await actors.coordinator.agent.get("/api/incidents?status=open")).body
          .meta.total,
        r.body.data.counts.active_incidents,
      );
      assert.equal(
        (
          await actors.coordinator.agent.get(
            "/api/resource-requests?status=awaiting_review",
          )
        ).body.meta.total,
        r.body.data.counts.pending_requests,
      );
      assert.equal(
        (await actors.coordinator.agent.get("/api/shortages")).status,
        200,
      );
      assert.equal(
        (await actors.coordinator.agent.get("/api/incidents?q=nonexistent"))
          .body.meta.total,
        0,
      );
      assert.ok(
        (await actors.administrator.agent.get("/api/audit-logs")).body.meta
          .total > 10,
      );
    },
  );
  await check(
    "workspace summaries derive complete authorized counts and real distributions",
    async () => {
      for (const module of [
        "incidents",
        "resources",
        "resource-requests",
        "allocations",
        "teams",
      ]) {
        const response = await actors.coordinator.agent.get(
          `/api/${module}/summary`,
        );
        assert.equal(response.status, 200, JSON.stringify(response.body));
        assert.ok(response.body.data.counts.total > 0);
        assert.ok(response.body.data.distribution.length > 0);
        assert.ok(response.body.data.secondary.length > 0);
      }
      const allocations = (
        await actors.coordinator.agent.get("/api/allocations/summary")
      ).body.data;
      assert.equal(allocations.counts.outstanding_quantity, 5);
      assert.equal(allocations.activity.length, 14);
      assert.equal(
        allocations.activity.reduce(
          (n: number, p: { quantity: number }) => n + p.quantity,
          0,
        ),
        7,
      );
      assert.equal(
        allocations.activity.reduce(
          (n: number, p: { released: number }) => n + p.released,
          0,
        ),
        2,
      );
      const teams = (await actors.coordinator.agent.get("/api/teams/summary"))
        .body.data;
      assert.equal(teams.counts.deployed, 1);
      assert.equal(teams.counts.available, 0);
      const unrelated = (
        await pool.query(
          "INSERT INTO incidents(title,category_id,description,severity,priority,location,reporter_id) VALUES('Unrelated fixture',$1,'Restricted fixture','high','high','Other district',$2) RETURNING id",
          [incidentCategory, actors.coordinator.id],
        )
      ).rows[0];
      const fieldSummary = await actors.field_officer.agent.get(
        "/api/incidents/summary",
      );
      assert.equal(fieldSummary.body.data.counts.total, 1);
      await pool.query("DELETE FROM incidents WHERE id=$1", [unrelated.id]);
    },
  );
  await check(
    "module-specific filters, assignment columns, date validation, and pagination",
    async () => {
      const list = async (path: string) => {
        const r = await actors.coordinator.agent.get(`/api/${path}`);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        return r.body;
      };
      assert.equal(
        (await list(`incidents?severity=high&team_id=${teamId}`)).data[0]
          .assigned_team,
        "Integration rescue unit",
      );
      assert.equal((await list("incidents?severity=low")).meta.total, 0);
      assert.equal(
        (await list("incidents?from=2000-01-01&to=2000-01-02")).meta.total,
        0,
      );
      assert.equal(
        (
          await actors.coordinator.agent.get(
            "/api/incidents?from=2026-02-01&to=2026-01-01",
          )
        ).status,
        400,
      );
      assert.equal(
        (await list("resources?availability=available&low_stock=false")).meta
          .total,
        1,
      );
      assert.equal((await list("resources?low_stock=true")).meta.total, 0);
      assert.equal(
        (
          await list(
            `resource-requests?requester_id=${actors.coordinator.id}&category_id=${resourceCategory}`,
          )
        ).meta.total,
        1,
      );
      assert.equal(
        (await list(`resource-requests?requester_id=${actors.viewer.id}`)).meta
          .total,
        0,
      );
      const allocations = await list(
        `allocations?resource_id=${resourceId}&responsible_id=${actors.resource_manager.id}&request_id=${requestId}&pageSize=1`,
      );
      assert.equal(allocations.meta.total, 2);
      assert.equal(allocations.data.length, 1);
      assert.equal(allocations.data[0].incident_id, incidentId);
      const next = await list(
        `allocations?resource_id=${resourceId}&pageSize=1&page=2`,
      );
      assert.notEqual(next.data[0].id, allocations.data[0].id);
      const teams = await list(
        `teams?availability=deployed&type_id=${teamType}&lead_id=${actors.field_officer.id}&incident_id=${incidentId}`,
      );
      assert.equal(teams.meta.total, 1);
      assert.equal(teams.data[0].member_count, 1);
      assert.equal(teams.data[0].incident_id, incidentId);
      assert.equal((await list("teams?availability=available")).meta.total, 0);
      assert.equal((await list("incidents?status=completed")).meta.total, 0);
      assert.equal(
        (await list("allocations?status=partially_fulfilled")).meta.total,
        2,
      );
      assert.equal((await list("allocations?status=completed")).meta.total, 0);
      const directory = await actors.field_officer.agent.get(
        "/api/directory/people?q=coordinator&limit=1",
      );
      assert.equal(directory.status, 200, JSON.stringify(directory.body));
      assert.equal(directory.body.data.length, 1);
      assert.deepEqual(Object.keys(directory.body.data[0]).sort(), [
        "id",
        "name",
      ]);
      assert.equal(directory.body.data[0].name, "coordinator");
      assert.equal(
        (await actors.field_officer.agent.get("/api/people")).status,
        403,
      );
    },
  );
  await check(
    "stock adjustments are atomic, audited, validated, and permission controlled",
    async () => {
      assert.equal(
        (
          await mutate(
            "viewer",
            "post",
            `/resources/${resourceId}/adjustments`,
            { quantity_delta: 1, reason: "Unauthorized adjustment" },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await mutate(
            "resource_manager",
            "post",
            `/resources/${resourceId}/adjustments`,
            { quantity_delta: -6, reason: "Would consume allocated stock" },
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await mutate(
            "resource_manager",
            "post",
            `/resources/${resourceId}/adjustments`,
            { quantity_delta: 0, reason: "No change" },
          )
        ).status,
        400,
      );
      const r = await mutate(
        "resource_manager",
        "post",
        `/resources/${resourceId}/adjustments`,
        { quantity_delta: 4, reason: "Warehouse replenishment" },
      );
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.data.total_quantity, 14);
      assert.equal(r.body.data.available_quantity, 9);
      const details = (
        await actors.coordinator.agent.get(`/api/resources/${resourceId}`)
      ).body.details;
      assert.equal(details.movements[0].actor, "resource_manager");
      assert.equal(details.movements[0].quantity_delta, 4);
      assert.equal(details.allocations.length, 2);
      assert.ok(
        details.history.some(
          (h: { action: string }) => h.action === "stock_adjusted",
        ),
      );
      assert.equal(
        (
          await mutate(
            "resource_manager",
            "post",
            `/resources/${resourceId}/adjustments`,
            { quantity_delta: -4, reason: "Restore fixture stock" },
          )
        ).status,
        200,
      );
      const team = (await actors.coordinator.agent.get(`/api/teams/${teamId}`))
        .body;
      assert.ok(
        team.details.history.some(
          (h: { action: string }) => h.action === "team_assigned",
        ),
      );
      const allocation = (
        await actors.coordinator.agent.get(`/api/allocations/${allocationId}`)
      ).body;
      assert.ok(
        allocation.details.history.some(
          (h: { action: string }) => h.action === "resources_released",
        ),
      );
    },
  );
  await check(
    "pending requests support authorized edits and become immutable under review",
    async () => {
      const payload = {
        incident_id: incidentId,
        resource_id: resourceId,
        category_id: null,
        quantity: 2,
        priority: "high",
        justification: "Pending request amendment fixture",
      };
      const request = await mutate(
        "field_officer",
        "post",
        "/resource-requests",
        payload,
      );
      assert.equal(request.status, 201, JSON.stringify(request.body));
      const id = request.body.data.id;
      assert.equal(
        (
          await mutate(
            "resource_manager",
            "patch",
            `/resource-requests/${id}`,
            payload,
          )
        ).status,
        403,
      );
      const edit = await mutate(
        "field_officer",
        "patch",
        `/resource-requests/${id}`,
        { ...payload, quantity: 3 },
      );
      assert.equal(edit.status, 200, JSON.stringify(edit.body));
      assert.equal(edit.body.data.quantity, 3);
      assert.equal(
        (
          await mutate(
            "coordinator",
            "patch",
            `/resource-requests/${id}/status`,
            { status: "under_review" },
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await mutate(
            "field_officer",
            "patch",
            `/resource-requests/${id}`,
            payload,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await mutate(
            "coordinator",
            "patch",
            `/resource-requests/${id}/status`,
            { status: "cancelled" },
          )
        ).status,
        200,
      );
    },
  );
  await check("deactivation revokes existing sessions", async () => {
    const r = await mutate(
      "administrator",
      "patch",
      `/users/${actors.viewer.id}`,
      { name: "Viewer", role: "viewer", active: false },
    );
    assert.equal(r.status, 200);
    assert.equal((await actors.viewer.agent.get("/api/auth/me")).status, 401);
  });
  await check(
    "different requests cannot overdraw the same resource and failed work rolls back",
    async () => {
      const { allocate, release } =
        await import("../backend/src/modules/allocations.js");
      const user = {
        id: actors.resource_manager.id,
        name: "RM",
        email: "rm@ercs.test",
        role: "resource_manager" as const,
        active: true,
      };
      const resource = (
        await mutate("resource_manager", "post", "/resources", {
          name: "Concurrency rescue packs",
          category_id: resourceCategory,
          description: "Dedicated concurrency stock",
          kind: "stock",
          total_quantity: 5,
          status: "operational",
          location: "Test depot",
          threshold: 1,
        })
      ).body.data;
      const ids: string[] = [];
      for (let i = 0; i < 2; i++) {
        const r = await mutate("coordinator", "post", "/resource-requests", {
          incident_id: incidentId,
          resource_id: resource.id,
          category_id: null,
          quantity: 4,
          priority: "high",
          justification: "Concurrent request for limited stock",
        });
        assert.equal(r.status, 201);
        ids.push(r.body.data.id);
        assert.equal(
          (
            await mutate(
              "coordinator",
              "patch",
              `/resource-requests/${r.body.data.id}/status`,
              { status: "under_review" },
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await mutate(
              "coordinator",
              "patch",
              `/resource-requests/${r.body.data.id}/status`,
              { status: "approved" },
            )
          ).status,
          200,
        );
      }
      const outcomes = await Promise.allSettled(
        ids.map((request_id) =>
          allocate(
            user,
            { request_id, resource_id: resource.id, quantity: 4 },
            randomUUID(),
          ),
        ),
      );
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(outcomes.filter((r) => r.status === "rejected").length, 1);
      const allocations = (
        await pool.query("SELECT * FROM allocations WHERE resource_id=$1", [
          resource.id,
        ])
      ).rows;
      assert.equal(allocations.length, 1);
      assert.equal(
        (
          await pool.query(
            "SELECT available_quantity FROM resources WHERE id=$1",
            [resource.id],
          )
        ).rows[0].available_quantity,
        1,
      );
      const requestRows = (
        await pool.query(
          "SELECT issued_quantity FROM resource_requests WHERE id=ANY($1::uuid[]) ORDER BY issued_quantity",
          [ids],
        )
      ).rows;
      assert.deepEqual(
        requestRows.map((r) => r.issued_quantity),
        [0, 4],
      );
      const returns = await Promise.allSettled([
        release(
          user,
          allocations[0].id,
          { quantity: 3, reason: "Concurrent operational return" },
          randomUUID(),
        ),
        release(
          user,
          allocations[0].id,
          { quantity: 3, reason: "Concurrent operational return" },
          randomUUID(),
        ),
      ]);
      assert.equal(returns.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(returns.filter((r) => r.status === "rejected").length, 1);
      assert.equal(
        (
          await pool.query(
            "SELECT available_quantity FROM resources WHERE id=$1",
            [resource.id],
          )
        ).rows[0].available_quantity,
        4,
      );
    },
  );
  await check(
    "concurrent duplicate keys issue only once and ledgers reconcile",
    async () => {
      const { allocate } =
        await import("../backend/src/modules/allocations.js");
      const user = {
        id: actors.resource_manager.id,
        name: "RM",
        email: "rm@ercs.test",
        role: "resource_manager" as const,
        active: true,
      };
      const key = randomUUID();
      const input = {
        request_id: requestId,
        resource_id: resourceId,
        quantity: 1,
      };
      const results = (await Promise.all([
        allocate(user, input, key),
        allocate(user, input, key),
      ])) as { id: string }[];
      assert.equal(results[0].id, results[1].id);
      const mismatch = (
        await pool.query(
          "SELECT s.id FROM resources s WHERE s.allocated_quantity<>(SELECT COALESCE(sum(a.quantity-a.released_quantity),0) FROM allocations a WHERE a.resource_id=s.id) OR s.available_quantity<>(SELECT COALESCE(sum(m.quantity_delta),0) FROM inventory_movements m WHERE m.resource_id=s.id)",
        )
      ).rows;
      assert.equal(mismatch.length, 0);
    },
  );
  await check(
    "rejection requires reason and field officer can cancel own pending request",
    async () => {
      const r = await mutate("field_officer", "post", "/resource-requests", {
        incident_id: incidentId,
        resource_id: resourceId,
        category_id: null,
        quantity: 1,
        priority: "medium",
        justification: "Field operational request",
      });
      assert.equal(r.status, 201);
      assert.equal(
        (
          await mutate(
            "field_officer",
            "patch",
            `/resource-requests/${r.body.data.id}/status`,
            { status: "cancelled" },
          )
        ).status,
        200,
      );
      const other = await mutate("coordinator", "post", "/resource-requests", {
        incident_id: incidentId,
        resource_id: resourceId,
        category_id: null,
        quantity: 1,
        priority: "low",
        justification: "Request to review and reject",
      });
      assert.equal(other.status, 201);
      await mutate(
        "coordinator",
        "patch",
        `/resource-requests/${other.body.data.id}/status`,
        { status: "under_review" },
      );
      assert.equal(
        (
          await mutate(
            "coordinator",
            "patch",
            `/resource-requests/${other.body.data.id}/status`,
            { status: "rejected" },
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await mutate(
            "coordinator",
            "patch",
            `/resource-requests/${other.body.data.id}/status`,
            { status: "rejected", reason: "No operational need after review." },
          )
        ).status,
        200,
      );
    },
  );
  await check("expired PostgreSQL sessions are rejected", async () => {
    await pool.query(
      "UPDATE session SET expire=now()-interval '1 minute' WHERE sess->>'userId'=$1",
      [actors.resource_manager.id],
    );
    assert.equal(
      (await actors.resource_manager.agent.get("/api/auth/me")).status,
      401,
    );
  });
  await check(
    "password change revokes session and logout removes session",
    async () => {
      assert.equal(
        (
          await mutate("field_officer", "post", "/auth/change-password", {
            current_password: testPassword,
            password: "ChangedPassword123!",
          })
        ).status,
        200,
      );
      assert.equal(
        (await actors.field_officer.agent.get("/api/auth/me")).status,
        401,
      );
      assert.equal(
        (await mutate("coordinator", "post", "/auth/logout", {})).status,
        200,
      );
      assert.equal(
        (await actors.coordinator.agent.get("/api/auth/me")).status,
        401,
      );
    },
  );
  console.log(`${completed} PostgreSQL integration checks passed.`);
} catch (error) {
  console.error("Integration suite failed:", error);
  process.exitCode = 1;
} finally {
  if (closePool) await closePool();
  if (embedded && databaseStarted) await embedded.stop();
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
