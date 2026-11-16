# Docker and deployment

Both Dockerfiles use the project root as build context and copy only the matching project subtree. The backend image builds the teammate's unchanged code; it contains `dist/` and the original `sql/` required by `node dist/migrate.js`.

## Local PostgreSQL stack

Copy the root `.env.example` to an untracked `.env` and replace `POSTGRES_PASSWORD` with a generated hexadecimal value. For example, `node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"` generates a URL-safe value. Never commit the result.

From the project root:

```sh
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Visit `http://localhost:8080`. API and database readiness are proxied at `/api/health` and `/api/db-health`. The database has no published host port. The one-shot migration service runs only the teammate's original SQL against the Compose database. Service dependencies wait for database health, successful migration and database-backed API health.

Run the destructive CRUD smoke check only against this disposable local database:

```sh
# Set ERCS_TEST_MUTATIONS=1 and ERCS_API_URL=http://127.0.0.1:8080/api/
node scripts/smoke-incidents.mjs
```

`docker compose down` stops the stack and preserves its named PostgreSQL volume. No normal cleanup command removes the volume.

## Existing PostgreSQL / Neon

Put the existing connection string, including its SSL parameters, in your untracked root `.env` as `DATABASE_URL`. Use the standalone external configuration:

```sh
docker compose -f compose.external.yaml config --quiet
docker compose -f compose.external.yaml up --build -d
```

This configuration has no database or migration service. It does not apply schema changes on startup. The backend retains its actual PostgreSQL connection implementation. Do not run mutation smoke tests against an existing team database.

## Browser and networking behavior

Nginx preserves React history routes, proxies `/api/` to `backend:5000`, forwards server errors unchanged and caches hashed assets. The Vite development proxy also defaults to port 5000; override `API_TARGET` locally if needed. The frontend contains no database credentials or replacement backend.

## Automation

`ci.yml` installs locked frontend/backend dependencies, runs frontend TypeScript/lint/unit/build checks and the teammate backend TypeScript/build checks, verifies backend hashes, then builds and starts an isolated Compose stack for real incident CRUD and browser tests. The backend's existing `npm test` command is a failing placeholder and is not described as a test suite.

`images.yml` is a manually triggered GHCR publication workflow. It publishes commit-tagged frontend and backend images only when explicitly run on `samhi-frontend-docker`. It has not been triggered by this integration. No server, cloud account or runtime deployment target has been invented.

Authentication and several management APIs are missing. See `docs/API-REQUIREMENTS.md`; healthy containers do not imply those unavailable features are implemented.
