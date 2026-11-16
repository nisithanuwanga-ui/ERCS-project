import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, clearCsrf } from "./api";

const fetchMock = vi.fn<typeof fetch>();
function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

beforeEach(() => {
  clearCsrf();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("API retry feedback and authentication security", () => {
  it("exposes the server cooldown without automatically retrying login", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: { token: "session-csrf" } }))
      .mockResolvedValueOnce(
        json(
          { error: { message: "Try again later.", retryAfterSeconds: 45 } },
          429,
          { "Retry-After": "45" },
        ),
      );
    await expect(
      api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "user@example.test",
          password: "unchanged password ",
        }),
      }),
    ).rejects.toMatchObject({
      status: 429,
      message: "Try again later.",
      retryAfterSeconds: 45,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const request = fetchMock.mock.calls[1][1]!;
    expect(request.credentials).toBe("include");
    expect(new Headers(request.headers).get("X-CSRF-Token")).toBe(
      "session-csrf",
    );
    expect(JSON.parse(String(request.body)).password).toBe(
      "unchanged password ",
    );
  });

  it("reads Retry-After when a rate-limited response has no JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": "12" },
      }),
    );
    await expect(api("/auth/me")).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 12,
    });
  });

  it("supports a Retry-After HTTP date", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 10, 12, 0, 0, 0));
    fetchMock.mockResolvedValueOnce(
      json({ error: { message: "Wait." } }, 429, {
        "Retry-After": "Thu, 12 Nov 2026 00:00:30 GMT",
      }),
    );
    await expect(api("/auth/me")).rejects.toMatchObject({
      retryAfterSeconds: 30,
    });
  });

  it("propagates cooldown feedback when the CSRF session endpoint is limited", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { message: "Slow down." } }, 429, { "Retry-After": "20" }),
    );
    await expect(api("/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 20,
      message: "Slow down.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches a fresh session token after a CSRF rejection", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: { token: "old-token" } }))
      .mockResolvedValueOnce(
        json({ error: { code: "CSRF", message: "Token expired." } }, 403),
      )
      .mockResolvedValueOnce(json({ data: { token: "new-token" } }))
      .mockResolvedValueOnce(json({ data: { ok: true } }));
    await expect(api("/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 403,
    });
    await expect(api("/auth/login", { method: "POST" })).resolves.toEqual({
      data: { ok: true },
    });
    expect(
      new Headers(fetchMock.mock.calls[3][1]!.headers).get("X-CSRF-Token"),
    ).toBe("new-token");
  });

  it("retains invalid-credential feedback without treating it as a cooldown", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { message: "Invalid credentials." } }, 401),
    );
    const error = await api("/auth/login").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      message: "Invalid credentials.",
      retryAfterSeconds: undefined,
    });
  });

  it("does not dispatch session-expiry navigation for throttling", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    fetchMock.mockResolvedValueOnce(
      json({ error: { message: "Wait." } }, 429, { "Retry-After": "5" }),
    );
    await expect(api("/incidents")).rejects.toMatchObject({ status: 429 });
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
