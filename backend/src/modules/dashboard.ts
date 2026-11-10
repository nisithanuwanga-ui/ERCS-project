import { Router } from "express";
import { z } from "zod";
import { pool } from "../database.js";
import { incidentScope, userOf } from "../security.js";
import { dashboardSummary } from "./dashboard-service.js";
export const dashboard = Router();
dashboard.get("/dashboard/summary", async (req, res) => {
  const user = userOf(req);
  const v = z
    .object({ days: z.coerce.number().int().min(7).max(90).default(30) })
    .parse(req.query);
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data = await dashboardSummary(client, user, v.days);
    await client.query("COMMIT");
    res.json({ data });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
dashboard.get("/shortages", async (req, res) => {
  const user = userOf(req);
  const scope = incidentScope(user, "i");
  const requestWhere =
    user.role === "field_officer"
      ? `(${scope.sql} OR r.requester_id=$1)`
      : scope.sql;
  const data = (
    await pool.query(
      `WITH direct AS(SELECT r.resource_id,sum(r.quantity-r.issued_quantity)::int AS demand FROM resource_requests r JOIN incidents i ON i.id=r.incident_id WHERE ${requestWhere} AND r.status IN ('approved','partially_fulfilled') AND r.resource_id IS NOT NULL GROUP BY r.resource_id) SELECT s.*,c.name AS category,COALESCE(d.demand,0)::int AS outstanding_demand,GREATEST(0,COALESCE(d.demand,0)-CASE WHEN s.status='operational' THEN s.available_quantity ELSE 0 END)::int AS shortage FROM resources s JOIN reference_data c ON c.id=s.category_id LEFT JOIN direct d ON d.resource_id=s.id WHERE s.available_quantity<=s.threshold OR s.status<>'operational' OR COALESCE(d.demand,0)>s.available_quantity ORDER BY shortage DESC,s.name`,
      scope.params,
    )
  ).rows;
  const categories = (
    await pool.query(
      `WITH demand AS(SELECT r.category_id,sum(r.quantity-r.issued_quantity)::int AS quantity FROM resource_requests r JOIN incidents i ON i.id=r.incident_id WHERE ${requestWhere} AND r.status IN ('approved','partially_fulfilled') AND r.category_id IS NOT NULL GROUP BY r.category_id), supply AS(SELECT category_id,sum(available_quantity)::int AS quantity FROM resources WHERE status='operational' GROUP BY category_id) SELECT c.id,c.name,COALESCE(s.quantity,0)::int AS available,COALESCE(d.quantity,0)::int AS demand,GREATEST(0,COALESCE(d.quantity,0)-COALESCE(s.quantity,0))::int AS shortage FROM reference_data c LEFT JOIN supply s ON s.category_id=c.id LEFT JOIN demand d ON d.category_id=c.id WHERE c.kind='resource_category' AND c.active ORDER BY shortage DESC,c.name`,
      scope.params,
    )
  ).rows;
  res.json({ data, categories });
});
