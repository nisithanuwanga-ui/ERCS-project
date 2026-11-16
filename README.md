# ERCS team integration

The complete React/TypeScript frontend is under `frontend/`. The teammate's existing Express/PostgreSQL backend remains under `backend/`. Docker, Nginx and CI configuration are separate from both implementations.

The source frontend's Home, Login, account activation, Dashboard, incident/resource/request/allocation/team workspaces, Profile, Settings, administration, charts, animations, images and styles are preserved. Current working backend functionality is incident CRUD plus health checks. Authentication and the other API dependencies are documented in [API requirements](docs/API-REQUIREMENTS.md); protected pages retain their real sign-in guard.

## Local frontend development

```sh
cd frontend
npm ci
npm run dev
```

Vite serves `http://127.0.0.1:5173` and proxies `/api` to `http://127.0.0.1:5000`. Copy `frontend/.env.example` locally to change that target. Do not place secrets in `VITE_*` values.

The teammate's existing backend setup remains: configure an untracked `backend/.env` using its existing example, install with `npm ci`, and run `npm run dev` from `backend/`. Its existing migration command is `npm run db:migrate`; apply it only to an intended disposable/development database. This contribution does not migrate an existing team database.

## Verification

```sh
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Browser tests use a real API proxy and do not simulate successful authentication. Install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome` / `msedge` for an installed browser. `PLAYWRIGHT_BASE_URL` targets an already-running frontend such as the local Compose stack; otherwise Playwright starts Vite. For backend-integrated tests, start the real backend first and set `API_TARGET` if its port differs.

From the root, `node scripts/verify-backend.mjs` verifies all nine backend source/configuration hashes. See [verification results](docs/VERIFICATION.md), [transfer inventory](docs/frontend-transfer-manifest.json), and [changed files](docs/CHANGED-FILES.md).

## Docker and CI

Follow [Docker instructions](docker/README.md) for local PostgreSQL or the existing external database. CI validates frontend/backend builds, container builds, real disposable incident CRUD, and supported browser flows. The separate image-publication workflow is manual.

Work branch: `samhi-frontend-docker`. The original `devops` folder is the untouched backup; none of its legacy backend implementation is included here.
