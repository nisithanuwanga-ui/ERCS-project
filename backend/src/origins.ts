type OriginSettings = {
  nodeEnv: "development" | "test" | "production";
  appOrigin: string;
  additionalOrigins?: string;
};

function exactOrigin(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hostname.includes("*") ||
    url.origin !== value
  )
    throw new Error(
      `Expected an exact HTTP(S) origin without a path, credentials, query, or fragment.`,
    );
  return url.origin;
}

/** Trust configured origins, with a same-port loopback alias in development only. */
export function trustedOrigins(settings: OriginSettings): ReadonlySet<string> {
  const primary = exactOrigin(settings.appOrigin);
  const allowed = new Set([primary]);
  if (settings.additionalOrigins) {
    for (const value of settings.additionalOrigins.split(",")) {
      if (!value.trim())
        throw new Error("TRUSTED_ORIGINS contains an empty origin.");
      allowed.add(exactOrigin(value.trim()));
    }
  }
  const url = new URL(primary);
  if (
    settings.nodeEnv === "development" &&
    ["localhost", "127.0.0.1"].includes(url.hostname)
  ) {
    url.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
    allowed.add(url.origin);
  }
  return allowed;
}

/** Do not normalize request headers: paths, null, missing or multiple origins fail closed. */
export function isTrustedOrigin(
  origin: string | undefined,
  allowed: ReadonlySet<string>,
): boolean {
  return typeof origin === "string" && allowed.has(origin);
}
