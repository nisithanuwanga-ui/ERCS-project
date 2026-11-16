import type { Permission } from "../../shared/domain";
export interface Field {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "email"
    | "checkbox"
    | "multiselect";
  options?: string[];
  source?:
    | "incidents"
    | "resources"
    | "requests"
    | "people"
    | "incident_category"
    | "resource_category"
    | "team_type";
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
}
export interface ModuleConfig {
  key: string;
  title: string;
  singular: string;
  description: string;
  path: string;
  createPermission?: Permission;
  editPermission?: Permission;
  columns: string[];
  fields: Field[];
  statuses?: string[];
}
const priority: Field = {
  key: "priority",
  label: "Priority",
  type: "select",
  options: ["low", "medium", "high", "critical"],
  required: true,
};
const categories = (
  kind: "incident_category" | "resource_category",
): Field => ({
  key: "category_id",
  label: "Category",
  type: "select",
  source: kind,
  required: true,
});
export const modules: Record<string, ModuleConfig> = {
  incidents: {
    key: "incidents",
    title: "Incidents",
    singular: "Incident",
    description:
      "A shared operational picture, from first report to resolution.",
    path: "/incidents",
    createPermission: "incidents.create",
    editPermission: "incidents.manage",
    columns: ["code", "title", "priority", "status", "location", "created_at"],
    statuses: [
      "open",
      "reported",
      "active",
      "controlled",
      "resolved",
      "closed",
      "completed",
    ],
    fields: [
      { key: "title", label: "Incident title", required: true },
      categories("incident_category"),
      {
        key: "description",
        label: "Description",
        type: "textarea",
        required: true,
        min: 5,
      },
      {
        key: "severity",
        label: "Severity",
        type: "select",
        options: ["low", "medium", "high", "critical"],
        required: true,
      },
      priority,
      { key: "location", label: "Location", required: true },
    ],
  },
  resources: {
    key: "resources",
    title: "Resource inventory",
    singular: "Resource",
    description: "Know what is available, allocated, and ready to respond.",
    path: "/resources",
    createPermission: "resources.manage",
    editPermission: "resources.manage",
    columns: [
      "code",
      "name",
      "category",
      "available_quantity",
      "allocated_quantity",
      "status",
      "location",
    ],
    statuses: ["operational", "maintenance", "unavailable"],
    fields: [
      { key: "name", label: "Resource name", required: true },
      categories("resource_category"),
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "kind",
        label: "Resource model",
        type: "select",
        options: ["stock", "asset"],
        required: true,
        hint: "An indivisible asset has a total quantity of one.",
      },
      {
        key: "total_quantity",
        label: "Total quantity",
        type: "number",
        required: true,
        min: 0,
        max: 100000000,
      },
      {
        key: "threshold",
        label: "Minimum availability threshold",
        type: "number",
        required: true,
        min: 0,
        max: 100000000,
      },
      {
        key: "status",
        label: "Operational status",
        type: "select",
        options: ["operational", "maintenance", "unavailable"],
        required: true,
      },
      { key: "location", label: "Storage / current location", required: true },
    ],
  },
  "resource-requests": {
    key: "resource-requests",
    title: "Resource requests",
    singular: "Request",
    description:
      "Connect operational needs with a clear, accountable decision.",
    path: "/resource-requests",
    createPermission: "requests.create",
    editPermission: "requests.create",
    columns: [
      "code",
      "incident",
      "resource",
      "quantity",
      "issued_quantity",
      "priority",
      "status",
    ],
    statuses: [
      "awaiting_review",
      "pending",
      "under_review",
      "approved",
      "partially_fulfilled",
      "completed",
      "rejected",
      "cancelled",
    ],
    fields: [
      {
        key: "incident_id",
        label: "Linked incident",
        type: "select",
        source: "incidents",
        required: true,
      },
      {
        key: "resource_id",
        label: "Specific resource",
        hint: "Choose a specific resource or a category, not both.",
        type: "select",
        source: "resources",
      },
      {
        key: "category_id",
        label: "Resource category",
        hint: "Leave this blank when requesting a specific resource.",
        type: "select",
        source: "resource_category",
      },
      {
        key: "quantity",
        label: "Quantity required",
        type: "number",
        min: 1,
        max: 100000000,
        required: true,
      },
      priority,
      {
        key: "justification",
        label: "Operational justification",
        type: "textarea",
        required: true,
        min: 5,
      },
    ],
  },
  allocations: {
    key: "allocations",
    title: "Resource allocations",
    singular: "Allocation",
    description: "Deploy approved resources and track every return.",
    path: "/allocations",
    createPermission: "allocations.manage",
    columns: [
      "code",
      "request",
      "resource",
      "quantity",
      "released_quantity",
      "outstanding_quantity",
      "status",
    ],
    statuses: ["active", "returned"],
    fields: [
      {
        key: "request_id",
        label: "Approved request",
        type: "select",
        source: "requests",
        required: true,
      },
      {
        key: "resource_id",
        label: "Eligible resource",
        type: "select",
        source: "resources",
        required: true,
      },
      {
        key: "quantity",
        label: "Quantity to allocate",
        type: "number",
        min: 1,
        max: 100000000,
        required: true,
      },
    ],
  },
  teams: {
    key: "teams",
    title: "Response teams",
    singular: "Response team",
    description: "Keep the right people connected to the response.",
    path: "/teams",
    createPermission: "teams.manage",
    editPermission: "teams.manage",
    columns: ["code", "name", "type", "lead", "availability"],
    statuses: ["operational", "unavailable"],
    fields: [
      { key: "name", label: "Team name", required: true },
      {
        key: "type_id",
        label: "Team type",
        type: "select",
        source: "team_type",
        required: true,
      },
      {
        key: "lead_id",
        label: "Team lead",
        type: "select",
        source: "people",
        required: true,
      },
      {
        key: "member_ids",
        label: "Team members",
        type: "multiselect",
        source: "people",
        hint: "Use Ctrl or Command to select multiple members.",
      },
      { key: "contact", label: "Authorized team contact" },
      {
        key: "status",
        label: "Operational status",
        type: "select",
        options: ["operational", "unavailable"],
        required: true,
      },
    ],
  },
  users: {
    key: "users",
    title: "User management",
    singular: "User",
    description:
      "Provision authorized access and manage account responsibilities.",
    path: "/admin/users",
    createPermission: "users.manage",
    editPermission: "users.manage",
    columns: ["name", "email", "role", "active", "created_at"],
    fields: [
      { key: "email", label: "Email address", type: "email", required: true },
      {
        key: "role",
        label: "Assigned role",
        type: "select",
        options: [
          "administrator",
          "coordinator",
          "resource_manager",
          "field_officer",
          "viewer",
        ],
        required: true,
      },
    ],
  },
  "audit-logs": {
    key: "audit-logs",
    title: "Audit logs",
    singular: "Audit event",
    description: "A read-only record of the decisions behind your response.",
    path: "/audit-logs",
    columns: ["action", "actor", "entity_type", "entity_id", "created_at"],
    fields: [],
  },
};
export const fieldLabel = (key: string) =>
  ({
    code: "Reference",
    created_at: "Created",
    issued_quantity: "Issued",
    available_quantity: "Available",
    allocated_quantity: "Allocated",
    released_quantity: "Returned",
    outstanding_quantity: "Outstanding",
    entity_type: "Entity",
    entity_id: "Record",
    active: "Account status",
  })[key] ?? key.replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase());
