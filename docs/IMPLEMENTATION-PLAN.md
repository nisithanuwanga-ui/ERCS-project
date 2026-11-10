# ERCS implementation plan and repository audit

Audit date: 2026-11-08. Baseline commit: `824aa55`.

**Implementation update:** The later request authorized the medium-light redesign and invitation activation. The application has now been implemented against that specification. This file preserves the initial audit and proposed design; see `ARCHITECTURE.md` for the actual design and `VERIFICATION.md` for completed checks and remaining acceptance limits. The primary proposal still was not supplied.

## Source of truth and current status

The supplied attachment contains the implementation specification, but references a separate ERCS proposal and completed Home Page. Neither is present in this workspace or the attachment directory. Confirm their location, or explicitly confirm that the supplied specification and existing login interface are the intended baseline, before implementing proposal-dependent behavior. This document is a proposed design, not a claim that any operational feature exists.

The repository is a React 19 / TypeScript / Vite application with lucide-react icons and plain CSS. `src/App.tsx` renders `LoginPage` directly. There is no router, API client, backend, database schema, migration system, automated test suite, CI workflow, or deployment guide. README describes a login UI, consistent with the inspected source and latest commit.

Existing files to preserve:

- `src/pages/LoginPage.tsx`: existing branded login layout.
- `src/components/auth/*`: brand, network illustration, indicators, form, security notice.
- `src/styles/auth.css`: navy surfaces, blue actions, green operational indicators, red danger, typography and responsive rules.
- `src/assets/hero.png` and public icons.
- Root `Dockerfile`: untracked user file; do not overwrite.

The login form validates locally and then simulates success using timers. It has no security boundary. Remember-session checkbox, recovery link, footer links, and status labels have no corresponding backend behavior. These must be connected or clearly removed from functional claims during authentication work. No existing Home Page was identified; do not invent or overwrite one.

Reuse CSS variables `--bg-primary`, `--bg-secondary`, `--bg-surface`, `--color-primary`, `--color-danger`, `--color-success`, `--text-main`, `--text-secondary`, and `--border-color`. Global `body { overflow: hidden; height: 100vh }` needs careful shell-specific scrolling so operational pages remain usable without changing login appearance.

## Baseline verification

- `npm run build`: passed; TypeScript and Vite production build completed.
- `npm run lint`: completed with one existing `react(set-state-in-effect)` warning in `src/components/auth/EmergencyNetwork.tsx:30`.
- No tests exist; authentication, database, accessibility, responsive rendering, Docker, and deployment have not been verified.
- Windows sandbox process creation failed with `helper_sandbox_lock_failed`; baseline inspection and commands required approved escalation.

## Remaining page inventory

All rows below are pending unless marked otherwise. A view is accepted only after UI, API, database, authorization, and applicable tests pass.

| # | View / action | Route | Module |
|---|---|---|---|
| 1 | Existing Home Page: locate and preserve | `/` | Public |
| 2 | Login: existing UI, authentication pending | `/login` | Auth |
| 3 | Access denied | `/403` | Errors |
| 4 | Not found | `*` | Errors |
| 5 | Session expired | `/session-expired` | Auth |
| 6 | Operational dashboard | `/dashboard` | Dashboard |
| 7 | Incident list | `/incidents` | Incidents |
| 8 | Create incident | `/incidents/new` | Incidents |
| 9 | Incident details, history and operational updates | `/incidents/:id` | Incidents |
| 10 | Edit incident | `/incidents/:id/edit` | Incidents |
| 11 | Inventory list | `/resources` | Resources |
| 12 | Add resource | `/resources/new` | Resources |
| 13 | Resource details and movements | `/resources/:id` | Resources |
| 14 | Edit resource | `/resources/:id/edit` | Resources |
| 15 | Request list | `/resource-requests` | Requests |
| 16 | Submit request | `/resource-requests/new` | Requests |
| 17 | Request details and history | `/resource-requests/:id` | Requests |
| 18 | Review / approve / reject / cancel | `/resource-requests/:id/review` | Requests |
| 19 | Allocation list | `/allocations` | Allocations |
| 20 | Create partial/full allocation | `/allocations/new` | Allocations |
| 21 | Allocation details | `/allocations/:id` | Allocations |
| 22 | Release / return with confirmation | `/allocations/:id` action | Allocations |
| 23 | Team list | `/teams` | Teams |
| 24 | Create team | `/teams/new` | Teams |
| 25 | Team details and history | `/teams/:id` | Teams |
| 26 | Edit team / membership | `/teams/:id/edit` | Teams |
| 27 | Team assignment management | `/teams/:id/assignments` | Teams |
| 28 | User list | `/admin/users` | Admin |
| 29 | Authorized account provisioning | `/admin/users/new` | Admin |
| 30 | Edit user / role / activation | `/admin/users/:id/edit` | Admin |
| 31 | Permission matrix | `/admin/roles` | Admin |
| 32 | Read-only audit logs | `/audit-logs` | Audit |
| 33 | User profile | `/profile` | Profile |
| 34 | Change password | `/profile/security` | Auth |
| 35 | Reference data and configuration | `/settings` | Settings |
| 36 | Supply and outstanding demand | `/shortages` | Shortages |

Every operational list needs server pagination, search, sorting and relevant filters. Every view needs loading, empty, error, permission-denied and session-expiry states. Mutations need validated inputs, pending state, visible feedback and refetch. Dialogs require focus management and keyboard access. Do not add notification badges without real events.

## Architecture and file plan

Keep the current frontend at repository root. Add `backend/` rather than moving existing application files. Use React Router, a typed same-origin fetch client, centralized auth context, feature modules, and shared accessible controls. Use Express/TypeScript with `pg` parameterized SQL and versioned SQL migrations; transaction-sensitive workflows stay in services sharing one checked-out database client. Choose validation/session/hash libraries after checking maintained official documentation and installed runtime compatibility.

Planned paths:

- `src/app/`, `src/routes/`: router, providers, error boundary and protected routes.
- `src/components/{layout,ui,forms,tables,feedback}/`: shell, accessible primitives and shared states.
- `src/features/{auth,dashboard,incidents,resources,requests,allocations,teams,admin,audit,profile,shortages,settings}/`.
- `src/services/`: typed API client, response types and session error handling.
- `backend/src/{config,database,middleware,shared,types}/`.
- `backend/src/modules/{auth,users,roles,incidents,resources,resource-requests,allocations,teams,dashboard,shortages,audit,settings}/`: module routes, validation, controllers, services, repositories and types.
- `backend/migrations/`, `backend/tests/`, frontend tests, and `e2e/`.
- `.env.example`, backend Dockerfile, separate frontend Dockerfile, Compose, nginx configuration, CI, API documentation and deployment guide.

## Permissions and scope

The proposed matrix is in `PERMISSIONS.md`; it explicitly distinguishes administrator configuration powers from operational decision powers. These are conservative implementation assumptions pending the proposal. Every handler must enforce permission and record scope; sidebar visibility is supplementary. Field officers see assigned incidents and associated records, plus their own requests. The proposal must resolve whether viewers have organization-wide or narrower visibility.

## API conventions

Same-origin `/api` behind the production reverse proxy. Use JSON `{ data, meta? }`; errors `{ error: { code, message, fields?, requestId } }`. Paginated lists accept bounded `page`, `pageSize`, allowlisted `sort`, `q` and module filters, returning `total`. Validate UUIDs, enums, lengths, integer quantities, date ranges, category references and body size. Unknown fields must be rejected for privileged mutations.

| Module | Endpoints | Authorization |
|---|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/csrf`, `POST /auth/change-password` | Login public and rate-limited; remaining endpoints session-scoped |
| Dashboard | `GET /dashboard/summary` | Operational read scope |
| Incidents | `GET/POST /incidents`, `GET/PATCH /incidents/:id`, `POST /incidents/:id/updates` | Read / create / manage / scoped update |
| Resources | `GET/POST /resources`, `GET/PATCH /resources/:id` | Read / inventory manage |
| Requests | `GET/POST /resource-requests`, `GET /resource-requests/:id`, `PATCH /resource-requests/:id/status` | Scoped read/create; coordinator review; scoped cancellation |
| Allocations | `GET/POST /allocations`, `GET /allocations/:id`, `POST /allocations/:id/releases` | Read / allocation manage |
| Teams | `GET/POST /teams`, `GET/PATCH /teams/:id`, `POST /incidents/:id/team-assignments`, `PATCH /team-assignments/:id` | Read / team manage / assignment manage |
| Admin | `GET/POST /users`, `GET/PATCH /users/:id`, `POST /users/:id/password-initialization`, `GET /roles` | Administrator only |
| Audit | `GET /audit-logs` | Audit read |
| Profile | `GET/PATCH /profile` | Own profile, allowlisted fields only |
| Settings | `GET /reference-data`, `POST/PATCH /settings/:kind` | Authenticated reference reads; administrator writes |
| Shortages | `GET /shortages` | Operational scope |
| Health | `GET /health/live`, `GET /health/ready` | Minimal public health response, no credentials |

Every path above is prefixed by `/api`. No public registration, arbitrary permission grants, record deletion, or invented recovery flow. Use dedicated action endpoints rather than unrestricted allocation PATCH.

## Dependency order and milestone contracts

| Phase | Tasks and files | Database / API / permission changes | Acceptance criteria |
|---|---|---|---|
| 1 | This audit; resolve missing sources; backend package/config/app/server, migration runner, frontend router | Schema and references in `DATA-MODEL.md`; health endpoints | Existing UI preserved; strict typechecks; migration round trip against disposable PostgreSQL; health behavior tested |
| 2 | Auth module, session store, password utilities, auth provider, login integration, shell/error routes | Users, roles, sessions; auth endpoints; permission middleware | Real login/logout/expiry; CSRF and origin protection; disabled users rejected; denied routes tested; no demo success |
| 3 | Dashboard repository/service/page/cards | Scoped aggregate queries; summary permission | Database-derived counts reconcile with fixtures; empty/error states; scoped access tests |
| 4 | Incident module/forms/list/details/history | Incidents, status history, updates; incident permissions | CRUD, transitions, filtering, pagination, scope and atomic audit tests |
| 5 | Resource module/forms/list/details | Resources, categories, movements; inventory permissions | Count invariants, asset constraints, invalid changes and authorized CRUD tests |
| 6 | Request module/forms/review/history | Requests and history; decision permissions | Transitions enforced; rejection reason; no approval-as-fulfillment; scoped request tests |
| 7 | Allocation module/forms/release dialog | Allocations, releases, idempotency, movements; allocation permissions | Concurrent allocation/release and retry tests; rollback; partial fulfillment; no oversupply or negative inventory |
| 8 | Team module/membership/assignment views | Teams, members, assignments; team permissions | Conflicting assignment prevented; scoped field updates; history and release tests |
| 9 | User module/provisioning/roles UI | Guarded role/user mutations; initialization flow | Last-admin and concurrent admin-change protection; session revocation; no hash exposure/escalation |
| 10 | Shortages, audit, profile, settings | Scoped demand queries and reference data APIs | Real supply/demand, readonly audit, validated profile/password/reference changes |
| 11 | Integration/E2E/security/accessibility suites | Disposable database fixtures only | Complete multi-role workflow; session, concurrency, keyboard and responsive checks; lint/typecheck/test/build |
| 12 | Containers, CI, deployment and demonstration | Migration job, secrets configuration, backups | Container health and routing verified; CI runs real database tests and builds; deployment runbook tested where credentials allow |

Before each phase, expand its row into exact files, migrations, endpoints, permissions and test cases. After each phase, append executed commands, actual results and unresolved issues to a milestone log. Do not mark a phase complete based on file presence.

## Security and deployment constraints

Store sessions in PostgreSQL, opaque identifiers in HttpOnly cookies, rotate on login, enforce expiry and revoke on password/role/activation changes. Production cookies require Secure and appropriate SameSite policy. Validate CSRF token and Origin on cookie-authenticated mutations. Do not persist authentication secrets in frontend storage. Rate-limit login, hash passwords using an established password library, use constant-shape invalid-credential errors, and redact sensitive data from structured logs. Account-disabled feedback must not become a public enumeration endpoint.

Protect the last active administrator with a transaction-level lock during account/role changes. Bootstrap the first administrator through a controlled CLI using environment/input secrets, never a production default password or public endpoint. Define initialization/reset delivery before exposing reset UI.

Use least-privilege runtime database credentials, a separate migration role, TLS to hosted PostgreSQL, environment validation and no committed secrets. Test schema changes locally/disposably before any hosted migration. Hosted destructive operations require explicit approval. Production release needs actual hosting/database configuration and a concrete reviewable build. Backup restoration, health checks, migration ordering and rollback instructions are required.

## Pending inputs

1. The separate proposal and Home Page location, or confirmation of the supplied specification/current UI as baseline.
2. Hosted PostgreSQL and deployment target configuration will be needed for deployment verification. Local disposable PostgreSQL can support development first; never request secrets in source files or chat.

Current completed work: repository audit, baseline build/lint, and draft implementation design. No operational module or phase is claimed complete.
