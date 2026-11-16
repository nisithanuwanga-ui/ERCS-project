import { describe, expect, it } from "vitest";
import { isTrustedOrigin, trustedOrigins } from "../src/origins";

describe("trusted browser origins", () => {
  it.each(["http://localhost:5173", "http://127.0.0.1:5173"])(
    "allows both exact development loopback names when configured from %s",
    (appOrigin) => {
      const origins = trustedOrigins({ nodeEnv: "development", appOrigin });
      expect([...origins].sort()).toEqual([
        "http://127.0.0.1:5173",
        "http://localhost:5173",
      ]);
      expect(isTrustedOrigin("http://127.0.0.1:5173", origins)).toBe(true);
      expect(isTrustedOrigin("http://localhost:5173", origins)).toBe(true);
    },
  );

  it("adds only the matching loopback port in development", () => {
    const origins = trustedOrigins({
      nodeEnv: "development",
      appOrigin: "http://localhost:8080",
    });
    expect([...origins].sort()).toEqual([
      "http://127.0.0.1:8080",
      "http://localhost:8080",
    ]);
    expect(isTrustedOrigin("http://localhost:5173", origins)).toBe(false);
  });

  it.each(["test", "production"] as const)(
    "keeps %s strict unless additional origins are explicitly configured",
    (nodeEnv) => {
      const origins = trustedOrigins({
        nodeEnv,
        appOrigin: "http://127.0.0.1:5173",
      });
      expect([...origins]).toEqual(["http://127.0.0.1:5173"]);
      expect(isTrustedOrigin("http://localhost:5173", origins)).toBe(false);
    },
  );

  it("does not add local aliases for a remote development application", () => {
    const origins = trustedOrigins({
      nodeEnv: "development",
      appOrigin: "https://operations.example",
    });
    expect([...origins]).toEqual(["https://operations.example"]);
  });

  it("accepts only explicitly configured additional origins in production", () => {
    const origins = trustedOrigins({
      nodeEnv: "production",
      appOrigin: "https://operations.example",
      additionalOrigins: "https://dispatch.example,http://localhost:5173",
    });
    expect(isTrustedOrigin("https://operations.example", origins)).toBe(true);
    expect(isTrustedOrigin("https://dispatch.example", origins)).toBe(true);
    expect(isTrustedOrigin("http://localhost:5173", origins)).toBe(true);
    expect(isTrustedOrigin("http://127.0.0.1:5173", origins)).toBe(false);
  });

  const invalidHeaders: (string | undefined)[] = [
    undefined,
    "",
    "null",
    "*",
    "https://attacker.invalid",
    "http://localhost:5174",
    "https://localhost:5173",
    "http://127.0.0.2:5173",
    "http://127.0.0.1:3001",
    "http://localhost:5173.attacker.invalid",
    "http://localhost:5173/path",
    "http://localhost:5173?redirect=attacker",
    "http://localhost:5173#fragment",
    "http://user:password@localhost:5173",
    "http://localhost:5173, https://attacker.invalid",
    "not a URL",
  ];
  it.each(invalidHeaders)(
    "rejects malformed or untrusted request Origin %s",
    (origin) => {
      const origins = trustedOrigins({
        nodeEnv: "development",
        appOrigin: "http://127.0.0.1:5173",
      });
      expect(isTrustedOrigin(origin, origins)).toBe(false);
    },
  );

  it.each([
    "*",
    "null",
    "file:///operations",
    "https://*.example",
    "https://operations.example/path",
    "https://user:password@operations.example",
    "https://operations.example?query=value",
    "https://operations.example#fragment",
  ])("rejects invalid trusted-origin configuration %s", (additionalOrigins) => {
    expect(() =>
      trustedOrigins({
        nodeEnv: "production",
        appOrigin: "https://operations.example",
        additionalOrigins,
      }),
    ).toThrow();
  });
  it.each([
    "*",
    "ftp://operations.example",
    "https://user:password@operations.example",
    "https://operations.example/path",
  ])("rejects invalid primary application origin %s", (appOrigin) => {
    expect(() =>
      trustedOrigins({ nodeEnv: "production", appOrigin }),
    ).toThrow();
  });
});
