import type { RecordData, PageResult } from "../../shared/domain";

export const incidentStatuses = ["reported", "investigating", "responding", "resolved", "closed"] as const;
export function normalizeIncident(value: Record<string, unknown>): RecordData {
  if (!value || (typeof value.id !== "number" && typeof value.id !== "string")) {
    throw new Error("The server returned an invalid incident.");
  }
  return { ...value, id: String(value.id) };
}
// The API returns the complete collection. These controls use only real rows.
export function incidentPage(rows: Record<string, unknown>[], params: URLSearchParams): PageResult {
  for (const key of ["priority", "category_id", "team_id"]) {
    if (params.get(key)) throw new Error("This incident filter is not supported by the server yet. Clear it to continue.");
  }
  let data = rows.map(normalizeIncident);
  const term = params.get("q")?.trim().toLowerCase();
  if (term) data = data.filter(row => ["id", "title", "description", "incident_type", "location"].some(key => String(row[key] ?? "").toLowerCase().includes(term)));
  const status = params.get("status");
  if (status) data = data.filter(row => status === "open"
    ? !["resolved", "closed"].includes(String(row.status))
    : status === "completed" ? ["resolved", "closed"].includes(String(row.status)) : row.status === status);
  for (const key of ["severity", "incident_type", "location"]) {
    const value = params.get(key)?.trim().toLowerCase();
    if (value) data = data.filter(row => String(row[key] ?? "").toLowerCase().includes(value));
  }
  const from = params.get("from") ?? params.get("date_from");
  const to = params.get("to") ?? params.get("date_to");
  if (from) data = data.filter(row => String(row.created_at).slice(0,10) >= from);
  if (to) data = data.filter(row => String(row.created_at).slice(0,10) <= to);
  if (params.get("sort") === "oldest") data.reverse();
  const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(params.get("pageSize"))) || 15));
  const total = data.length;
  const page = Math.max(1, Math.trunc(Number(params.get("page"))) || 1);
  return { data: data.slice((page - 1) * pageSize, page * pageSize), meta: { total, page, pageSize } };
}
