import { describe, expect, it } from "vitest";
import { incidentPage } from "./incident-contract";

const rows = [
  { id: 12, title: "Flood response", incident_type: "Flood", severity: "critical", status: "responding", location: "Colombo", created_at: "2026-11-16T00:00:00Z" },
  { id: 11, title: "Medical support", incident_type: "Medical", severity: "medium", status: "resolved", location: "Kandy", created_at: "2026-11-15T00:00:00Z" },
  { id: 10, title: "Flood assessment", incident_type: "Flood", severity: "high", status: "investigating", location: "Galle", created_at: "2026-11-14T00:00:00Z" },
];
describe("real incident contract adaptation", () => {
  it("keeps returned fields and normalizes integer IDs for routing", () => {
    const result = incidentPage(rows, new URLSearchParams("pageSize=2&page=2"));
    expect(result.data.map(row => row.id)).toEqual(["10"]);
    expect(result.meta).toEqual({ total: 3, page: 2, pageSize: 2 });
    expect(result.data[0]).not.toHaveProperty("priority");
    expect(result.data[0]).not.toHaveProperty("assigned_team");
  });
  it("searches and filters the returned collection before pagination", () => {
    const result = incidentPage(rows, new URLSearchParams("q=flood&status=open&severity=critical"));
    expect(result.data.map(row => row.id)).toEqual(["12"]);
    expect(result.meta.total).toBe(1);
  });
  it("filters real dates and completed statuses", () => {
    expect(incidentPage(rows,new URLSearchParams("from=2026-11-15&to=2026-11-15")).data.map(row=>row.id)).toEqual(["11"]);
    expect(incidentPage(rows,new URLSearchParams("status=completed")).data.map(row=>row.id)).toEqual(["11"]);
  });
  it("honors the existing oldest-first sort control", () => {
    expect(incidentPage(rows,new URLSearchParams("sort=oldest")).data.map(row=>row.id)).toEqual(["10","11","12"]);
  });
  it("reports filters for fields absent from the backend", () => {
    expect(() => incidentPage(rows,new URLSearchParams("priority=high"))).toThrow(/not supported/);
  });
});
