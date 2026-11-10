import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config } from "../backend/src/config.js";
import { pool } from "../backend/src/database.js";
import { dashboardSummary } from "../backend/src/modules/dashboard-service.js";
import type { User } from "../shared/domain.js";

const url = new URL(config.DATABASE_URL);
if (
  config.NODE_ENV === "production" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
)
  throw new Error(
    "Dashboard checks require a local development/test PostgreSQL database.",
  );
const db = await pool.connect();
try {
  await db.query("BEGIN");
  const schema = `dashboard_test_${randomUUID().replaceAll("-", "")}`;
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.query(`SET LOCAL search_path TO "${schema}", public`);
  await db.query(
    await readFile(
      new URL("../backend/migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  const users: Record<string, User> = {};
  for (const role of ["coordinator", "field_officer", "viewer"] as const) {
    users[role] = (
      await db.query(
        "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,'test-only-not-a-login-hash',$3) RETURNING id,name,email,role,active",
        [role, `${role}@dashboard.test`, role],
      )
    ).rows[0];
  }
  const incidentCategory = (
    await db.query(
      "SELECT id FROM reference_data WHERE kind='incident_category' LIMIT 1",
    )
  ).rows[0].id;
  const resourceCategory = (
    await db.query(
      "SELECT id FROM reference_data WHERE kind='resource_category' LIMIT 1",
    )
  ).rows[0].id;
  const teamType = (
    await db.query(
      "SELECT id FROM reference_data WHERE kind='team_type' LIMIT 1",
    )
  ).rows[0].id;
  const incidents: string[] = [];
  for (const title of [
    "Assigned district response",
    "Restricted district response",
  ]) {
    incidents.push(
      (
        await db.query(
          "INSERT INTO incidents(title,category_id,description,severity,priority,location,reporter_id) VALUES($1,$2,'Dashboard test incident','high','high','Test district',$3) RETURNING id",
          [title, incidentCategory, users.coordinator.id],
        )
      ).rows[0].id,
    );
  }
  const resource = (
    await db.query(
      "INSERT INTO resources(name,category_id,description,kind,total_quantity,allocated_quantity,status,location,threshold) VALUES('Operational packs',$1,'Test stock','stock',10,3,'operational','Test depot',1) RETURNING id",
      [resourceCategory],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO resources(name,category_id,description,kind,total_quantity,status,location,threshold) VALUES('Maintenance packs',$1,'Test stock','stock',4,'maintenance','Test depot',0)",
    [resourceCategory],
  );
  const requests: string[] = [];
  for (const data of [
    {
      incident: 0,
      status: "pending",
      quantity: 2,
      issued: 0,
      priority: "high",
      category: false,
    },
    {
      incident: 0,
      status: "approved",
      quantity: 12,
      issued: 3,
      priority: "high",
      category: false,
    },
    {
      incident: 0,
      status: "approved",
      quantity: 5,
      issued: 0,
      priority: "medium",
      category: true,
    },
    {
      incident: 1,
      status: "pending",
      quantity: 50,
      issued: 0,
      priority: "critical",
      category: false,
    },
    {
      incident: 1,
      status: "approved",
      quantity: 100,
      issued: 0,
      priority: "critical",
      category: false,
    },
  ]) {
    requests.push(
      (
        await db.query(
          "INSERT INTO resource_requests(incident_id,resource_id,category_id,quantity,issued_quantity,priority,justification,requester_id,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
          [
            incidents[data.incident],
            data.category ? null : resource,
            data.category ? resourceCategory : null,
            data.quantity,
            data.issued,
            data.priority,
            "Dashboard operational test",
            users.coordinator.id,
            data.status,
          ],
        )
      ).rows[0].id,
    );
  }
  await db.query(
    "INSERT INTO allocations(request_id,resource_id,quantity,responsible_id) VALUES($1,$2,3,$3)",
    [requests[1], resource, users.coordinator.id],
  );
  const fieldTeam = (
    await db.query(
      "INSERT INTO response_teams(name,type_id,lead_id,status) VALUES('Assigned response team',$1,$2,'operational') RETURNING id",
      [teamType, users.field_officer.id],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO response_teams(name,type_id,lead_id,status) VALUES('Other response team',$1,$2,'operational')",
    [teamType, users.viewer.id],
  );
  await db.query(
    "INSERT INTO team_assignments(team_id,incident_id,assigned_by) VALUES($1,$2,$3)",
    [fieldTeam, incidents[0], users.coordinator.id],
  );
  const coordinator = await dashboardSummary(db, users.coordinator, 7),
    field = await dashboardSummary(db, users.field_officer, 7);
  assert.equal(coordinator.counts.active_incidents, 2);
  assert.equal(field.counts.active_incidents, 1);
  assert.equal(coordinator.counts.pending_requests, 2);
  assert.equal(field.counts.pending_requests, 1);
  assert.equal(field.trends.length, 7);
  assert.equal(
    field.trends.reduce((sum, r) => sum + r.incidents, 0),
    1,
  );
  assert.equal(
    field.requestPriority.reduce((sum, r) => sum + r.value, 0),
    3,
  );
  assert.ok(!field.requestPriority.some((r) => r.name === "critical"));
  assert.equal(field.urgentRequests.length, 1);
  assert.equal(field.urgentRequests[0].priority, "high");
  assert.deepEqual(field.resourceAvailability, [
    { name: "Available", value: 7 },
    { name: "Allocated", value: 3 },
    { name: "Unavailable", value: 4 },
  ]);
  assert.equal(field.allocationActivity.length, 7);
  assert.equal(
    field.allocationActivity.reduce((sum, r) => sum + r.quantity, 0),
    3,
  );
  assert.equal(field.counts.active_teams, 1);
  assert.equal(field.counts.available_teams, 0);
  assert.equal(field.teamAvailability[0].deployed, 1);
  assert.equal(field.teamAvailability[0].available, 0);
  const shortage = field.shortageCategories.find(
    (r) => r.id === resourceCategory,
  );
  assert.equal(shortage?.demand, 14);
  assert.equal(shortage?.available, 7);
  assert.equal(shortage?.shortage, 7);
  const alert = field.resourceAlerts.find((r) => r.id === resource);
  assert.equal(alert?.shortage, 2);
  assert.equal(field.counts.shortages, 2);
  assert.ok(Number.isFinite(Date.parse(field.generatedAt)));
  const fewerDays = await dashboardSummary(db, users.field_officer, 30);
  assert.equal(fewerDays.trends.length, 30);
  assert.equal(fewerDays.allocationActivity.length, 30);
  console.log(
    "PASS dashboard aggregates: all six chart datasets, 7/30-day ranges, inventory conservation, direct/category demand, alerts and field-officer scope.",
  );
} finally {
  await db.query("ROLLBACK");
  db.release();
  await pool.end();
}
