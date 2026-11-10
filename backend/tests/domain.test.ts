import { describe, expect, it } from "vitest";
import {
  can,
  roles,
  validIncidentTransition,
  validRequestTransition,
} from "../../shared/domain";
import {
  allocationSchema,
  passwordSchema,
  requestSchema,
  resourceSchema,
} from "../src/validation";
describe("permission boundaries", () => {
  it("never grants administrators implicit operational decisions", () => {
    expect(can("administrator", "requests.review")).toBe(false);
    expect(can("administrator", "allocations.manage")).toBe(false);
    expect(can("administrator", "users.manage")).toBe(true);
  });
  it("limits privileged provisioning to administrators", () => {
    for (const role of roles.filter((r) => r !== "administrator"))
      expect(can(role, "users.manage")).toBe(false);
  });
  it("limits field officers to submission actions", () => {
    expect(can("field_officer", "requests.create")).toBe(true);
    expect(can("field_officer", "requests.review")).toBe(false);
    expect(can("viewer", "incidents.create")).toBe(false);
  });
});
describe("lifecycle and validation", () => {
  it("allows sequential incident lifecycle and denies skipped/reverse transitions", () => {
    expect(validIncidentTransition("reported", "active")).toBe(true);
    expect(validIncidentTransition("active", "closed")).toBe(false);
    expect(validIncidentTransition("closed", "active")).toBe(false);
    expect(validIncidentTransition("invalid", "reported")).toBe(false);
  });
  it("never conflates approval with fulfillment", () => {
    expect(validRequestTransition("pending", "under_review")).toBe(true);
    expect(validRequestTransition("under_review", "approved")).toBe(true);
    expect(validRequestTransition("pending", "completed")).toBe(false);
    expect(validRequestTransition("approved", "completed")).toBe(false);
  });
  it("rejects weak or excessive passwords", () => {
    expect(passwordSchema.safeParse("password").success).toBe(false);
    expect(passwordSchema.safeParse("StrongPassword123!").success).toBe(true);
  });
  it("requires exactly one requested resource or category", () => {
    const base = {
      incident_id: crypto.randomUUID(),
      quantity: 1,
      priority: "high",
      justification: "Urgent supplies needed",
    };
    expect(requestSchema.safeParse(base).success).toBe(false);
    expect(
      requestSchema.safeParse({
        ...base,
        resource_id: crypto.randomUUID(),
        category_id: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({ ...base, resource_id: crypto.randomUUID() })
        .success,
    ).toBe(true);
  });
  it("rejects fractional, negative, zero and unbounded allocations", () => {
    for (const quantity of [0, -1, 1.5, 100000001])
      expect(
        allocationSchema.safeParse({
          request_id: crypto.randomUUID(),
          resource_id: crypto.randomUUID(),
          quantity,
        }).success,
      ).toBe(false);
  });
  it("enforces indivisible asset capacity", () => {
    expect(
      resourceSchema.safeParse({
        name: "Rescue van",
        category_id: crypto.randomUUID(),
        kind: "asset",
        total_quantity: 2,
        status: "operational",
        location: "Central depot",
        threshold: 0,
      }).success,
    ).toBe(false);
  });
});
