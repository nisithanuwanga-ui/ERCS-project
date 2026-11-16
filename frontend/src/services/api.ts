import { incidentPage, normalizeIncident } from "./incident-contract";

export class ApiError extends Error {
  status: number;
  retryAfterSeconds?: number;
  endpoint?: string;
  constructor(status: number, message: string, retryAfterSeconds?: number, endpoint?: string) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.endpoint = endpoint;
  }
}
function retryDelay(res: Response, value: unknown): number | undefined {
  if (res.status !== 429) return undefined;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.max(1, Math.ceil(value));
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = /^\d+(?:\.\d+)?$/.test(header) ? Number(header) : (Date.parse(header) - Date.now()) / 1000;
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : undefined;
}
type Body = Record<string, unknown> & { error?: { message?: string; code?: string; retryAfterSeconds?: number }; errors?: string[]; message?: string; data?: { token?: string }; incidents?: Record<string, unknown>[]; incident?: Record<string, unknown> };
async function request(url: string, options: RequestInit): Promise<{ res: Response; body: Body }> {
  let res: Response;
  try { res = await fetch(url, { ...options, credentials: "include" }); }
  catch { throw new ApiError(0, "Unable to reach ERCS. Check your connection and try again.", undefined, (options.method ?? "GET") + " " + url); }
  const body = await res.json().catch(() => ({})) as Body;
  return { res, body };
}
function errorFor(res: Response, body: Body, method: string, url: string) {
  const missing = res.status === 404 && !body.message && !body.error;
  return new ApiError(res.status,
    body.error?.message ?? body.message ?? body.errors?.join(" ") ??
      (missing ? "This service is not available yet. Please contact your ERCS administrator." : "The server could not complete this request."),
    retryDelay(res, body.error?.retryAfterSeconds), method + " " + url);
}
let csrf = "";
async function token() {
  if (!csrf) {
    const { res, body } = await request("/api/auth/csrf", { method: "GET" });
    if (!res.ok) throw errorFor(res, body, "GET", "/api/auth/csrf");
    if (!body.data?.token) throw new ApiError(502, "The server returned an invalid security token.");
    csrf = body.data.token;
  }
  return csrf;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const parsed = new URL(path, "http://ercs.internal");
  const incidentRoute = /^\/incidents(?:\/[1-9]\d*)?$/.test(parsed.pathname);
  // Only the teammate's current incident routes omit session/CSRF middleware.
  if (!["GET", "HEAD"].includes(method) && !incidentRoute) headers.set("X-CSRF-Token", await token());
  const { res, body } = await request("/api" + path, { ...options, method, headers });
  if (!res.ok) {
    if (res.status === 403 && body.error?.code === "CSRF") csrf = "";
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event("ercs:expired"));
    if (parsed.pathname === "/incidents/summary" && res.status === 400) {
      throw new ApiError(res.status, "Incident summary data is not available from the server yet.", undefined, "GET /api" + parsed.pathname);
    }
    throw errorFor(res, body, method, "/api" + path);
  }
  if (res.status === 204) return undefined as T;
  if (incidentRoute) {
    if (method === "GET" && parsed.pathname === "/incidents") {
      if (!Array.isArray(body.incidents)) throw new ApiError(502, "The server returned an invalid incident list.");
      try { return incidentPage(body.incidents, parsed.searchParams) as T; }
      catch (error) { throw new ApiError(422, (error as Error).message); }
    }
    if (body.incident) return { data: normalizeIncident(body.incident) } as T;
    throw new ApiError(502, "The server returned an invalid incident.");
  }
  return body as T;
}
export function clearCsrf() { csrf = ""; }
