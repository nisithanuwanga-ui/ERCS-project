# Login origin validation fix — 2026-11-11

## Root cause

The mutation middleware mounted on `/api` in `backend/src/app.ts` compared `req.get("Origin")` against the single `config.APP_ORIGIN`. The existing development `.env` specified `http://127.0.0.1:5173`, so browser login from `http://localhost:5173` was rejected before credentials were checked. The error code is `CSRF`, with message `This request origin is not allowed.`

The React API client uses relative `/api` URLs with credentials and the session CSRF token. Vite forwards these to the API on port 3001. No cross-origin browser API call or Express CORS middleware is involved. Adding CORS headers alone would not fix this rejection.

## Changes

- `backend/src/origins.ts`: exact-origin validation and allowlist construction. Development adds only the other loopback hostname on the primary configured port. Test/production stay explicit; optional `TRUSTED_ORIGINS` supports approved comma-separated origins. Wildcards, paths, credentials, query strings, fragments, and malformed values fail configuration validation.
- `backend/src/config.ts`: validates the new optional setting and derives `ALLOWED_ORIGINS` at startup.
- `backend/src/app.ts`: uses exact membership in that allowlist. The session-bound, timing-safe CSRF token check remains mandatory, including for login and logout.
- `vite.config.ts`: explicit loopback binding, port 5173, strict port selection, and a proxy that preserves Origin. API target remains 127.0.0.1:3001 unless explicitly configured for a test fixture.
- `.env.example`, `docs/API.md`, `docs/DEPLOYMENT.md`: explain configuration and cookie isolation between hostnames. The existing private `.env` did not need changing.
- `backend/tests/origins.test.ts`, `scripts/integration.ts`, `e2e/auth-origins.spec.ts`, and `scripts/e2e-server.ts`: regression coverage and an explicit localhost origin for the disposable browser fixture.

Authentication, authorization, rate limits, session ID/token rotation, HttpOnly, SameSite=Lax, host-only cookies, and production Secure cookies remain enabled. Missing Origin is rejected for mutations. The browser's Origin is never replaced with the expected value.

## Executed verification

- `npm run typecheck`: passed.
- `npm test`: **48 unit tests passed**, including 35 origin configuration/matching cases.
- `npm run test:integration`: **30 PostgreSQL checks passed**, including both allowed hostnames; hostile/null/missing/wrong-port/wrong-scheme origins; missing, invalid, cross-session, and sessionless CSRF tokens; invalid credentials; cookie flags; session/token rotation; logout and protected API denial. Existing operational integration checks remain included.
- `npx playwright test e2e/auth-origins.spec.ts`: **3 browser scenarios passed**. The disposable fixture uses ports 5175/3005. Its localhost browser DNS is explicitly pinned to its IPv4 fixture because an unrelated IPv6 listener was receiving those test requests; actual browser Origin still remains localhost. Debug headers/logging were removed.
- Independent live Chromium checks on the existing application's **5173/3001** services used the saved development administrator, without DNS overrides. Both `http://127.0.0.1:5173` and `http://localhost:5173` returned login 200, redirected to `/dashboard`, retained authentication after reload, retained HttpOnly/Lax cookies, logged out successfully, returned 401 from `/api/auth/me` after logout, and redirected protected `/incidents` visits to `/login`.
- Live HTTP checks on both port-5173 origins: CSRF 200, login 200, identity 200, dashboard API 200, logout 200, then identity 401.
- Existing PostgreSQL `ercs` on loopback 55432 answered queries. The saved administrator exists, is active, and its password hash matches the saved local credential. No credentials were printed, accounts reset, or operational records seeded/deleted. Login/logout naturally create audit entries. PostgreSQL was already running; a redundant startup attempt did not create another server.
- `npm run build` and `npm run build:api`: passed. The existing nonfatal frontend bundle-size warning remains.

Use a single hostname for a given browser session. The two hostnames are trusted independently and intentionally do not share host-only session cookies.
