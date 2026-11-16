import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { can, roles, roleLabels, grants } from "../../../shared/domain.js";
import { audit, pool, transaction } from "../database.js";
import { HttpError, permit, publicUser, userOf } from "../security.js";
import { idSchema, invitationSchema } from "../validation.js";
import { hashToken } from "./auth.js";

export const router = Router();
router.get("/reference-data", async (_req, res) =>
  res.json({
    data: (await pool.query("SELECT * FROM reference_data ORDER BY kind,name"))
      .rows,
  }),
);
// Operational filters need display names without exposing account contact or role data.
router.get("/directory/people", async (req, res) => {
  const v = z
    .object({
      q: z.string().trim().max(160).default(""),
      limit: z.coerce.number().int().min(1).max(100).default(100),
    })
    .parse(req.query);
  res.json({
    data: (
      await pool.query(
        "SELECT id,name FROM users WHERE active AND name ILIKE $1 ORDER BY name,id LIMIT $2",
        [`%${v.q}%`, v.limit],
      )
    ).rows,
  });
});
router.get("/people", async (req, res) => {
  const user = userOf(req);
  if (!can(user.role, "teams.manage") && !can(user.role, "users.manage"))
    throw new HttpError(403, "Not authorized.");
  res.json({
    data: (
      await pool.query(
        "SELECT id,name,email,role FROM users WHERE active ORDER BY name",
      )
    ).rows,
  });
});
router.get("/roles", permit("users.manage"), (_req, res) =>
  res.json({
    data: roles.map((role) => ({
      id: role,
      name: roleLabels[role],
      permissions: Object.keys(grants).filter((p) =>
        can(role, p as keyof typeof grants),
      ),
    })),
    matrix: roles.map((role) => ({
      role,
      label: roleLabels[role],
      permissions: [
        "incidents.create",
        "incidents.manage",
        "resources.manage",
        "requests.create",
        "requests.review",
        "allocations.manage",
        "teams.manage",
        "users.manage",
        "settings.manage",
        "audit.read",
      ].filter((p) => can(role, p as Parameters<typeof can>[1])),
    })),
  }),
);
router.get("/profile", (req, res) => res.json({ data: userOf(req) }));
router.patch("/profile", async (req, res) => {
  const v = z
    .object({ name: z.string().trim().min(2).max(100) })
    .strict()
    .parse(req.body);
  const user = userOf(req);
  const result = await transaction(async (db) => {
    const row = (
      await db.query(
        `UPDATE users SET name=$1,updated_at=now() WHERE id=$2 RETURNING ${publicUser}`,
        [v.name, user.id],
      )
    ).rows[0];
    await audit(db, user.id, "profile.updated", "users", user.id);
    return row;
  });
  res.json({ data: result });
});
router.post(
  "/settings/reference-data",
  permit("settings.manage"),
  async (req, res) => {
    const v = z
      .object({
        kind: z.enum(["incident_category", "resource_category", "team_type"]),
        name: z.string().trim().min(2).max(100),
      })
      .strict()
      .parse(req.body);
    const row = await transaction(async (db) => {
      const item = (
        await db.query(
          "INSERT INTO reference_data(kind,name) VALUES($1,$2) RETURNING *",
          [v.kind, v.name],
        )
      ).rows[0];
      await audit(
        db,
        userOf(req).id,
        "reference.created",
        "reference_data",
        item.id,
      );
      return item;
    });
    res.status(201).json({ data: row });
  },
);
router.patch(
  "/settings/reference-data/:id",
  permit("settings.manage"),
  async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const v = z.object({ active: z.boolean() }).strict().parse(req.body);
    const row = await transaction(async (db) => {
      const item = (
        await db.query(
          "UPDATE reference_data SET active=$1 WHERE id=$2 RETURNING *",
          [v.active, id],
        )
      ).rows[0];
      if (!item) throw new HttpError(404, "Reference not found.");
      await audit(
        db,
        userOf(req).id,
        "reference.updated",
        "reference_data",
        id,
        v,
      );
      return item;
    });
    res.json({ data: row });
  },
);

router.post("/users", permit("users.manage"), async (req, res) => {
  const v = invitationSchema.parse(req.body);
  const token = randomBytes(32).toString("hex");
  const row = await transaction(async (db) => {
    if (
      (await db.query("SELECT id FROM users WHERE email=$1", [v.email]))
        .rowCount
    )
      throw new HttpError(409, "An account already uses this email.");
    const invitation = (
      await db.query(
        "INSERT INTO invitations(email,role,token_hash,expires_at,created_by) VALUES($1,$2,$3,now()+interval '48 hours',$4) RETURNING id,email,role,expires_at",
        [v.email, v.role, hashToken(token), userOf(req).id],
      )
    ).rows[0];
    await audit(
      db,
      userOf(req).id,
      "user.invited",
      "invitations",
      invitation.id,
      { email: v.email, role: v.role },
    );
    return invitation;
  });
  res.status(201).json({ data: { ...row, token } });
});
router.patch("/users/:id", permit("users.manage"), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const v = z
    .object({
      name: z.string().trim().min(2).max(100),
      role: z.enum(roles),
      active: z.boolean(),
    })
    .strict()
    .parse(req.body);
  const row = await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(91732)");
    const previous = (
      await db.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!previous) throw new HttpError(404, "User not found.");
    if (
      previous.active &&
      previous.role === "administrator" &&
      (!v.active || v.role !== "administrator")
    ) {
      const count = (
        await db.query(
          "SELECT count(*)::int AS count FROM users WHERE active AND role='administrator'",
        )
      ).rows[0].count;
      if (count <= 1)
        throw new HttpError(
          409,
          "At least one active administrator must remain.",
        );
    }
    const item = (
      await db.query(
        `UPDATE users SET name=$1,role=$2,active=$3,session_version=session_version+1,updated_at=now() WHERE id=$4 RETURNING ${publicUser}`,
        [v.name, v.role, v.active, id],
      )
    ).rows[0];
    await audit(db, userOf(req).id, "user.updated", "users", id, {
      role: v.role,
      active: v.active,
    });
    return item;
  });
  res.json({ data: row });
});
