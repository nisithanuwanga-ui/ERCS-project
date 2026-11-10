import { Router } from "express";
import { z } from "zod";
import { can, validRequestTransition } from "../../../shared/domain.js";
import { audit, history, transaction } from "../database.js";
import { HttpError, permit, requireIncident, userOf } from "../security.js";
import { idSchema, requestSchema } from "../validation.js";
import { activeReference } from "./references.js";

export const router = Router();
router.post(
  "/resource-requests",
  permit("requests.create"),
  async (req, res) => {
    const v = requestSchema.parse(req.body);
    const row = await transaction(async (db) => {
      const incident = await requireIncident(
        db,
        v.incident_id,
        userOf(req),
        true,
      );
      if (["resolved", "closed"].includes(incident.status))
        throw new HttpError(409, "This incident no longer accepts requests.");
      if (
        v.resource_id &&
        !(
          await db.query("SELECT id FROM resources WHERE id=$1", [
            v.resource_id,
          ])
        ).rowCount
      )
        throw new HttpError(400, "Resource not found.");
      if (v.category_id)
        await activeReference(db, v.category_id, "resource_category");
      const item = (
        await db.query(
          "INSERT INTO resource_requests(incident_id,resource_id,category_id,quantity,priority,justification,requester_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
          [
            v.incident_id,
            v.resource_id ?? null,
            v.category_id ?? null,
            v.quantity,
            v.priority,
            v.justification,
            userOf(req).id,
          ],
        )
      ).rows[0];
      await history(
        db,
        userOf(req).id,
        "resource-requests",
        item.id,
        null,
        "pending",
      );
      await audit(
        db,
        userOf(req).id,
        "request.created",
        "resource-requests",
        item.id,
      );
      return item;
    });
    res.status(201).json({ data: row });
  },
);
router.patch("/resource-requests/:id/status", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const v = z
    .object({
      status: z.enum(["under_review", "approved", "rejected", "cancelled"]),
      reason: z.string().trim().max(1000).default(""),
    })
    .strict()
    .parse(req.body);
  const user = userOf(req);
  const row = await transaction(async (db) => {
    const link = (
      await db.query("SELECT incident_id FROM resource_requests WHERE id=$1", [
        id,
      ])
    ).rows[0];
    if (!link) throw new HttpError(404, "Request not found.");
    await requireIncident(db, link.incident_id, user, true);
    const previous = (
      await db.query("SELECT * FROM resource_requests WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    const reviewer = can(user.role, "requests.review");
    if (
      !reviewer &&
      !(
        v.status === "cancelled" &&
        previous.status === "pending" &&
        previous.requester_id === user.id
      )
    )
      throw new HttpError(403, "You cannot make this request decision.");
    if (!validRequestTransition(previous.status, v.status))
      throw new HttpError(409, "Invalid request status transition.");
    if (v.status === "rejected" && v.reason.length < 3)
      throw new HttpError(400, "Provide a rejection reason.");
    const item = (
      await db.query(
        "UPDATE resource_requests SET status=$1,reviewer_id=$2,decision_reason=$3,reviewed_at=now(),updated_at=now() WHERE id=$4 RETURNING *",
        [v.status, user.id, v.reason, id],
      )
    ).rows[0];
    await history(
      db,
      user.id,
      "resource-requests",
      id,
      previous.status,
      v.status,
      v.reason,
    );
    await audit(db, user.id, "request.decision", "resource-requests", id, v);
    return item;
  });
  res.json({ data: row });
});
