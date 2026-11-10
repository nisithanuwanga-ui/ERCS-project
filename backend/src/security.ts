import type { NextFunction, Request, Response } from "express";
import type { User, Permission } from "../../shared/domain.js";
import { can } from "../../shared/domain.js";
import { pool } from "./database.js";
import { config } from "./config.js";
import { demoAccountBlocked } from "./demo-policy.js";
declare module "express-session" {
  interface SessionData {
    userId: string;
    version: number;
    csrf: string;
  }
}
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.session.userId)
      throw new HttpError(401, "Please sign in to continue.");
    const user = (
      await pool.query(
        "SELECT id,name,email,role,active,is_demo,session_version FROM users WHERE id=$1",
        [req.session.userId],
      )
    ).rows[0];
    if (
      !user?.active ||
      user.session_version !== req.session.version ||
      demoAccountBlocked(config.NODE_ENV, user)
    )
      throw new HttpError(401, "Your session has expired.");
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      is_demo: user.is_demo,
    };
    next();
  } catch (e) {
    next(e);
  }
}
export function permit(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !can(req.user.role, permission))
      return next(new HttpError(403, "Your role does not permit this action."));
    next();
  };
}
export function userOf(req: Request): User {
  if (!req.user) throw new HttpError(401, "Authentication required.");
  return req.user;
}
export const publicUser = "id,name,email,role,active,is_demo";
export function incidentScope(
  user: User,
  alias = "i",
  index = 1,
): { sql: string; params: unknown[] } {
  return user.role === "field_officer"
    ? {
        sql: `(${alias}.reporter_id=$${index} OR EXISTS(SELECT 1 FROM team_assignments ta JOIN response_teams t ON t.id=ta.team_id WHERE ta.incident_id=${alias}.id AND ta.status NOT IN ('completed','cancelled') AND (t.lead_id=$${index} OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=$${index}))))`,
        params: [user.id],
      }
    : { sql: "TRUE", params: [] };
}
export async function requireIncident(
  db: { query: typeof pool.query },
  id: string,
  user: User,
  lock = false,
) {
  const scope = incidentScope(user, "i", 2);
  const result = await db.query(
    `SELECT i.* FROM incidents i WHERE i.id=$1 AND ${scope.sql}${lock ? " FOR UPDATE OF i" : ""}`,
    [id, ...scope.params],
  );
  if (!result.rows[0])
    throw new HttpError(
      404,
      "Incident not found or unavailable to your account.",
    );
  return result.rows[0];
}
