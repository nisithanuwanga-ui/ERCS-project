import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAuthRateLimiter } from "../src/auth-rate-limit";

// Exercise the real middleware and production thresholds independently of
// credentials/CSRF, which have separate PostgreSQL integration coverage.
function authenticationEndpoints() {
  const app = express();
  const handled = { login: 0, activation: 0, "password change": 0 };
  app.use(express.json());
  for (const [path, action] of [
    ["/login", "login"],
    ["/activate", "activation"],
    ["/change-password", "password change"],
  ] as const) {
    app.post(path, createAuthRateLimiter(action), (req, res) => {
      handled[action]++;
      if (req.body.accepted === true) {
        res.status(action === "activation" ? 201 : 200).json({ ok: true });
      } else {
        res.status(req.body.invalid ? 400 : 401).json({ error: "Rejected" });
      }
    });
  }
  return { app, handled };
}

describe("authentication attempt limits", () => {
  it("does not lock out repeated successful sign-ins", async () => {
    const { app, handled } = authenticationEndpoints();
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await request(app)
        .post("/login")
        .send({ accepted: true });
      expect(response.status).toBe(200);
    }
    expect(handled.login).toBe(20);
  });

  it("blocks the sixteenth failed sign-in with an actionable retry time", async () => {
    const { app, handled } = authenticationEndpoints();
    for (let attempt = 0; attempt < 15; attempt++) {
      expect(
        (await request(app).post("/login").send({ accepted: false })).status,
      ).toBe(401);
    }
    const blocked = await request(app).post("/login").send({ accepted: false });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("AUTH_RATE_LIMITED");
    const retry = blocked.body.error.retryAfterSeconds;
    expect(Number.isInteger(retry)).toBe(true);
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(15 * 60);
    expect(Number(blocked.headers["retry-after"])).toBe(retry);
    expect(blocked.body.error.message).toMatch(/attempt|sign.in/i);
    expect(handled.login).toBe(15);
  });

  it("keeps failed attempts counted when a later sign-in succeeds", async () => {
    const { app } = authenticationEndpoints();
    for (let attempt = 0; attempt < 14; attempt++) {
      expect(
        (await request(app).post("/login").send({ accepted: false })).status,
      ).toBe(401);
    }
    expect(
      (await request(app).post("/login").send({ accepted: true })).status,
    ).toBe(200);
    expect(
      (await request(app).post("/login").send({ accepted: false })).status,
    ).toBe(401);
    expect(
      (await request(app).post("/login").send({ accepted: false })).status,
    ).toBe(429);
  });

  it("keeps login, activation, and password-change budgets independent", async () => {
    const { app, handled } = authenticationEndpoints();
    for (const path of ["/activate", "/change-password"]) {
      for (let attempt = 0; attempt < 15; attempt++) {
        expect(
          (await request(app).post(path).send({ accepted: false })).status,
        ).toBe(401);
      }
      expect(
        (await request(app).post(path).send({ accepted: false })).status,
      ).toBe(429);
    }
    expect(
      (await request(app).post("/login").send({ accepted: true })).status,
    ).toBe(200);
    expect(handled).toEqual({
      login: 1,
      activation: 15,
      "password change": 15,
    });
  });

  it("counts validation failures toward the same bounded attempt budget", async () => {
    const { app } = authenticationEndpoints();
    for (let attempt = 0; attempt < 15; attempt++) {
      expect(
        (await request(app).post("/login").send({ invalid: true })).status,
      ).toBe(400);
    }
    expect(
      (await request(app).post("/login").send({ invalid: true })).status,
    ).toBe(429);
  });

  it("does not run credential verification while the cooldown is active", async () => {
    const { app, handled } = authenticationEndpoints();
    for (let attempt = 0; attempt < 15; attempt++) {
      await request(app).post("/login").send({ accepted: false });
    }
    const blocked = await request(app).post("/login").send({ accepted: true });
    expect(blocked.status).toBe(429);
    expect(handled.login).toBe(15);
  });
});
