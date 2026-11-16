import type { User } from "../../../shared/domain.js";
import { pool } from "../database.js";
import { HttpError, incidentScope } from "../security.js";

type Point = { name: string; value: number };

/** Aggregate complete, authorized result sets rather than the current table page. */
export async function workspaceSummary(module: string, user: User) {
  const scope = incidentScope(user);
  const requestScope =
    user.role === "field_officer"
      ? `(${scope.sql} OR r.requester_id=$1)`
      : scope.sql;
  const teamScope =
    user.role === "field_officer"
      ? "(t.lead_id=$1 OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=$1))"
      : "TRUE";
  const query = async (sql: string, params: unknown[] = scope.params) =>
    (await pool.query(sql, params)).rows;
  let counts: Record<string, number>;
  let distribution: Point[];
  let secondary: Point[];
  let activity: { date: string; quantity: number; released: number }[] = [];
  if (module === "incidents") {
    [counts] = await query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE i.status NOT IN ('resolved','closed'))::int AS active,count(*) FILTER(WHERE i.severity='critical' AND i.status NOT IN ('resolved','closed'))::int AS critical,count(*) FILTER(WHERE i.status IN ('resolved','closed'))::int AS resolved FROM incidents i WHERE ${scope.sql}`,
    );
    distribution = (await query(
      `SELECT i.priority AS name,count(*)::int AS value FROM incidents i WHERE ${scope.sql} GROUP BY i.priority`,
    )) as Point[];
    secondary = (await query(
      `SELECT i.severity AS name,count(*)::int AS value FROM incidents i WHERE ${scope.sql} GROUP BY i.severity`,
    )) as Point[];
  } else if (module === "resources") {
    [counts] = await query(
      "SELECT count(*)::int AS total,COALESCE(sum(total_quantity),0)::int AS total_quantity,COALESCE(sum(available_quantity) FILTER(WHERE status='operational'),0)::int AS available,COALESCE(sum(allocated_quantity),0)::int AS allocated,count(*) FILTER(WHERE status='maintenance')::int AS maintenance,count(*) FILTER(WHERE available_quantity<=threshold)::int AS low_stock FROM resources",
      [],
    );
    distribution = (await query(
      "SELECT c.name,COALESCE(sum(s.total_quantity),0)::int AS value FROM resources s JOIN reference_data c ON c.id=s.category_id GROUP BY c.name ORDER BY c.name",
      [],
    )) as Point[];
    secondary = (await query(
      "SELECT 'Available' AS name,COALESCE(sum(available_quantity) FILTER(WHERE status='operational'),0)::int AS value FROM resources UNION ALL SELECT 'Allocated',COALESCE(sum(allocated_quantity),0)::int FROM resources UNION ALL SELECT 'Unavailable',COALESCE(sum(available_quantity) FILTER(WHERE status<>'operational'),0)::int FROM resources",
      [],
    )) as Point[];
  } else if (module === "resource-requests") {
    const from = `resource_requests r JOIN incidents i ON i.id=r.incident_id WHERE ${requestScope}`;
    [counts] = await query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE r.status IN ('pending','under_review'))::int AS pending,count(*) FILTER(WHERE r.status='approved')::int AS approved,count(*) FILTER(WHERE r.status='rejected')::int AS rejected,count(*) FILTER(WHERE r.status='partially_fulfilled')::int AS partially_fulfilled FROM ${from}`,
    );
    distribution = (await query(
      `SELECT r.status AS name,count(*)::int AS value FROM ${from} GROUP BY r.status`,
    )) as Point[];
    secondary = (await query(
      `SELECT r.priority AS name,count(*)::int AS value FROM ${from} GROUP BY r.priority`,
    )) as Point[];
  } else if (module === "allocations") {
    const from = `allocations a JOIN resource_requests r ON r.id=a.request_id JOIN incidents i ON i.id=r.incident_id WHERE ${scope.sql}`;
    [counts] = await query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE a.quantity>a.released_quantity)::int AS active,count(*) FILTER(WHERE a.quantity=a.released_quantity)::int AS completed,count(*) FILTER(WHERE r.status='partially_fulfilled' AND a.quantity>a.released_quantity)::int AS partially_fulfilled,COALESCE(sum(a.quantity-a.released_quantity),0)::int AS outstanding_quantity FROM ${from}`,
    );
    distribution = (await query(
      `SELECT CASE WHEN a.quantity=a.released_quantity THEN 'Returned' WHEN a.released_quantity>0 THEN 'Partially returned' ELSE 'Active' END AS name,count(*)::int AS value FROM ${from} GROUP BY 1`,
    )) as Point[];
    secondary = (await query(
      `SELECT s.name,COALESCE(sum(a.quantity-a.released_quantity),0)::int AS value FROM allocations a JOIN resources s ON s.id=a.resource_id JOIN resource_requests r ON r.id=a.request_id JOIN incidents i ON i.id=r.incident_id WHERE ${scope.sql} GROUP BY s.name ORDER BY value DESC LIMIT 8`,
    )) as Point[];
    activity = (await query(
      `SELECT d.day::date::text AS date,COALESCE((SELECT sum(a.quantity) FROM allocations a JOIN resource_requests r ON r.id=a.request_id JOIN incidents i ON i.id=r.incident_id WHERE a.created_at>=d.day AND a.created_at<d.day+interval '1 day' AND ${scope.sql}),0)::int AS quantity,COALESCE((SELECT sum(ar.quantity) FROM allocation_releases ar JOIN allocations a ON a.id=ar.allocation_id JOIN resource_requests r ON r.id=a.request_id JOIN incidents i ON i.id=r.incident_id WHERE ar.created_at>=d.day AND ar.created_at<d.day+interval '1 day' AND ${scope.sql}),0)::int AS released FROM generate_series(current_date-13,current_date,'1 day') d(day) ORDER BY d.day`,
    )) as typeof activity;
  } else if (module === "teams") {
    const deployed =
      "EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled'))";
    const from = `response_teams t WHERE ${teamScope}`;
    [counts] = await query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE t.status='operational' AND NOT ${deployed})::int AS available,count(*) FILTER(WHERE ${deployed})::int AS deployed,count(*) FILTER(WHERE t.status='unavailable' AND NOT ${deployed})::int AS unavailable FROM ${from}`,
    );
    distribution = (await query(
      `SELECT CASE WHEN ${deployed} THEN 'Deployed' WHEN t.status='operational' THEN 'Available' ELSE 'Unavailable' END AS name,count(*)::int AS value FROM ${from} GROUP BY 1`,
    )) as Point[];
    secondary = (await query(
      `SELECT c.name,count(*)::int AS value FROM response_teams t JOIN reference_data c ON c.id=t.type_id WHERE ${teamScope} GROUP BY c.name ORDER BY c.name`,
    )) as Point[];
  } else
    throw new HttpError(
      404,
      "This module does not have an operational summary.",
    );
  return { counts, distribution, secondary, activity };
}
