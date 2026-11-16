# ERCS setup and deployment

## Local development

Requirements: Node.js 24, npm, and PostgreSQL 18 (or the development-only embedded PostgreSQL helper). The helper starts an actual PostgreSQL server; it does not emulate the database.

```sh
npm ci
npm run dev:database
```

Keep that terminal running. It initializes `.local-db/data`, binds PostgreSQL to loopback port 55432, and creates ignored `.env` configuration only when no `.env` exists. It does not replace existing database configuration. In a second terminal:

```sh
npm run db:migrate
npm run db:provision-dev
npm run dev:full
```

Open **http://127.0.0.1:5173/** or **http://localhost:5173/**. In `NODE_ENV=development`, a loopback `APP_ORIGIN` trusts both names on its configured port. The API listens on 3001; Vite proxies relative `/api` requests while preserving the browser's Origin. Vite uses port 5173 with `strictPort` so a busy port cannot silently move the UI outside the allowlist. Development administrator credentials are written once to ignored `.local-db/administrator.txt`. The provisioning helper refuses hosted/nondevelopment databases. It inserts no operational demo records. Keep the database process running while using the application.

`APP_ORIGIN` must be an exact HTTP(S) origin (scheme, hostname, and port; no trailing slash, path, credentials, query, or fragment). Optional `TRUSTED_ORIGINS` adds comma-separated exact origins; wildcards are rejected. Test and production modes add no automatic aliases. Production should use the intended HTTPS origin and only explicitly approved additional origins. No CORS wildcard or browser-origin rewriting is used. CSRF tokens remain bound to their session cookies; switching hostname creates a separate browser session, so sign in on the hostname you intend to use. See [origin fix verification](AUTH-ORIGIN-FIX.md).

The administrator can invite a coordinator and resource manager from User management. Activation requires the invited email and one-time token; roles are assigned by the administrator. Invitation links are returned once and must be shared privately with the intended recipient. No email delivery service or public account signup is implied. The administrator does not have operational approval powers.

For an existing PostgreSQL server, copy `.env.example` to `.env`, configure the actual connection and a random session secret of at least 32 characters, and run migrations. Database connection strings stay on the backend. Never prefix secrets with `VITE_`.

## Controlled first administrator

For a new hosted database, set `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`, and `BOOTSTRAP_PASSWORD` securely in the process environment and run `npm run db:bootstrap` after migrations. Passwords require at least 12 characters with uppercase, lowercase and a number. Remove bootstrap variables immediately afterwards. Bootstrap refuses to proceed if an active administrator already exists. There is no default production password.

Existing-account password recovery is intentionally not exposed. Define an authenticated administrator identity-verification/reset process before introducing recovery. Users with current access can change their own password; all prior sessions are revoked.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
npm run build:api
```

Integration tests create an isolated PostgreSQL cluster and persist its directory under ignored `.test-db-*` for failure investigation. They never point at the development database. In CI use a **fresh disposable** `TEST_DATABASE_URL`; the test suite applies migrations and inserts test users, so this database must not contain operational data. Browser tests use another isolated cluster, API port 3005, and frontend port 5175. They include desktop/mobile screenshots and reduced-motion checks. Do not run two copies of the browser suite simultaneously. Docker daemon is required for container verification.

## Local Docker Compose

The original untracked root Dockerfile is preserved. Use the explicitly named new Dockerfiles in `deploy/`.

Set `POSTGRES_PASSWORD` and a random `SESSION_SECRET` in the environment or ignored `.env`. Then:

```sh
docker compose up --build -d
docker compose ps
```

Compose starts PostgreSQL, applies migrations once, starts the API, and serves the frontend at **http://localhost:8080/** after health checks. This is local HTTP development: Compose sets `NODE_ENV=development` so browser cookies can work without HTTPS. It is **not** a production security configuration. `TRUST_PROXY=1` is safe only while the API is reachable through the specified trusted proxy and cannot be contacted directly by untrusted clients.

For bootstrap in Compose, pass bootstrap variables through your secure execution environment to the API container and execute `node backend/dist/backend/src/bootstrap.js`. Never put passwords in checked-in Compose files or shell history. Use the CLI directly against the database if that is easier in your deployment tooling.

## Production cloud deployment

1. Provision managed PostgreSQL with TLS, backups, network restrictions, and separate migration-owner and runtime roles. Do not expose its port publicly.
2. Build `deploy/backend.Dockerfile` and `deploy/frontend.Dockerfile`. Run frontend and API on a private container network. Configure `/api` reverse proxy routing and SPA fallback for all application routes.
3. Terminate HTTPS at a trusted ingress; preserve the real scheme to Express. The provided nginx config assumes direct local HTTP. For production behind a TLS ingress, set the forwarded scheme deliberately from that trusted ingress, or terminate TLS at nginx; do not blindly trust client-supplied forwarding headers.
4. Configure `NODE_ENV=production`, exact HTTPS `APP_ORIGIN`, random persistent `SESSION_SECRET`, runtime `DATABASE_URL`, and justified proxy trust. SameSite=Lax and HttpOnly cookies are always used; Secure cookies are enabled in production. No broad CORS is needed for the same-origin UI.
5. Run the compiled migration entrypoint as a single release job using the migration-owner database credential. The checksum-tracked migration lock prevents concurrent migration execution. Migrations do not run on API startup.
6. Grant the runtime role SELECT/INSERT/UPDATE as needed, DELETE on session and team-membership rows, and SELECT/INSERT only on audit/history/movement/release ledgers. Do not grant DDL, role administration, or ledger UPDATE/DELETE. See `deploy/runtime-grants.sql`.
7. Bootstrap the first administrator, remove bootstrap secrets, and provision operational accounts through invitations. Test HTTPS login, CSRF protection, logout, role restrictions, readiness and an allocation/return workflow in staging.
8. Configure process/container restart, resource limits, request limits, structured log collection and alerting on readiness failures. Scale login rate limiting requires a shared rate-limit store at ingress or in the API; the current limiter is per process.

No live cloud release has been made. Hosting provider, domain, managed database configuration and deployment authorization are needed to verify this stage. Do not expose a local development server as production.

## Backup and recovery

Enable managed point-in-time recovery and encrypted backups. Define retention and access policies with the organization. Exercise restoration into an isolated staging database, check inventory reconciliation and audit records, and record restore time. Backup PostgreSQL data and schema, not just frontend assets. Avoid running database binaries on OneDrive-synchronized folders in production; the project-local database is development-only.

Before migrations, take a verified backup and rehearse the upgrade against a restored copy. The first migration creates the schema; a rollback must restore the database snapshot or use a reviewed forward migration. Never drop operational history as a rollback shortcut. Application rollback must remain compatible with the deployed schema. Keep a previous image digest and validate API readiness after a rollback.
