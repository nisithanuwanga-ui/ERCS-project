import { Router } from "express";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { audit, pool, transaction } from "../database.js";
import { authenticate, HttpError, publicUser, userOf } from "../security.js";
import { passwordSchema } from "../validation.js";
import { config } from "../config.js";
import { demoAccountBlocked } from "../demo-policy.js";
export const authRouter = Router();
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Too many attempts. Please try again later." } },
});
authRouter.get("/csrf", (req, res) => {
  req.session.csrf ??= randomBytes(32).toString("hex");
  res.json({ data: { token: req.session.csrf } });
});
authRouter.post("/login", limiter, async (req, res) => {
  const v = z
    .object({
      email: z.email().transform((x) => x.toLowerCase()),
      password: z.string().min(1).max(128),
      remember: z.boolean().default(false),
    })
    .strict()
    .parse(req.body);
  const user = (
    await pool.query("SELECT * FROM users WHERE email=$1", [v.email])
  ).rows[0];
  const valid = user
    ? await argon2.verify(user.password_hash, v.password)
    : await argon2.verify(await dummyHash, v.password);
  if (!valid || !user?.active || demoAccountBlocked(config.NODE_ENV, user)) {
    await transaction((db) =>
      audit(db, null, "auth.login_failed", "auth", null),
    );
    throw new HttpError(
      401,
      "Invalid credentials or account unavailable. Contact your administrator if you need help.",
    );
  }
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
  req.session.userId = user.id;
  req.session.version = user.session_version;
  req.session.csrf = randomBytes(32).toString("hex");
  req.session.cookie.maxAge = v.remember ? 7 * 86400000 : 8 * 3600000;
  await new Promise<void>((resolve, reject) =>
    req.session.save((e) => (e ? reject(e) : resolve())),
  );
  await transaction((db) => audit(db, user.id, "auth.login", "users", user.id));
  res.json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      is_demo: user.is_demo,
    },
  });
});
const dummyHash = argon2.hash(randomBytes(32));
authRouter.get("/me", authenticate, (req, res) =>
  res.json({ data: userOf(req) }),
);
authRouter.post("/logout", authenticate, async (req, res) => {
  await transaction((db) =>
    audit(db, userOf(req).id, "auth.logout", "users", userOf(req).id),
  );
  await new Promise<void>((resolve, reject) =>
    req.session.destroy((e) => (e ? reject(e) : resolve())),
  );
  res.clearCookie("ercs.sid", { path: "/" });
  res.json({ data: { ok: true } });
});
authRouter.post("/activate", limiter, async (req, res) => {
  const v = z
    .object({
      token: z.string().min(32).max(200),
      email: z.email().transform((x) => x.toLowerCase()),
      name: z.string().trim().min(2).max(100),
      password: passwordSchema,
    })
    .strict()
    .parse(req.body);
  const hash = await argon2.hash(v.password);
  await transaction(async (db) => {
    const invitation = (
      await db.query(
        "SELECT * FROM invitations WHERE token_hash=$1 AND email=$2 FOR UPDATE",
        [hashToken(v.token), v.email],
      )
    ).rows[0];
    if (
      !invitation ||
      invitation.accepted_at ||
      new Date(invitation.expires_at) < new Date()
    )
      throw new HttpError(
        400,
        "This invitation is invalid, expired, or already used.",
      );
    const user = (
      await db.query(
        `INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING ${publicUser}`,
        [v.name, v.email, hash, invitation.role],
      )
    ).rows[0];
    await db.query("UPDATE invitations SET accepted_at=now() WHERE id=$1", [
      invitation.id,
    ]);
    await audit(db, user.id, "auth.activated", "users", user.id);
  });
  res.status(201).json({ data: { ok: true } });
});
authRouter.post("/change-password", authenticate, limiter, async (req, res) => {
  const v = z
    .object({
      current_password: z.string().min(1).max(128),
      password: passwordSchema,
    })
    .strict()
    .parse(req.body);
  const user = userOf(req);
  const current = (
    await pool.query("SELECT password_hash FROM users WHERE id=$1", [user.id])
  ).rows[0];
  if (!(await argon2.verify(current.password_hash, v.current_password)))
    throw new HttpError(400, "Current password is incorrect.");
  const hash = await argon2.hash(v.password);
  await transaction(async (db) => {
    await db.query(
      "UPDATE users SET password_hash=$1,session_version=session_version+1,updated_at=now() WHERE id=$2",
      [hash, user.id],
    );
    await audit(db, user.id, "auth.password_changed", "users", user.id);
  });
  await new Promise<void>((resolve, reject) =>
    req.session.destroy((e) => (e ? reject(e) : resolve())),
  );
  res.clearCookie("ercs.sid", { path: "/" });
  res.json({ data: { ok: true } });
});
export function equalToken(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
