# Implementation and verification log

Date: 2026-11-08. This log distinguishes implemented source from verified behavior and deployed behavior. The original repository contained a simulated login UI, not the separate Home Page or proposal referenced by the request. The newer detailed request authorized the new light-theme public design and invitation flow.

## Milestones and changed areas

| Phase | Implemented areas | Evidence and acceptance limits |
|---|---|---|
| 1 — Public design | `src/pages/HomePage.tsx`, `AuthPage.tsx`, `src/styles/app.css`, generated operations-center image, branding metadata | Public desktop/mobile navigation, image load, reduced motion and 404 pass browser tests. Home screenshot visually inspected. Original login content and source retained. Separate proposal/Home source unavailable. |
| 2 — Shared shell | `src/components/ui.tsx`, `layout/AppLayout.tsx`, `workspace.css`, router, API hook/client, schema-driven forms/tables | Protected routes, responsive drawer and operational navigation exercised by browser tests. Loading/error/empty states implemented. Native modal dialog contains focus. Full WCAG certification has not been performed. |
| 3 — Authentication | Session store, CSRF/origin check, Argon2, login/logout/password, authorized invitations, user administration | Backend login, logout, invalid roles, disabled users, actual session expiry, password revocation, one-time activation and role injection tests pass. Browser activation-to-login uncovered retained component state; route keys fix it, but this final fix awaits an approved browser rerun. |
| 4 — Dashboard | PostgreSQL summary queries and Recharts trend/bar/donut graphs, timeframe controls, activity and urgent incidents | Real summary/trend queries pass integration tests. Browser dashboard navigation passes; empty datasets do not show invented metrics. Route chunks lazy-load. Prior dashboard screenshot captured a loading state; screenshot test now waits for chart heading, pending rerun. |
| 5 — Incidents | Domain router, lifecycle/history/update actions, list/create/detail/edit views | Backend create/update, reporter derivation, scope, lifecycle and closure guards pass. Browser incident creation and navigation pass. |
| 6 — Inventory | Resource domain router, generated availability, movements, list/create/detail/edit and threshold fields | Negative stock, indivisible capacity, total-below-allocation and inventory accounting checks pass. Browser resource creation and inventory-after-return pass. |
| 7 — Requests | Scoped submission, review/approve/reject/cancel, cumulative issue tracking and history | Backend transitions, rejection reason, own cancellation and approval-without-issuance pass. Browser submit/review/approve passes. |
| 8 — Allocations | Row-locked service, idempotency ledger, partial issue, immutable returns/movements and modal | PostgreSQL checks pass for same-request demand races, different-request stock races, concurrent duplicate keys, concurrent excess returns, replay conflicts, rollback and ledger reconciliation. Complete browser allocate/return/inventory/audit workflow passes. |
| 9 — Teams | Teams/members, single active assignment index, scope and progress updates | Backend assignment conflict and field scope pass. Browser team create/assign/progress/edit and module navigation pass. |
| 10 — Administration | User invite/edit/role/activation, roles matrix, shortages, readonly audit, profile/security, references | Backend role/user/last-admin/audit/activation tests pass. Roles UI and invitation creation pass within browser scenario; remaining profile/settings browser actions were not reached before the activation navigation failure. Code for these actions is present; final browser verification remains pending. |
| 11 — Quality | Unit, integration and Playwright suites; strict TS; responsive checks | See exact results below. Browser suite must be rerun after the final route-state fix. |
| 12 — Delivery | New frontend/backend Dockerfiles, Compose, health checks, CI, API and deployment guides | Production builds pass. Docker engine unavailable, so container runtime not verified. CI workflow has not run on GitHub. No cloud deployment, managed DB TLS, ingress, or restore verification performed. |

## Actual executed results

- `npm run typecheck`: passed for frontend and backend.
- `npm run lint`: passed without warnings after cleanup.
- `npm test`: **9 passed**, using explicit Vitest configuration to exclude Playwright files. A prior run mistakenly collected browser tests; this was corrected and rerun successfully.
- `npm run test:integration`: **21 checks passed** against a real isolated PostgreSQL server. The runner now uses an OS-assigned port and explicitly reports startup failures; earlier fixed-port conflicts are not counted as passes.
- `npm run test:e2e`: the original three scenarios passed. Expanded suite: **4 passed, 1 failed**. Passing: public/mobile/reduced-motion; full incident-to-return workflow; invalid credentials/viewer RBAC; team creation/assignment/edit/navigation. Failing: administration scenario reached successful activation, then the login form was hidden by retained activation-success state. Distinct route keys fix that behavior in source. The subsequent browser rerun was rejected by the approval system; **do not claim all five pass**.
- `npm run build`: passed. Vite reports a nonfatal initial-chunk warning (~530 KB minified, ~159 KB gzip); chart/feature chunks are separated. Further bundle optimization remains possible.
- `npm run build:api`: passed.
- `npm audit fix` and dependency installation audit: zero known vulnerabilities reported at installation time. This is not a substitute for later dependency scans.
- HTTP checks: frontend `http://127.0.0.1:5173/` returned 200; proxied `/api/health/ready` returned `ready` with the local development PostgreSQL server running.
- Docker CLI exists but cannot connect to the Docker Desktop engine. No successful image/container or Compose runtime result is claimed.

## Local demonstration

The local database and API were started with `npm run dev:database` and `npm run dev:api`; the Vite server is on 5173. A single development administrator was provisioned using the loopback-only helper; credentials are in ignored `.local-db/administrator.txt`. No operational fixture records were inserted in the development database. Unit/integration/browser test records use separate disposable databases.

Demonstration roles: administrator invites coordinator and Resource Manager, each activates using their assigned email/token. Coordinator creates incident and request and reviews it. Resource Manager adds inventory, allocates approved demand and returns usable resources. Coordinator views the activity/audit record. Separate roles are intentional; the administrator cannot bypass operational approvals.

## Remaining acceptance work

1. Run `npm run test:e2e` after the final activation/login route-state fix, and review dashboard/mobile screenshots after the added readiness waits. This rerun was not approved in this session.
2. Start Docker engine and verify `docker compose up --build`, health ordering, SPA fallback, proxy, migration job and both images.
3. Reconcile role visibility, cancellation/consumable policies and any omitted requirements with the actual ERCS proposal.
4. Choose production provider/domain and configure hosted PostgreSQL, least-privilege credentials, HTTPS, shared rate limiting, backups and restoration. Verify staging before releasing.

All source work remains uncommitted for review. Existing untracked root Dockerfile was preserved. This is a substantial implemented local application; it is not yet a fully accepted production deployment.
