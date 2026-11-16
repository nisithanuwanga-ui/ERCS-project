# Backend API requirements

This is the handoff for the backend teammate. No backend source, schema or configuration was changed by this contribution. All paths below include `/api`. Missing services remain unavailable; the frontend supplies no substitute user, session or production records.

## Existing contract connected by the frontend

| Method | Endpoint | Actual response |
|---|---|---|
| GET | `/api/health` | `{ success, message, timestamp }` |
| GET | `/api/db-health` | `{ success, database, databaseTime }`, or HTTP 503 |
| GET | `/api/incidents` | `{ success: true, incidents: [...] }` |
| GET | `/api/incidents/:id` | `{ success: true, incident: {...} }` |
| POST | `/api/incidents` | HTTP 201, `{ success: true, incident: {...} }` |
| PATCH | `/api/incidents/:id` | `{ success: true, incident: {...} }` |
| DELETE | `/api/incidents/:id` | HTTP 204, empty body |

Incident creation requires `title`, `description`, `incident_type` and `location`. Optional existing fields: `severity`, `status`, `latitude`, `longitude`. Status values are `reported`, `investigating`, `responding`, `resolved`, `closed`; severity is `low`, `medium`, `high`, `critical`. IDs are positive integers, normalized to strings for frontend links. Latitude/longitude validation and database error handling remain the teammate implementation.

The adapter normalizes incident responses to the existing frontend `{ data }` / `{ data, meta }` interface. Search, incident type, severity, status, location, date range (`from`, `to`), oldest/newest ordering and pagination operate in the browser on the complete real incident collection. They are not server-side pagination. `open` and `completed` are collection filters grouping actual status values. Priority/category-ID/team filters are reported as unsupported instead of silently ignoring them. Missing priority, codes, assignments and history are never invented.

## Missing authentication — blocks protected workspaces

| Method | Exact endpoint | Existing frontend request / expected result |
|---|---|---|
| GET | `/api/auth/csrf` | `{ data: { token } }` |
| GET | `/api/auth/me` | `{ data: User }`; HTTP 401 for no session |
| POST | `/api/auth/login` | `{ email, password, remember }` -> `{ data: User }` |
| POST | `/api/auth/logout` | End the real server session |
| POST | `/api/auth/activate` | `{ token, name, email, password }` |
| POST | `/api/auth/change-password` | `{ current_password, password }` |

`User` is the existing frontend interface `{ id, name, email, role, active, is_demo? }`. Existing display roles: `administrator`, `coordinator`, `resource_manager`, `field_officer`, `viewer`. The backend owner must implement and enforce permissions; frontend visibility checks are not authorization.

The preserved flows send `credentials: include`, JSON bodies and `X-CSRF-Token` for mutations other than the current incident CRUD routes, which have no CSRF/session middleware. Successful sign-in clears the cached token. A CSRF error must use HTTP 403 and `{ error: { code: "CSRF", message } }`. A rate limit must use HTTP 429 with `Retry-After` and/or `error.retryAfterSeconds`. Non-auth HTTP 401 expires the frontend session.

The teammate backend currently has no sessions, CSRF or role enforcement and its CORS configuration does not enable credentialed cross-origin requests. Development Vite and production Nginx use a same-origin `/api` proxy. If direct cross-origin browser access is introduced, agree on the exact allowed origin, credentials and cookie settings with the backend owner. No fake login or guard bypass was added.

## Missing management endpoints

| Feature | Exact endpoints required by preserved frontend |
|---|---|
| Incident summaries | `GET /api/incidents/summary` |
| Resources | `GET /api/resources`, `POST /api/resources`, `GET /api/resources/:id`, `PATCH /api/resources/:id`, `GET /api/resources/summary` |
| Resource requests | `GET /api/resource-requests`, `POST /api/resource-requests`, `GET /api/resource-requests/:id`, `PATCH /api/resource-requests/:id`, `GET /api/resource-requests/summary` |
| Allocations | `GET /api/allocations`, `POST /api/allocations`, `GET /api/allocations/:id`, `GET /api/allocations/summary` |
| Response teams | `GET /api/teams`, `POST /api/teams`, `GET /api/teams/:id`, `PATCH /api/teams/:id`, `GET /api/teams/summary` |
| Inventory adjustment | `POST /api/resources/:id/adjustments` with `{ quantity_delta, reason }` |
| Request review/cancellation | `PATCH /api/resource-requests/:id/status` with `{ status, reason? }` |
| Allocation return | `POST /api/allocations/:id/releases` with `{ quantity, reason }` and `Idempotency-Key` |
| Team assignment | `POST /api/incidents/:id/team-assignments` with `{ team_id }` |
| Assignment changes | `PATCH /api/team-assignments/:id` with `{ status }` |
| Incident notes | `POST /api/incidents/:id/updates` with `{ note }` |

Creation/edit fields already used by `frontend/src/features/modules.ts`:

- Resource: `name, category_id, description, kind, total_quantity, threshold, status, location`.
- Request: `incident_id, resource_id, category_id, quantity, priority, justification` (exactly one resource or category).
- Allocation: `request_id, resource_id, quantity`, plus `Idempotency-Key`.
- Team: `name, type_id, lead_id, member_ids, contact, status`.

Preserved list views expect `{ data: RecordData[], meta: { total, page, pageSize } }`; detail views expect `{ data: RecordData, details? }`. Summary widgets read `data.counts`, `data.distribution`, `data.secondary` and, where applicable, `data.activity`. The teammate should agree these shapes against the TypeScript consumers before implementation. Implement summary routes before generic `/:id` routes; the current `/api/incidents/summary` is captured by the incident-ID route and returns HTTP 400.

## Other exact missing endpoints

| Method | Endpoint |
|---|---|
| GET | `/api/dashboard/summary?days=7` or `?days=30` |
| GET | `/api/people` |
| GET | `/api/reference-data` |
| GET | `/api/shortages` |
| PATCH | `/api/profile` (profile reads use /api/auth/me; update body: `{ name }`) |
| POST | `/api/settings/reference-data` with `{ kind, name }` |
| PATCH | `/api/settings/reference-data/:id` with `{ active }` |
| GET, POST | `/api/users` (invitation: `{ email, role }`) |
| GET, PATCH | `/api/users/:id` |
| GET | `/api/audit-logs` |

Dashboard charts consume `counts`, `trends`, `resourceAvailability`, `requestPriority`, `allocationActivity`, `teamAvailability`, `shortageCategories`, `urgent`, `urgentRequests`, `resourceAlerts`, and `generatedAt`. Exact field interfaces are preserved in `frontend/src/features/Dashboard.tsx` and `frontend/src/components/layout/HeaderNotifications.tsx`.

Inventory/request/team forms also need reference records and eligible-choice queries. Preserve query parameters and server-side permission filtering used by `RecordEditor.tsx`, `ManagementWorkspaces.tsx`, and `RecordDetails.tsx`; do not return fabricated choices.

## Completion boundary

Home, login and activation UIs and all workspace routes are preserved. Real incident API operations are verified independently. Successful login, Dashboard data, role-controlled navigation and the other management mutations remain blocked by the missing APIs above. Browser tests verify public navigation, real failed submissions and that all protected routes still require authentication; they do not claim successful protected workflows.
