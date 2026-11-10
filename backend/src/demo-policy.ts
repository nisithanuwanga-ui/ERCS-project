/** Public example identities are reserved for explicit local demo seeding. */
export const demoEmails = [
  "admin@ercs.demo",
  "coordinator@ercs.demo",
  "resources@ercs.demo",
  "officer@ercs.demo",
  "viewer@ercs.demo",
] as const;

export function demoAccountBlocked(
  environment: string,
  user: { is_demo?: boolean; email: string },
) {
  return (
    environment === "production" &&
    (user.is_demo === true ||
      (demoEmails as readonly string[]).includes(user.email.toLowerCase()))
  );
}

export function assertLocalDemoEnvironment(
  environment: string,
  databaseUrl: string,
) {
  if (environment !== "development" && environment !== "test")
    throw new Error(
      "Demo seeding is restricted to development and test environments.",
    );
  const url = new URL(databaseUrl);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]", "::1"].includes(
      url.hostname.toLowerCase(),
    )
  )
    throw new Error(
      "Demo seeding requires a loopback PostgreSQL connection, never a hosted database.",
    );
  if (
    [...url.searchParams.keys()].some((key) =>
      ["host", "hostaddr", "service"].includes(key.toLowerCase()),
    )
  )
    throw new Error(
      "Demo seeding does not accept a host override in the connection query.",
    );
}
