import express from "express";
import type { ErrorRequestHandler } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { config } from "./config.js";
import { pool } from "./database.js";
import { authenticate, HttpError } from "./security.js";
import { authRouter, equalToken } from "./modules/auth.js";
import { operations } from "./modules/operations.js";
import { dashboard } from "./modules/dashboard.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    const id = randomUUID();
    res.setHeader("X-Request-Id", id);
    res.on("finish", () => {
      if (config.NODE_ENV !== "test")
        console.log(
          JSON.stringify({
            id,
            method: req.method,
            path: req.path,
            status: res.statusCode,
          }),
        );
    });
    next();
  });
  app.get("/api/health/live", (_req, res) =>
    res.json({ data: { status: "ok" } }),
  );
  app.get("/api/health/ready", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ data: { status: "ready" } });
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  const Store = pgSession(session);
  app.use(
    session({
      store: new Store({ pool, createTableIfMissing: false }),
      name: "ercs.sid",
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.NODE_ENV === "production",
        maxAge: 8 * 3600000,
      },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("Origin") !== config.APP_ORIGIN)
        return next(
          new HttpError(403, "This request origin is not allowed.", "CSRF"),
        );
      const token = req.get("X-CSRF-Token");
      if (!token || !req.session.csrf || !equalToken(token, req.session.csrf))
        return next(
          new HttpError(
            403,
            "Your security token expired. Refresh and retry.",
            "CSRF",
          ),
        );
    }
    next();
  });
  app.use("/api/auth", authRouter);
  app.use("/api", authenticate, dashboard, operations);
  app.use((_req, _res, next) =>
    next(new HttpError(404, "Endpoint not found.")),
  );
  const errors: ErrorRequestHandler = (error, req, res, _next) => {
    let status = 500;
    let message = "The server could not complete this request.";
    let code = "INTERNAL_ERROR";
    if (error instanceof HttpError) {
      status = error.status;
      message = error.message;
      code = error.code;
    } else if (error instanceof ZodError) {
      status = 400;
      code = "VALIDATION";
      message = error.issues
        .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
        .join(" ");
    } else if (error.code === "23505") {
      status = 409;
      message = "A record or active assignment already exists.";
      code = "CONFLICT";
    } else if (["23503", "23514", "22P02"].includes(error.code)) {
      status = 400;
      message = "The record contains an invalid reference or quantity.";
      code = "VALIDATION";
    } else if (["55P03", "40P01", "40001"].includes(error.code)) {
      status = 409;
      message = "Another operation changed this record. Retry your action.";
      code = "CONFLICT";
    } else if (error.type === "entity.parse.failed") {
      status = 400;
      message = "Invalid JSON.";
    } else if (error.type === "entity.too.large") {
      status = 413;
      message = "Request is too large.";
    }
    if (status === 500)
      console.error(
        JSON.stringify({
          event: "request_error",
          requestId: res.getHeader("X-Request-Id"),
          code: error.code,
          path: req.path,
        }),
      );
    res
      .status(status)
      .json({
        error: { code, message, requestId: res.getHeader("X-Request-Id") },
      });
  };
  app.use(errors);
  return app;
}
