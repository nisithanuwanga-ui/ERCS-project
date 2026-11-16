import { Router } from "express";
import { z } from "zod";
import { can, roles } from "../../../shared/domain.js";
import type { User } from "../../../shared/domain.js";
import { pool } from "../database.js";
import { HttpError, incidentScope, userOf } from "../security.js";
import { idSchema } from "../validation.js";
import { workspaceSummary } from "./workspace-summary.js";

export const router = Router();

const definitions = {
  incidents: {
    from: "incidents i JOIN reference_data c ON c.id=i.category_id JOIN users u ON u.id=i.reporter_id",
    select:
      "i.*,c.name AS category,u.name AS reporter,(SELECT string_agg(t.name, ', ' ORDER BY t.name) FROM team_assignments ta JOIN response_teams t ON t.id=ta.team_id WHERE ta.incident_id=i.id AND ta.status NOT IN ('completed','cancelled')) AS assigned_team",
    alias: "i",
    search: ["i.code", "i.title", "i.location"],
    status: "i.status",
    priority: "i.priority",
  },
  resources: {
    from: "resources i JOIN reference_data c ON c.id=i.category_id",
    select:
      "i.*,c.name AS category,(i.available_quantity<=i.threshold) AS low_stock",
    alias: "i",
    search: ["i.code", "i.name", "i.location"],
    status: "i.status",
    priority: null,
  },
  "resource-requests": {
    from: "resource_requests r JOIN incidents i ON i.id=r.incident_id JOIN users u ON u.id=r.requester_id LEFT JOIN resources s ON s.id=r.resource_id LEFT JOIN reference_data c ON c.id=r.category_id",
    select:
      "r.*,i.title AS incident,i.code AS incident_code,u.name AS requester,COALESCE(s.name,c.name) AS resource,COALESCE(r.category_id,s.category_id) AS resource_category_id",
    alias: "r",
    search: ["r.code", "i.title", "u.name", "s.name", "c.name"],
    status: "r.status",
    priority: "r.priority",
  },
  allocations: {
    from: "allocations a JOIN resource_requests r ON r.id=a.request_id JOIN incidents i ON i.id=r.incident_id JOIN resources s ON s.id=a.resource_id JOIN users u ON u.id=a.responsible_id",
    select:
      "a.*,r.code AS request,r.status AS request_status,i.id AS incident_id,i.title AS incident,s.name AS resource,u.name AS responsible,(a.quantity-a.released_quantity) AS outstanding_quantity,CASE WHEN a.quantity=a.released_quantity THEN 'returned' ELSE 'active' END AS status",
    alias: "a",
    search: ["a.code", "r.code", "i.title", "s.name"],
    status:
      "CASE WHEN a.quantity=a.released_quantity THEN 'returned' ELSE 'active' END",
    priority: null,
  },
  teams: {
    from: "response_teams t JOIN users u ON u.id=t.lead_id JOIN reference_data c ON c.id=t.type_id",
    select:
      "t.id,t.code,t.name,t.type_id,t.lead_id,t.status,t.created_at,t.updated_at,u.name AS lead,c.name AS type,(SELECT count(*)::int FROM team_members tm WHERE tm.team_id=t.id) AS member_count,(SELECT i.title FROM team_assignments ta JOIN incidents i ON i.id=ta.incident_id WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled')) AS current_incident,(SELECT ta.incident_id FROM team_assignments ta WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled')) AS incident_id,CASE WHEN EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled')) THEN 'deployed' WHEN t.status='operational' THEN 'available' ELSE 'unavailable' END AS availability",
    alias: "t",
    search: ["t.code", "t.name", "u.name"],
    status: "t.status",
    priority: null,
  },
  users: {
    from: "users u",
    select:
      "u.id,u.name,u.email,u.role,u.active,u.is_demo,u.created_at,u.updated_at",
    alias: "u",
    search: ["u.name", "u.email", "u.role"],
    status: null,
    priority: null,
  },
  "audit-logs": {
    from: "audit_logs a LEFT JOIN users u ON u.id=a.actor_id",
    select: "a.*,u.name AS actor",
    alias: "a",
    search: ["a.action", "a.entity_type", "u.name"],
    status: null,
    priority: null,
  },
} as const;
type Module = keyof typeof definitions;
function checkModule(module: string): asserts module is Module {
  if (!Object.hasOwn(definitions, module))
    throw new HttpError(404, "Module not found.");
}
function readAccess(module: Module, user: User) {
  if (module === "users" && !can(user.role, "users.manage"))
    throw new HttpError(403, "Administrator access required.");
  if (module === "audit-logs" && !can(user.role, "audit.read"))
    throw new HttpError(403, "Audit access required.");
}
function scopeFor(module: Module, user: User, index: number) {
  if (user.role !== "field_officer")
    return { sql: "TRUE", params: [] as unknown[] };
  if (module === "teams")
    return {
      sql: `(t.lead_id=$${index} OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=$${index}))`,
      params: [user.id],
    };
  if (module === "resources") return { sql: "TRUE", params: [] as unknown[] };
  const scoped = incidentScope(user, "i", index);
  if (module === "resource-requests")
    scoped.sql = `(r.requester_id=$${index} OR ${scoped.sql})`;
  return scoped;
}
const listQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(15),
    q: z.string().max(200).default(""),
    status: z.string().max(40).optional(),
    priority: z.string().max(40).optional(),
    sort: z.enum(["newest", "oldest"]).default("newest"),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    incident_id: idSchema.optional(),
    category_id: idSchema.optional(),
    location: z.string().max(160).optional(),
    role: z.enum(roles).optional(),
    active: z.enum(["true", "false"]).optional(),
    actor_id: idSchema.optional(),
    action: z.string().max(100).optional(),
    entity_type: z.string().max(100).optional(),
    eligible: z.enum(["true"]).optional(),
    request_id: idSchema.optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    team_id: idSchema.optional(),
    requester_id: idSchema.optional(),
    resource_id: idSchema.optional(),
    responsible_id: idSchema.optional(),
    type_id: idSchema.optional(),
    lead_id: idSchema.optional(),
    low_stock: z.enum(["true", "false"]).optional(),
    availability: z
      .enum(["available", "allocated", "deployed", "unavailable"])
      .optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "The start date must be on or before the end date.",
    path: ["to"],
  });
router.get("/:module", async (req, res) => {
  const module = req.params.module;
  checkModule(module);
  const user = userOf(req);
  readAccess(module, user);
  const d = definitions[module];
  const v = listQuery.parse(req.query);
  const scope = scopeFor(module, user, 1);
  const params: unknown[] = [...scope.params];
  const where = [scope.sql];
  const equals = (column: string, value: unknown) => {
    if (value !== undefined) {
      params.push(value);
      where.push(`${column}=$${params.length}`);
    }
  };
  if (module === "incidents") {
    equals("i.severity", v.severity);
    if (v.team_id) {
      params.push(v.team_id);
      where.push(
        `EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.incident_id=i.id AND ta.team_id=$${params.length} AND ta.status NOT IN ('completed','cancelled'))`,
      );
    }
  }
  if (module === "resources") {
    if (v.low_stock)
      where.push(
        `i.available_quantity ${v.low_stock === "true" ? "<=" : ">"} i.threshold`,
      );
    if (v.availability === "available")
      where.push("i.status='operational' AND i.available_quantity>0");
    if (v.availability === "allocated") where.push("i.allocated_quantity>0");
    if (v.availability === "unavailable")
      where.push("(i.status<>'operational' OR i.available_quantity=0)");
  }
  if (module === "resource-requests") {
    equals("r.requester_id", v.requester_id);
    equals("COALESCE(r.category_id,s.category_id)", v.category_id);
    equals("r.resource_id", v.resource_id);
  }
  if (module === "allocations") {
    equals("a.resource_id", v.resource_id);
    equals("a.responsible_id", v.responsible_id);
    equals("a.request_id", v.request_id);
  }
  if (module === "teams") {
    equals("t.type_id", v.type_id);
    equals("t.lead_id", v.lead_id);
    if (v.incident_id) {
      params.push(v.incident_id);
      where.push(
        `EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.team_id=t.id AND ta.incident_id=$${params.length} AND ta.status NOT IN ('completed','cancelled'))`,
      );
    }
    const deployed =
      "EXISTS(SELECT 1 FROM team_assignments ta WHERE ta.team_id=t.id AND ta.status NOT IN ('completed','cancelled'))";
    if (v.availability === "deployed") where.push(deployed);
    if (v.availability === "available")
      where.push(`t.status='operational' AND NOT ${deployed}`);
    if (v.availability === "unavailable")
      where.push(`t.status='unavailable' AND NOT ${deployed}`);
  }
  if (v.location && ["incidents", "resources"].includes(module)) {
    params.push(`%${v.location}%`);
    where.push(`${d.alias}.location ILIKE $${params.length}`);
  }
  if (module === "users") {
    if (v.role) {
      params.push(v.role);
      where.push(`u.role=$${params.length}`);
    }
    if (v.active) {
      params.push(v.active === "true");
      where.push(`u.active=$${params.length}`);
    }
  }
  if (module === "audit-logs") {
    for (const field of ["actor_id", "action", "entity_type"] as const) {
      if (v[field]) {
        params.push(v[field]);
        where.push(`a.${field}=$${params.length}`);
      }
    }
  }
  if (v.eligible && module === "resource-requests")
    where.push("r.status IN ('approved','partially_fulfilled')");
  if (v.request_id && module === "resources") {
    if (!can(user.role, "allocations.manage"))
      throw new HttpError(403, "Allocation access required.");
    params.push(v.request_id);
    where.push(
      `i.status='operational' AND i.available_quantity>0 AND EXISTS(SELECT 1 FROM resource_requests rq WHERE rq.id=$${params.length} AND (rq.resource_id=i.id OR (rq.resource_id IS NULL AND rq.category_id=i.category_id)))`,
    );
  }
  if (v.q) {
    params.push(`%${v.q}%`);
    where.push(
      `(${d.search.map((s) => `${s} ILIKE $${params.length}`).join(" OR ")})`,
    );
  }
  if (v.status && d.status) {
    if (module === "incidents" && v.status === "open")
      where.push("i.status NOT IN ('resolved','closed')");
    else if (module === "incidents" && v.status === "completed")
      where.push("i.status IN ('resolved','closed')");
    else if (module === "resource-requests" && v.status === "awaiting_review")
      where.push("r.status IN ('pending','under_review')");
    else if (module === "allocations" && v.status === "partially_fulfilled")
      where.push(
        "a.quantity>a.released_quantity AND r.status='partially_fulfilled'",
      );
    else if (module === "allocations" && v.status === "completed")
      where.push("a.quantity=a.released_quantity");
    else {
      params.push(v.status);
      where.push(`${d.status}=$${params.length}`);
    }
  }
  if (v.priority && d.priority) {
    params.push(v.priority);
    where.push(`${d.priority}=$${params.length}`);
  }
  if (v.from) {
    params.push(v.from);
    where.push(`${d.alias}.created_at >= $${params.length}::date`);
  }
  if (v.to) {
    params.push(v.to);
    where.push(
      `${d.alias}.created_at < $${params.length}::date+interval '1 day'`,
    );
  }
  if (v.incident_id && ["resource-requests", "allocations"].includes(module)) {
    params.push(v.incident_id);
    where.push(`i.id=$${params.length}`);
  }
  if (v.category_id && ["incidents", "resources"].includes(module)) {
    params.push(v.category_id);
    where.push(`${d.alias}.category_id=$${params.length}`);
  }
  const clause = where.join(" AND ");
  const total = (
    await pool.query(
      `SELECT count(*)::int AS total FROM ${d.from} WHERE ${clause}`,
      params,
    )
  ).rows[0].total;
  const rows = (
    await pool.query(
      `SELECT ${d.select} FROM ${d.from} WHERE ${clause} ORDER BY ${d.alias}.created_at ${v.sort === "oldest" ? "ASC" : "DESC"},${d.alias}.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, v.pageSize, (v.page - 1) * v.pageSize],
    )
  ).rows;
  res.json({ data: rows, meta: { total, page: v.page, pageSize: v.pageSize } });
});
router.get("/:module/summary", async (req, res) => {
  checkModule(req.params.module);
  const user = userOf(req);
  readAccess(req.params.module, user);
  res.json({ data: await workspaceSummary(req.params.module, user) });
});
router.get("/:module/:id", async (req, res) => {
  const module = req.params.module;
  checkModule(module);
  const id = idSchema.parse(req.params.id);
  const user = userOf(req);
  readAccess(module, user);
  const d = definitions[module];
  const scope = scopeFor(module, user, 2);
  const item = (
    await pool.query(
      `SELECT ${d.select} FROM ${d.from} WHERE ${d.alias}.id=$1 AND ${scope.sql}`,
      [id, ...scope.params],
    )
  ).rows[0];
  if (!item)
    throw new HttpError(
      404,
      "Record not found or unavailable to your account.",
    );
  const details: Record<string, unknown> = {
    history: (
      await pool.query(
        "SELECT h.*,u.name AS actor FROM history h JOIN users u ON u.id=h.actor_id WHERE entity_type=$1 AND entity_id=$2 ORDER BY created_at DESC",
        [module, id],
      )
    ).rows,
  };
  if (module === "incidents") {
    details.requests = (
      await pool.query(
        "SELECT id,code,status,quantity,issued_quantity FROM resource_requests WHERE incident_id=$1 ORDER BY created_at DESC",
        [id],
      )
    ).rows;
    details.allocations = (
      await pool.query(
        "SELECT a.* FROM allocations a JOIN resource_requests r ON r.id=a.request_id WHERE r.incident_id=$1 ORDER BY a.created_at DESC",
        [id],
      )
    ).rows;
    details.assignments = (
      await pool.query(
        "SELECT ta.*,t.name AS team,($3='coordinator' OR ($3='field_officer' AND (t.lead_id=$2 OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=$2)))) AS can_advance FROM team_assignments ta JOIN response_teams t ON t.id=ta.team_id WHERE ta.incident_id=$1 ORDER BY ta.created_at DESC",
        [id, user.id, user.role],
      )
    ).rows;
  }
  if (module === "teams") {
    details.assignments = (
      await pool.query(
        "SELECT ta.*,i.title AS incident,($3='coordinator' OR ($3='field_officer' AND (t.lead_id=$2 OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=$2)))) AS can_advance FROM team_assignments ta JOIN incidents i ON i.id=ta.incident_id JOIN response_teams t ON t.id=ta.team_id WHERE ta.team_id=$1 ORDER BY ta.created_at DESC",
        [id, user.id, user.role],
      )
    ).rows;
    details.members = (
      await pool.query(
        "SELECT u.id,u.name FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=$1",
        [id],
      )
    ).rows;
    if (user.role !== "viewer")
      item.contact = (
        await pool.query("SELECT contact FROM response_teams WHERE id=$1", [id])
      ).rows[0].contact;
  }
  if (module === "resources") {
    details.movements = (
      await pool.query(
        "SELECT m.*,u.name AS actor FROM inventory_movements m JOIN users u ON u.id=m.actor_id WHERE m.resource_id=$1 ORDER BY m.created_at DESC LIMIT 100",
        [id],
      )
    ).rows;
    const allocationScope = incidentScope(user, "i", 2);
    details.allocations = (
      await pool.query(
        `SELECT a.*,i.id AS incident_id,i.title AS incident,r.code AS request,u.name AS responsible,(a.quantity-a.released_quantity) AS outstanding_quantity,CASE WHEN a.quantity=a.released_quantity THEN 'returned' ELSE 'active' END AS status FROM allocations a JOIN resource_requests r ON r.id=a.request_id JOIN incidents i ON i.id=r.incident_id JOIN users u ON u.id=a.responsible_id WHERE a.resource_id=$1 AND ${allocationScope.sql} ORDER BY a.created_at DESC`,
        [id, ...allocationScope.params],
      )
    ).rows;
  }
  if (module === "resource-requests")
    details.allocations = (
      await pool.query(
        "SELECT * FROM allocations WHERE request_id=$1 ORDER BY created_at DESC",
        [id],
      )
    ).rows;
  if (module === "allocations")
    details.releases = (
      await pool.query(
        "SELECT * FROM allocation_releases WHERE allocation_id=$1 ORDER BY created_at DESC",
        [id],
      )
    ).rows;
  res.json({ data: item, details });
});
