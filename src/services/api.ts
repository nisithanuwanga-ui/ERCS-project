export class ApiError extends Error {
  status: number;
  retryAfterSeconds?: number;
  constructor(status: number, message: string, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function retryDelay(res: Response, value: unknown): number | undefined {
  if (res.status !== 429) return undefined;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return Math.max(1, Math.ceil(value));
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = /^\d+(?:\.\d+)?$/.test(header)
    ? Number(header)
    : (Date.parse(header) - Date.now()) / 1000;
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : undefined;
}
let csrf = "";
async function token() {
  if (!csrf) {
    const res = await fetch("/api/auth/csrf", { credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        body.error?.message ??
          "Cannot connect to the server. Please try again.",
        retryDelay(res, body.error?.retryAfterSeconds),
      );
    }
    csrf = (await res.json()).data.token;
  }
  return csrf;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD"].includes(method))
    headers.set("X-CSRF-Token", await token());
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      0,
      "Unable to reach ERCS. Check your connection and try again.",
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403 && body.error?.code === "CSRF") csrf = "";
    if (res.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("ercs:expired"));
    throw new ApiError(
      res.status,
      body.error?.message ?? "The server could not complete this request.",
      retryDelay(res, body.error?.retryAfterSeconds),
    );
  }
  return body as T;
}
export function clearCsrf() {
  csrf = "";
}
