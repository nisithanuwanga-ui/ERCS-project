# Implemented architecture and documented assumptions

The supplied workspace originally rendered only a simulated login interface. A separate Home Page or ERCS proposal was not available. The current implementation follows the detailed specification in the conversation, with the newer light-theme and invitation requirements taking precedence over the initial preserve-only design request. The original login components remain as legacy source; the application router uses `AuthPage`, which calls the real backend.

## Frontend

Root Vite/React/strict TypeScript project is retained. `src/App.tsx` owns React Router routes and lazy feature loading. `src/app/` owns the authentication provider and shared context. `src/services/api.ts` sends same-origin cookie-authenticated requests, manages CSRF tokens, normalizes errors and handles expired sessions. `src/hooks/useApi.ts` manages loading/error/refetch state and discards stale results. Mutations explicitly refetch or navigate to a fresh detail query; no frontend fixture arrays back production operational views.

`src/features/modules.ts` defines reusable form/list metadata for operational modules. RecordList, RecordEditor and RecordDetails implement shared presentation, validation feedback, permission-aware actions and linked records. Dashboard and Shortages use Recharts with server-derived series. Administration contains reference settings, role matrix, profile and password views. AppLayout provides responsive navigation, breadcrumbs, incident search, account and logout. Dialog uses native modal `<dialog>` for focus containment and Escape behavior.

The public site and authentication illustration is an original imagegen asset; no claim is made that it photographs an actual ERCS deployment. CSS uses the requested blue/teal/light-slate palette, responsive layouts, small hover/floating/reveal effects and a reduced-motion override. The original login styling is not globally imported by active routes.

## Backend

Express 5 / strict TypeScript. `app.ts` composes headers, bounded JSON, logging, rate limits, PostgreSQL session store, origin/CSRF checking, authentication, domain routers and sanitized errors. `config.ts` validates required environment values. `database.ts` centralizes pooled connections, transaction ownership and audit/history insertion. `security.ts` enforces permissions and incident scope. Domain modules separate authentication, administration, incidents, resources, requests, allocations, teams, dashboard and shared read queries. Allocation services own transaction/locking/idempotency behavior. Read query definitions allowlist SQL identifiers; all client values are parameterized.

The implementation uses direct `pg` SQL to make row-lock ordering and transactional behavior visible. There is no ORM migration or alternate database backend. `backend/migrations/001_initial.sql` is the actual schema; migration checksums and a transaction-level advisory lock protect migration execution. Migrations are separate from API startup.

## Schema choices relative to the initial draft

- Fixed `roles` table and shared explicit permission grants replace optional editable permission tables. No user can submit arbitrary permission overrides.
- One `reference_data` table with validated `kind` stores incident categories, resource categories and team types.
- One append-only `history` table stores incident/request lifecycle and incident updates, rather than separate near-identical history tables.
- `session` uses the PostgreSQL session-store schema; `invitations` stores only hashes of 48-hour activation tokens.
- `resources.available_quantity` is a generated column; allocated quantity is constrained between zero and total.
- Immutable allocation releases and inventory movements retain operational accounting history. Request `issued_quantity` records cumulative issuance; returns never reopen demand.
- System settings currently manage authorized reference values. Per-resource thresholds are maintained by Resource Managers. Priorities, permissions and lifecycle definitions are fixed and documented; no unsupported integration/configuration switches are exposed.

## Business policy assumptions

Single organization. Authorized viewers can read operational records but not user administration, audits or team contact information. Field officers see incidents they reported or are currently assigned to and their own teams; request scope additionally includes their own submissions. Coordinators manage teams and incident lifecycle. Resource Managers own inventory. Both coordinators and Resource Managers can allocate approved demand and return resources. Administrators configure users/reference data but do not automatically approve or allocate. These rules require reconciliation with the missing proposal before organizational production acceptance.

Each team has at most one active assignment, enforced by a partial unique index. Incident lifecycle is sequential; resolving/closing requires no outstanding requests, allocations or team work. Requests require review before decision; rejection needs a reason. Post-approval cancellation is not supported because its inventory/demand semantics were not defined. Returns record usable stock; damaged stock needs an explicit inventory adjustment by a Resource Manager. Stock quantities are integer units; asset records represent a single indivisible item. Consumable disposal/loss accounting requires a separately defined workflow.

## Remaining production verification

Local development and disposable database tests are separate from production. Docker/Compose runtime behavior cannot be accepted until a Docker engine is available. Hosted PostgreSQL TLS/roles, cloud ingress/cookies, backup restoration, CI execution and live deployment must be verified in the chosen environment. Multi-instance login rate limiting requires a shared store or ingress enforcement. No hosted resource was provisioned or existing cloud database changed by this work.
