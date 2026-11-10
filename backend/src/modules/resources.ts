import { Router } from "express";
import { audit, pool, transaction } from "../database.js";
import { HttpError, permit, userOf } from "../security.js";
import { idSchema, resourceSchema } from "../validation.js";
import { activeReference } from "./references.js";

export const router = Router();
router.post("/resources", permit("resources.manage"), async (req, res) => {
  const v = resourceSchema.parse(req.body);
  await activeReference(pool, v.category_id, "resource_category");
  const row = await transaction(async (db) => {
    const entries = Object.entries(v);
    const item = (
      await db.query(
        `INSERT INTO resources(${entries.map(([k]) => k).join(",")}) VALUES(${entries.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
        entries.map(([, x]) => x),
      )
    ).rows[0];
    await db.query(
      "INSERT INTO inventory_movements(resource_id,quantity_delta,action,actor_id) VALUES($1,$2,'initial_stock',$3)",
      [item.id, v.total_quantity, userOf(req).id],
    );
    await audit(db, userOf(req).id, "resource.created", "resources", item.id);
    return item;
  });
  res.status(201).json({ data: row });
});
router.patch("/resources/:id", permit("resources.manage"), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const v = resourceSchema.parse(req.body);
  await activeReference(pool, v.category_id, "resource_category");
  const row = await transaction(async (db) => {
    const previous = (
      await db.query("SELECT * FROM resources WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!previous) throw new HttpError(404, "Resource not found.");
    if (v.total_quantity < previous.allocated_quantity)
      throw new HttpError(
        409,
        "Total stock cannot be less than outstanding allocations.",
      );
    if (
      v.category_id !== previous.category_id &&
      (
        await db.query(
          "SELECT id FROM resource_requests WHERE resource_id=$1 UNION ALL SELECT id FROM allocations WHERE resource_id=$1 LIMIT 1",
          [id],
        )
      ).rowCount
    )
      throw new HttpError(
        409,
        "Category is fixed once this resource has request or allocation history.",
      );
    const entries = Object.entries(v);
    const item = (
      await db.query(
        `UPDATE resources SET ${entries.map(([k], i) => `${k}=$${i + 1}`).join(",")},updated_at=now() WHERE id=$${entries.length + 1} RETURNING *`,
        [...entries.map(([, x]) => x), id],
      )
    ).rows[0];
    if (v.total_quantity !== previous.total_quantity)
      await db.query(
        "INSERT INTO inventory_movements(resource_id,quantity_delta,action,actor_id) VALUES($1,$2,'stock_adjustment',$3)",
        [id, v.total_quantity - previous.total_quantity, userOf(req).id],
      );
    await audit(db, userOf(req).id, "resource.updated", "resources", id, v);
    return item;
  });
  res.json({ data: row });
});
