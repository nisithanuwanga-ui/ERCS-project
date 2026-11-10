import { Router } from "express";
import { z } from "zod";
import { can } from "../../../shared/domain.js";
import type { User } from "../../../shared/domain.js";
import { audit, pool, transaction } from "../database.js";
import { HttpError, permit, requireIncident, userOf } from "../security.js";
import { idSchema, teamSchema } from "../validation.js";
import { activeReference } from "./references.js";

export const router = Router();
async function saveTeam(input: unknown, user: User, id?: string) {
  const v = teamSchema.parse(input);
  await activeReference(pool, v.type_id, "team_type");
  return transaction(async (db) => {
    if (id) {
      await db.query("SELECT id FROM response_teams WHERE id=$1 FOR UPDATE", [
        id,
      ]);
      if (
        v.status === "unavailable" &&
        (
          await db.query(
            "SELECT id FROM team_assignments WHERE team_id=$1 AND status NOT IN ('completed','cancelled')",
            [id],
          )
        ).rowCount
      )
        throw new HttpError(
          409,
          "Complete the active assignment before making this team unavailable.",
        );
    }
    const people = [...new Set([v.lead_id, ...v.member_ids])];
    const valid = (
      await db.query(
        "SELECT id FROM users WHERE id=ANY($1::uuid[]) AND active",
        [people],
      )
    ).rowCount;
    if (valid !== people.length)
      throw new HttpError(400, "Team members must be active authorized users.");
    const params = [v.name, v.type_id, v.lead_id, v.contact, v.status];
    const item = (
      await db.query(
        id
          ? "UPDATE response_teams SET name=$1,type_id=$2,lead_id=$3,contact=$4,status=$5,updated_at=now() WHERE id=$6 RETURNING *"
          : "INSERT INTO response_teams(name,type_id,lead_id,contact,status) VALUES($1,$2,$3,$4,$5) RETURNING *",
        id ? [...params, id] : params,
      )
    ).rows[0];
    if (!item) throw new HttpError(404, "Team not found.");
    await db.query("DELETE FROM team_members WHERE team_id=$1", [item.id]);
    for (const person of people)
      await db.query(
        "INSERT INTO team_members(team_id,user_id) VALUES($1,$2)",
        [item.id, person],
      );
    await audit(
      db,
      user.id,
      id ? "team.updated" : "team.created",
      "teams",
      item.id,
    );
    return item;
  });
}
router.post("/teams", permit("teams.manage"), async (req, res) =>
  res.status(201).json({ data: await saveTeam(req.body, userOf(req)) }),
);
router.patch("/teams/:id", permit("teams.manage"), async (req, res) =>
  res.json({
    data: await saveTeam(req.body, userOf(req), idSchema.parse(req.params.id)),
  }),
);
router.post(
  "/incidents/:id/team-assignments",
  permit("teams.manage"),
  async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const v = z.object({ team_id: idSchema }).strict().parse(req.body);
    const row = await transaction(async (db) => {
      const incident = await requireIncident(db, id, userOf(req), true);
      if (["resolved", "closed"].includes(incident.status))
        throw new HttpError(409, "Incident no longer accepts assignments.");
      const team = (
        await db.query("SELECT * FROM response_teams WHERE id=$1 FOR UPDATE", [
          v.team_id,
        ])
      ).rows[0];
      if (!team || team.status !== "operational")
        throw new HttpError(409, "Team is unavailable.");
      if (
        (
          await db.query(
            "SELECT id FROM team_assignments WHERE team_id=$1 AND status NOT IN ('completed','cancelled')",
            [v.team_id],
          )
        ).rowCount
      )
        throw new HttpError(409, "Team already has an active assignment.");
      const item = (
        await db.query(
          "INSERT INTO team_assignments(team_id,incident_id,assigned_by) VALUES($1,$2,$3) RETURNING *",
          [v.team_id, id, userOf(req).id],
        )
      ).rows[0];
      await audit(
        db,
        userOf(req).id,
        "team.assigned",
        "team_assignments",
        item.id,
        { incident_id: id },
      );
      return item;
    });
    res.status(201).json({ data: row });
  },
);
router.patch("/team-assignments/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const v = z
    .object({
      status: z.enum(["responding", "on_scene", "completed", "cancelled"]),
    })
    .strict()
    .parse(req.body);
  const user = userOf(req);
  const row = await transaction(async (db) => {
    const link = (
      await db.query("SELECT * FROM team_assignments WHERE id=$1", [id])
    ).rows[0];
    if (!link) throw new HttpError(404, "Assignment not found.");
    await requireIncident(db, link.incident_id, user, true);
    const team = (
      await db.query("SELECT * FROM response_teams WHERE id=$1 FOR UPDATE", [
        link.team_id,
      ])
    ).rows[0];
    const previous = (
      await db.query("SELECT * FROM team_assignments WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    const own =
      team.lead_id === user.id ||
      Boolean(
        (
          await db.query(
            "SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2",
            [team.id, user.id],
          )
        ).rowCount,
      );
    if (
      !can(user.role, "teams.manage") &&
      !(user.role === "field_officer" && own && v.status !== "cancelled")
    )
      throw new HttpError(403, "Assignment update not permitted.");
    const states = ["assigned", "responding", "on_scene", "completed"];
    if (
      ["completed", "cancelled"].includes(previous.status) ||
      (v.status !== "cancelled" &&
        states.indexOf(v.status) !== states.indexOf(previous.status) + 1)
    )
      throw new HttpError(409, "Invalid assignment transition.");
    const item = (
      await db.query(
        "UPDATE team_assignments SET status=$1,ended_at=CASE WHEN $1 IN ('completed','cancelled') THEN now() ELSE NULL END WHERE id=$2 RETURNING *",
        [v.status, id],
      )
    ).rows[0];
    await audit(
      db,
      user.id,
      "team.assignment_updated",
      "team_assignments",
      id,
      v,
    );
    return item;
  });
  res.json({ data: row });
});
