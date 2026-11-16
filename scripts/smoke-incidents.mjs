import assert from "node:assert/strict";
const base = new URL(process.env.ERCS_API_URL ?? "http://127.0.0.1:8080/api/");
if (process.env.ERCS_TEST_MUTATIONS !== "1" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
  throw new Error("Use a disposable loopback database/API and explicitly set ERCS_TEST_MUTATIONS=1.");
}
async function call(resource, method = "GET", body) {
  return fetch(new URL(resource, base), { method, headers: body ? {"Content-Type":"application/json"} : undefined, body: body ? JSON.stringify(body) : undefined });
}
let id;
try {
  assert.equal((await call("health")).status, 200);
  assert.equal((await call("db-health")).status, 200);
  const list = await call("incidents");
  assert.equal(list.status, 200);
  assert.ok(Array.isArray((await list.json()).incidents));
  const invalid = await call("incidents", "POST", {});
  assert.equal(invalid.status, 400);
  assert.ok(Array.isArray((await invalid.json()).errors));
  const created = await call("incidents", "POST", {
    title: "Disposable integration incident " + Date.now(),
    description: "Actual teammate API contract verification.",
    incident_type: "integration-test", severity: "medium", status: "reported",
    location: "Disposable local verification database", latitude: 6.9271, longitude: 79.8612,
  });
  assert.equal(created.status, 201);
  const record = (await created.json()).incident;
  id = record.id;
  assert.ok(Number.isInteger(Number(id)));
  const read = await call("incidents/" + id);
  assert.equal(read.status, 200);
  assert.equal(String((await read.json()).incident.id), String(id));
  const patched = await call("incidents/" + id, "PATCH", {status:"responding"});
  assert.equal(patched.status, 200);
  assert.equal((await patched.json()).incident.status, "responding");
  const deleted = await call("incidents/" + id, "DELETE");
  assert.equal(deleted.status, 204);
  assert.equal((await call("incidents/" + id)).status, 404);
  id = undefined;
  assert.equal((await call("auth/me")).status, 404);
  assert.equal((await call("auth/csrf")).status, 404);
  console.log("PASS: real API health, PostgreSQL health, incident validation/list/create/read/update/delete, and missing auth endpoints.");
} finally {
  if (id !== undefined) await call("incidents/" + id, "DELETE");
}
