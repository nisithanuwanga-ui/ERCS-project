# Emergency Resource Coordination System

React + strict TypeScript + Vite frontend, Express/TypeScript REST API, and PostgreSQL persistence. Includes a light-theme public site, original generated illustration, authorized invitation activation, server sessions and RBAC, operational dashboard charts, incidents, inventory, requests, allocation/return transactions, teams, shortages, audit, user administration and account settings.

```sh
npm ci
npm run dev:database
# In another terminal:
npm run db:migrate
npm run db:provision-dev
npm run dev:full
```

Open **http://127.0.0.1:5173/**. Development administrator credentials are stored in ignored `.local-db/administrator.txt`. Invite operational users through User management. No operational mock records are seeded. Keep the database terminal running.

- [Local setup, Docker and cloud deployment](docs/DEPLOYMENT.md)
- [REST API](docs/API.md)
- [Permissions and lifecycle rules](docs/PERMISSIONS.md)
- [Database relationships and transaction design](docs/DATA-MODEL.md)
- [Repository audit and phase plan](docs/IMPLEMENTATION-PLAN.md)
- [Management workspaces and API additions](docs/WORKSPACE-UPGRADE.md)
- [Generated asset and prompt](docs/ASSETS.md)

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run build`, and `npm run build:api`. Browser tests require `npx playwright install chromium`. Integration/browser fixtures use disposable databases only. See the verification log for actual results and outstanding deployment checks.

The separate proposal and previously completed Home Page were not present in the supplied workspace; implementation follows the detailed supplied specification and retains the original login source. Hosting and production acceptance remain dependent on staging/deployment verification.
