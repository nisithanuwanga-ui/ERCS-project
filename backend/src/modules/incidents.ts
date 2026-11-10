import { Router } from "express";
import { z } from "zod";
import { validIncidentTransition } from "../../../shared/domain.js";
import { audit, history, pool, transaction } from "../database.js";
import { HttpError, permit, requireIncident, userOf } from "../security.js";
import { idSchema, incidentSchema, incidentPatch } from "../validation.js";
import { activeReference } from "./references.js";

export const router = Router();
router.post("/incidents", permit("incidents.create"), async (req, res) => {
  const v = incidentSchema.parse(req.body);
  await activeReference(pool, v.category_id, "incident_category");
  const row = await transaction(async (db) => {
    const item = (
      await db.query(
        "INSERT INTO incidents(title,category_id,description,severity,priority,location,reporter_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          v.title,
          v.category_id,
          v.description,
          v.severity,
          v.priority,
          v.location,
          userOf(req).id,
        ],
      )
    ).rows[0];
    await history(db, userOf(req).id, "incidents", item.id, null, "reported");
    await audit(db, userOf(req).id, "incident.created", "incidents", item.id);
    return item;
  });
  res.status(201).json({ data: row });
});
router.patch("/incidents/:id", permit("incidents.manage"), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const v = incidentPatch.parse(req.body);
  if (v.category_id)
    await activeReference(pool, v.category_id, "incident_category");
  const row = await transaction(async (db) => {
    const previous = await requireIncident(db, id, userOf(req), true);
    if (v.status && !validIncidentTransition(previous.status, v.status))
      throw new HttpError(409, "Invalid incident lifecycle transition.");
    if (["resolved", "closed"].includes(v.status ?? "")) {
      const work = (
        await db.query(
          "SELECT EXISTS(SELECT 1 FROM team_assignments WHERE incident_id=$1 AND status NOT IN ('completed','cancelled')) OR EXISTS(SELECT 1 FROM resource_requests WHERE incident_id=$1 AND status NOT IN ('completed','cancelled','rejected')) OR EXISTS(SELECT 1 FROM allocations a JOIN resource_requests r ON r.id=a.request_id WHERE r.incident_id=$1 AND a.quantity>a.released_quantity) AS outstanding",
          [id],
        )
      ).rows[0];
      if (work.outstanding)
        throw new HttpError(
          409,
          "Resolve outstanding requests, allocations and team assignments first.",
        );
    }
    const entries = Object.entries(v);
    if (!entries.length) throw new HttpError(400, "No changes supplied.");
    const item = (
      await db.query(
        `UPDATE incidents SET ${entries.map(([key], i) => `${key}=$${i + 1}`).join(",")},updated_at=now() WHERE id=$${entries.length + 1} RETURNING *`,
        [...entries.map(([, value]) => value), id],
      )
    ).rows[0];
    if (v.status && v.status !== previous.status)
      await history(
        db,
        userOf(req).id,
        "incidents",
        id,
        previous.status,
        v.status,
      );
    await audit(db, userOf(req).id, "incident.updated", "incidents", id, v);
    return item;
  });
  res.json({ data: row });
});
router.post("/incidents/:id/updates", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const v = z
    .object({ note: z.string().trim().min(3).max(5000) })
    .strict()
    .parse(req.body);
  const user = userOf(req);
  if (user.role !== "coordinator" && user.role !== "field_officer")
    throw new HttpError(403, "Operational update access required.");
  await transaction(async (db) => {
    await requireIncident(db, id, user, true);
    await history(db, user.id, "incidents", id, null, null, v.note);
    await audit(db, user.id, "incident.update_added", "incidents", id);
  });
  res.status(201).json({ data: { ok: true } });
});
