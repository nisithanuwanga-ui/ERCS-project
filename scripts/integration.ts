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
      assert.equal((await actors.coordinator.agent.get('/api/incidents?status=open')).body.meta.total,r.body.data.counts.active_incidents);
      assert.equal((await actors.coordinator.agent.get('/api/resource-requests?status=awaiting_review')).body.meta.total,r.body.data.counts.pending_requests);
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
  await check('different requests cannot overdraw the same resource and failed work rolls back',async()=>{
    const {allocate,release}=await import('../backend/src/modules/allocations.js');
    const user={id:actors.resource_manager.id,name:'RM',email:'rm@ercs.test',role:'resource_manager' as const,active:true};
    const resource=(await mutate('resource_manager','post','/resources',{name:'Concurrency rescue packs',category_id:resourceCategory,description:'Dedicated concurrency stock',kind:'stock',total_quantity:5,status:'operational',location:'Test depot',threshold:1})).body.data;
    const ids:string[]=[];
    for(let i=0;i<2;i++){
      const r=await mutate('coordinator','post','/resource-requests',{incident_id:incidentId,resource_id:resource.id,category_id:null,quantity:4,priority:'high',justification:'Concurrent request for limited stock'});assert.equal(r.status,201);ids.push(r.body.data.id);
      assert.equal((await mutate('coordinator','patch',`/resource-requests/${r.body.data.id}/status`,{status:'under_review'})).status,200);
      assert.equal((await mutate('coordinator','patch',`/resource-requests/${r.body.data.id}/status`,{status:'approved'})).status,200);
    }
    const outcomes=await Promise.allSettled(ids.map(request_id=>allocate(user,{request_id,resource_id:resource.id,quantity:4},randomUUID())));
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);
    const allocations=(await pool.query('SELECT * FROM allocations WHERE resource_id=$1',[resource.id])).rows;assert.equal(allocations.length,1);
    assert.equal((await pool.query('SELECT available_quantity FROM resources WHERE id=$1',[resource.id])).rows[0].available_quantity,1);
    const requestRows=(await pool.query('SELECT issued_quantity FROM resource_requests WHERE id=ANY($1::uuid[]) ORDER BY issued_quantity',[ids])).rows;assert.deepEqual(requestRows.map(r=>r.issued_quantity),[0,4]);
    const returns=await Promise.allSettled([release(user,allocations[0].id,{quantity:3,reason:'Concurrent operational return'},randomUUID()),release(user,allocations[0].id,{quantity:3,reason:'Concurrent operational return'},randomUUID())]);assert.equal(returns.filter(r=>r.status==='fulfilled').length,1);assert.equal(returns.filter(r=>r.status==='rejected').length,1);
    assert.equal((await pool.query('SELECT available_quantity FROM resources WHERE id=$1',[resource.id])).rows[0].available_quantity,4);
  });
  await check('concurrent duplicate keys issue only once and ledgers reconcile',async()=>{
    const {allocate}=await import('../backend/src/modules/allocations.js');const user={id:actors.resource_manager.id,name:'RM',email:'rm@ercs.test',role:'resource_manager' as const,active:true};const key=randomUUID();const input={request_id:requestId,resource_id:resourceId,quantity:1};
    const results=await Promise.all([allocate(user,input,key),allocate(user,input,key)]) as {id:string}[];assert.equal(results[0].id,results[1].id);
    const mismatch=(await pool.query('SELECT s.id FROM resources s WHERE s.allocated_quantity<>(SELECT COALESCE(sum(a.quantity-a.released_quantity),0) FROM allocations a WHERE a.resource_id=s.id) OR s.available_quantity<>(SELECT COALESCE(sum(m.quantity_delta),0) FROM inventory_movements m WHERE m.resource_id=s.id)')).rows;assert.equal(mismatch.length,0);
  });
  await check('rejection requires reason and field officer can cancel own pending request',async()=>{
    const r=await mutate('field_officer','post','/resource-requests',{incident_id:incidentId,resource_id:resourceId,category_id:null,quantity:1,priority:'medium',justification:'Field operational request'});assert.equal(r.status,201);
    assert.equal((await mutate('field_officer','patch',`/resource-requests/${r.body.data.id}/status`,{status:'cancelled'})).status,200);
    const other=await mutate('coordinator','post','/resource-requests',{incident_id:incidentId,resource_id:resourceId,category_id:null,quantity:1,priority:'low',justification:'Request to review and reject'});assert.equal(other.status,201);
    await mutate('coordinator','patch',`/resource-requests/${other.body.data.id}/status`,{status:'under_review'});
    assert.equal((await mutate('coordinator','patch',`/resource-requests/${other.body.data.id}/status`,{status:'rejected'})).status,400);
    assert.equal((await mutate('coordinator','patch',`/resource-requests/${other.body.data.id}/status`,{status:'rejected',reason:'No operational need after review.'})).status,200);
  });
  await check('expired PostgreSQL sessions are rejected',async()=>{
    await pool.query("UPDATE session SET expire=now()-interval '1 minute' WHERE sess->>'userId'=$1",[actors.resource_manager.id]);
    assert.equal((await actors.resource_manager.agent.get('/api/auth/me')).status,401);
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
