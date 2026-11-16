export const roles = [
  "administrator",
  "coordinator",
  "resource_manager",
  "field_officer",
  "viewer",
] as const;
export type Role = (typeof roles)[number];
export const roleLabels: Record<Role, string> = {
  administrator: "System Administrator",
  coordinator: "Emergency Coordinator",
  resource_manager: "Resource Manager",
  field_officer: "Field Officer",
  viewer: "Authorized Viewer",
};
export const grants = {
  "incidents.create": ["coordinator", "field_officer"],
  "incidents.manage": ["coordinator"],
  "resources.manage": ["resource_manager"],
  "requests.create": ["coordinator", "resource_manager", "field_officer"],
  "requests.review": ["coordinator"],
  "allocations.manage": ["coordinator", "resource_manager"],
  "teams.manage": ["coordinator"],
  "users.manage": ["administrator"],
  "settings.manage": ["administrator"],
  "audit.read": ["administrator", "coordinator"],
} satisfies Record<string, Role[]>;
export type Permission = keyof typeof grants;
export function can(role: Role, permission: Permission): boolean {
  return (grants[permission] as readonly Role[]).includes(role);
}
export const incidentStates = [
  "reported",
  "investigating",
  "responding",
  "resolved",
  "closed",
] as const;
export const priorities = ["low", "medium", "high", "critical"] as const;
export function validIncidentTransition(from: string, to: string): boolean {
  if (
    !incidentStates.includes(from as (typeof incidentStates)[number]) ||
    !incidentStates.includes(to as (typeof incidentStates)[number])
  )
    return false;
  return (
    from === to ||
    incidentStates.indexOf(to as (typeof incidentStates)[number]) ===
      incidentStates.indexOf(from as (typeof incidentStates)[number]) + 1
  );
}
export function validRequestTransition(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    pending: ["under_review", "cancelled"],
    under_review: ["approved", "rejected", "cancelled"],
  };
  return Object.hasOwn(transitions, from) && transitions[from].includes(to);
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  is_demo?: boolean;
}
export interface RecordData {
  id: string;
  [key: string]: unknown;
}
export interface PageResult {
  data: RecordData[];
  meta: { total: number; page: number; pageSize: number };
}
