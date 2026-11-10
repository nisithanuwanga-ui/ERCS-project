export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
let csrf = "";
async function token() {
  if (!csrf) {
    const res = await fetch("/api/auth/csrf", { credentials: "include" });
    if (!res.ok)
      throw new ApiError(
        res.status,
        "Cannot connect to the server. Please try again.",
      );
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
    );
  }
  return body as T;
}
export function clearCsrf() {
  csrf = "";
}
