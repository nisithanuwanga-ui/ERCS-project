import { describe, expect, it } from "vitest";
import {
  assertLocalDemoEnvironment,
  demoAccountBlocked,
  demoEmails,
} from "../src/demo-policy";
describe("development demo safeguards", () => {
  it("requires a local PostgreSQL URL and a nonproduction environment", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"])
      expect(() =>
        assertLocalDemoEnvironment(
          "development",
          `postgresql://ercs:example@${host}:5432/ercs`,
        ),
      ).not.toThrow();
    expect(() =>
      assertLocalDemoEnvironment(
        "test",
        "postgresql://ercs:example@127.0.0.1/ercs_test",
      ),
    ).not.toThrow();
    for (const environment of ["production", "staging", ""])
      expect(() =>
        assertLocalDemoEnvironment(environment, "postgresql://localhost/ercs"),
      ).toThrow();
    for (const url of [
      "postgresql://prod.example/ercs",
      "postgresql://localhost.evil.test/ercs",
      "postgresql://localhost/ercs?host=prod.example",
      "postgresql://localhost/ercs?HOST=prod.example",
      "postgresql://localhost/ercs?hostaddr=192.0.2.10",
      "https://localhost/ercs",
    ])
      expect(() => assertLocalDemoEnvironment("development", url)).toThrow();
  });
  it("denies both flagged demos and reserved public identities in production", () => {
    for (const email of demoEmails)
      expect(demoAccountBlocked("production", { email, is_demo: false })).toBe(
        true,
      );
    expect(
      demoAccountBlocked("production", {
        email: "copied@example.test",
        is_demo: true,
      }),
    ).toBe(true);
    expect(
      demoAccountBlocked("production", {
        email: "operator@example.test",
        is_demo: false,
      }),
    ).toBe(false);
  });
  it("permits explicit demo access locally", () => {
    expect(
      demoAccountBlocked("development", {
        email: "admin@ercs.demo",
        is_demo: true,
      }),
    ).toBe(false);
    expect(
      demoAccountBlocked("test", { email: "admin@ercs.demo", is_demo: true }),
    ).toBe(false);
  });
});
