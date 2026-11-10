import type { Pool, PoolClient } from "pg";
import type { User } from "../../../shared/domain.js";
import { incidentScope } from "../security.js";

interface Queryable {
  query: Pool["query"] | PoolClient["query"];
}

export async function dashboardSummary(
  db: Queryable,
  user: User,
  days: number,
) {
  const scope = incidentScope(user);
  const parameters = scope.params;
  const where = scope.sql;
  const requestsScope =
    user.role === "field_officer" ? `(${where} OR r.requester_id=$1)` : where;
  const teamScope =
    user.role === "field_officer"
      ? "(t.lead_id=$1 OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=$1))"
      : "TRUE";
  const period = `$${parameters.length + 1}`;
  const inPeriod = [...parameters, days];
  const counts = (
    await db.query(
      `SELECT
    (SELECT count(*)::int FROM incidents i WHERE ${where} AND i.status NOT IN ('resolved','closed')) AS active_incidents,
    (SELECT COALESCE(sum(available_quantity),0)::int FROM resources WHERE status='operational') AS available_resources,
    (SELECT count(*)::int FROM resource_requests r JOIN incidents i ON i.id=r.incident_id WHERE ${requestsScope} AND r.status IN ('pending','under_review')) AS pending_requests,
    (SELECT count(*)::int FROM allocations a JOIN resource_requests r ON r.id=a.request_id JOIN incidents i ON i.id=r.incident_id WHERE ${where} AND a.quantity>a.released_quantity) AS active_allocations,
    (SELECT count(*)::int FROM response_teams t WHERE ${teamScope} AND t.status='operational') AS active_teams,
    (SELECT count(*)::int FROM response_teams t WHERE ${teamScope} AND t.status='operational' AND NOT EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled'))) AS available_teams`,
      parameters,
    )
  ).rows[0];
  const recent = (
    await db.query(
      `SELECT i.id,i.code,i.title,i.priority,i.status,i.location,i.created_at FROM incidents i WHERE ${where} ORDER BY i.created_at DESC LIMIT 5`,
      parameters,
    )
  ).rows;
  const urgent = (
    await db.query(
      `SELECT i.id,i.code,i.title,i.priority,i.status,i.location FROM incidents i WHERE ${where} AND i.priority IN ('high','critical') AND i.status NOT IN ('resolved','closed') ORDER BY CASE WHEN i.priority='critical' THEN 0 ELSE 1 END,i.created_at DESC LIMIT 4`,
      parameters,
    )
  ).rows;
  const urgentRequests = (
    await db.query(
      `SELECT r.id,r.code,r.priority,r.status,r.quantity,r.issued_quantity,i.title AS incident,COALESCE(s.name,c.name) AS resource,r.created_at FROM resource_requests r JOIN incidents i ON i.id=r.incident_id LEFT JOIN resources s ON s.id=r.resource_id LEFT JOIN reference_data c ON c.id=r.category_id WHERE ${requestsScope} AND r.priority IN ('high','critical') AND r.status IN ('pending','under_review') ORDER BY CASE WHEN r.priority='critical' THEN 0 ELSE 1 END,r.created_at LIMIT 4`,
      parameters,
    )
  ).rows;
  const trends = (
    await db.query(
      `SELECT dates.day::date::text AS date,count(i.id)::int AS incidents FROM generate_series(current_date-(${period}::int-1),current_date,'1 day') AS dates(day) LEFT JOIN incidents i ON i.created_at>=dates.day AND i.created_at<dates.day+interval '1 day' AND ${where} GROUP BY dates.day ORDER BY dates.day`,
      inPeriod,
    )
  ).rows;
  const distribution = (
    await db.query(
      `SELECT i.priority AS name,count(*)::int AS value FROM incidents i WHERE ${where} AND i.created_at>=current_date-(${period}::int-1) GROUP BY i.priority`,
      inPeriod,
    )
  ).rows;
  const requestPriority = (
    await db.query(
      `SELECT r.priority AS name,count(*)::int AS value FROM resource_requests r JOIN incidents i ON i.id=r.incident_id WHERE ${requestsScope} AND r.created_at>=current_date-(${period}::int-1) GROUP BY r.priority ORDER BY CASE r.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
      inPeriod,
    )
  ).rows;
  const resources = (
    await db.query(
      "SELECT c.name,COALESCE(sum(r.available_quantity) FILTER(WHERE r.status='operational'),0)::int AS available,COALESCE(sum(r.allocated_quantity),0)::int AS allocated,COALESCE(sum(r.available_quantity) FILTER(WHERE r.status<>'operational'),0)::int AS unavailable FROM reference_data c LEFT JOIN resources r ON r.category_id=c.id WHERE c.kind='resource_category' AND (c.active OR r.id IS NOT NULL) GROUP BY c.name ORDER BY c.name",
    )
  ).rows;
  const resourceAvailability = [
    {
      name: "Available",
      value: resources.reduce((sum, r) => sum + r.available, 0),
    },
    {
      name: "Allocated",
      value: resources.reduce((sum, r) => sum + r.allocated, 0),
    },
    {
      name: "Unavailable",
      value: resources.reduce((sum, r) => sum + r.unavailable, 0),
    },
  ];
  const activity =
    user.role === "field_officer"
      ? (
          await db.query(
            "SELECT h.id,h.action,h.entity_type,h.created_at,u.name AS actor FROM history h JOIN users u ON u.id=h.actor_id WHERE h.actor_id=$1 ORDER BY h.created_at DESC LIMIT 6",
            [user.id],
          )
        ).rows
      : (
          await db.query(
            "SELECT a.id,a.action,a.entity_type,a.created_at,u.name AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE a.entity_type NOT IN ('users','auth','invitations') ORDER BY a.created_at DESC LIMIT 6",
          )
        ).rows;
  const allocationActivity = (
    await db.query(
      `SELECT dates.day::date::text AS date,COALESCE(sum(a.quantity),0)::int AS quantity FROM generate_series(current_date-(${period}::int-1),current_date,'1 day') AS dates(day) LEFT JOIN (allocations a JOIN resource_requests r ON r.id=a.request_id JOIN incidents i ON i.id=r.incident_id) ON a.created_at>=dates.day AND a.created_at<dates.day+interval '1 day' AND ${where} GROUP BY dates.day ORDER BY dates.day`,
      inPeriod,
    )
  ).rows;
  const teams = (
    await db.query(
      `SELECT CASE WHEN EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled')) THEN 'Deployed' WHEN t.status='operational' THEN 'Available' ELSE 'Unavailable' END AS name,count(*)::int AS value FROM response_teams t WHERE ${teamScope} GROUP BY 1`,
      parameters,
    )
  ).rows;
  const teamAvailability = (
    await db.query(
      `SELECT c.name,count(*) FILTER(WHERE t.status='operational' AND NOT EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled')))::int AS available,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled')))::int AS deployed,count(*) FILTER(WHERE t.status<>'operational' AND NOT EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled')))::int AS unavailable FROM response_teams t JOIN reference_data c ON c.id=t.type_id WHERE ${teamScope} GROUP BY c.name ORDER BY c.name`,
      parameters,
    )
  ).rows;
  const shortageCategories = (
    await db.query(
      `WITH demand AS(SELECT COALESCE(r.category_id,s.category_id) AS category_id,sum(r.quantity-r.issued_quantity)::int AS quantity FROM resource_requests r JOIN incidents i ON i.id=r.incident_id LEFT JOIN resources s ON s.id=r.resource_id WHERE ${requestsScope} AND r.status IN ('approved','partially_fulfilled') GROUP BY COALESCE(r.category_id,s.category_id)),supply AS(SELECT category_id,sum(available_quantity)::int AS quantity FROM resources WHERE status='operational' GROUP BY category_id) SELECT c.id,c.name,COALESCE(s.quantity,0)::int AS available,COALESCE(d.quantity,0)::int AS demand,GREATEST(0,COALESCE(d.quantity,0)-COALESCE(s.quantity,0))::int AS shortage FROM reference_data c LEFT JOIN supply s ON s.category_id=c.id LEFT JOIN demand d ON d.category_id=c.id WHERE c.kind='resource_category' AND (c.active OR s.category_id IS NOT NULL OR d.category_id IS NOT NULL) ORDER BY shortage DESC,c.name`,
      parameters,
    )
  ).rows;
  const alerts = (
    await db.query(
      `WITH demand AS(SELECT r.resource_id,sum(r.quantity-r.issued_quantity)::int AS quantity FROM resource_requests r JOIN incidents i ON i.id=r.incident_id WHERE ${requestsScope} AND r.status IN ('approved','partially_fulfilled') AND r.resource_id IS NOT NULL GROUP BY r.resource_id) SELECT s.id,s.code,s.name,s.available_quantity,s.threshold,s.status,COALESCE(d.quantity,0)::int AS demand,GREATEST(0,COALESCE(d.quantity,0)-CASE WHEN s.status='operational' THEN s.available_quantity ELSE 0 END)::int AS shortage,count(*) OVER()::int AS total_alerts FROM resources s LEFT JOIN demand d ON d.resource_id=s.id WHERE s.available_quantity<=s.threshold OR s.status<>'operational' OR COALESCE(d.quantity,0)>s.available_quantity ORDER BY shortage DESC,s.available_quantity,s.name LIMIT 4`,
      parameters,
    )
  ).rows;
  counts.shortages = alerts[0]?.total_alerts ?? 0;
  return {
    counts,
    recent,
    urgent,
    urgentRequests,
    trends,
    distribution,
    requestPriority,
    resources,
    resourceAvailability,
    activity,
    allocationActivity,
    teams,
    teamAvailability,
    shortageCategories,
    resourceAlerts: alerts,
    days,
    generatedAt: new Date().toISOString(),
  };
}
