# ERCS REST API

Base: `/api`. Responses use `{data, meta?}` and failures `{error:{code,message,requestId}}`. JSON input is bounded to 32 KB. UUIDs, integer quantities, references, enum states, and unknown fields on mutation bodies are validated. All operational paths require a live authorized session.

List queries: `page` (default 1), `pageSize` (1–100, default 15), `q`, `sort=newest|oldest`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, and supported `status`, `priority`, `category_id`, or `incident_id` filters. Responses include `meta.total`, `meta.page`, and `meta.pageSize`. Detail responses include `details` with related histories/records. No operational DELETE endpoints exist.

Incident `status=open` groups reported, active and controlled records. Request `status=awaiting_review` groups pending and under-review records. These match the respective dashboard KPI queries. Inventory supports location/category filters; users support role/activation; audit supports exact actor/action/entity filters. Allocation selectors use `eligible=true` on request lists and `request_id` on resource lists to find approved outstanding demand and matching operational supply.

## Authentication and CSRF

Login, activation, and password change each have an independent IP-based budget of 15 unsuccessful requests per 15 minutes. Successful responses do not consume this failed-attempt quota. The general API request limit still applies to all traffic. Authentication cooldown responses return HTTP 429 with `Retry-After` and `error: { code: "AUTH_RATE_LIMITED", message, retryAfterSeconds }`. The login form displays the remaining wait, preserves entered values, and allows manual retry after expiry; it never automatically resubmits credentials.

`GET /auth/csrf` starts a session and returns `data.token`. Every mutation, including login and activation, must send `X-CSRF-Token` and an exact allowlisted `Origin`, with the session cookie. `APP_ORIGIN` is always trusted; optional `TRUSTED_ORIGINS` adds explicit comma-separated origins. Development adds only the localhost/127.0.0.1 counterpart on the primary loopback origin's port; test/production add no aliases automatically. Missing, null, malformed, wrong-port, or untrusted origins return 403 even with a valid token. Fetch a new token after login because the session ID and token rotate. Cookies are host-only, HttpOnly, SameSite=Lax and Secure in production. Remembered sessions expire after 7 days of inactivity; default sessions after 8 hours. Session version checks revoke access after password, role or activation changes. Frontend stores no authentication token in localStorage.

| Method | Path | Input / behavior |
|---|---|---|
| POST | `/auth/login` | `{email,password,remember}`; rate-limited; returns public user |
| GET | `/auth/me` | Public authenticated identity |
| POST | `/auth/logout` | Destroys session and clears cookie |
| POST | `/auth/activate` | `{token,email,name,password}`; single-use unexpired invitation; cannot select role |
| POST | `/auth/change-password` | `{current_password,password}`; revokes all sessions |

## Operational modules

| Method | Path | Permission / input |
|---|---|---|
| GET | `/dashboard/summary?days=7..90` | Scoped real counts, daily incident trend, priority distribution, resource categories, allocation activity, team readiness, recent incidents and activity |
| GET | `/incidents`, `/incidents/:id` | Operational read; field officer scope enforced |
| POST | `/incidents` | `incidents.create`; `{title,category_id,description,severity,priority,location}`; reporter and timestamp derived server-side |
| PATCH | `/incidents/:id` | `incidents.manage`; partial incident fields plus lifecycle `status` |
| POST | `/incidents/:id/updates` | Coordinator or scoped field officer; `{note}` |
| GET | `/resources`, `/resources/:id` | Authorized operational read |
| POST/PATCH | `/resources`, `/resources/:id` | `resources.manage`; `{name,category_id,description,kind,total_quantity,status,location,threshold}`; allocated/available counts cannot be directly set |
| GET | `/resource-requests`, `/resource-requests/:id` | Scoped operational read |
| POST | `/resource-requests` | `requests.create`; `{incident_id,resource_id?,category_id?,quantity,priority,justification}`; exactly one resource/category |
| PATCH | `/resource-requests/:id/status` | `{status,reason?}`; coordinator reviews; creator can cancel own pending request |
| GET | `/allocations`, `/allocations/:id` | Scoped operational read |
| POST | `/allocations` | `allocations.manage`; `{request_id,resource_id,quantity}`; required `Idempotency-Key` |
| POST | `/allocations/:id/releases` | `allocations.manage`; `{quantity,reason}`; required `Idempotency-Key` |
| GET | `/teams`, `/teams/:id` | Operational read; field officers limited to own teams; viewer contacts hidden |
| POST/PATCH | `/teams`, `/teams/:id` | `teams.manage`; `{name,type_id,lead_id,member_ids,contact,status}` |
| POST | `/incidents/:id/team-assignments` | `teams.manage`; `{team_id}` |
| PATCH | `/team-assignments/:id` | Coordinator or own assigned field team; `{status}` |
| GET | `/shortages` | Resource threshold/direct demand alerts and separate category demand/supply |

Allocation approval, issue and return are distinct operations. Both request and resource rows are locked; incident closure is serialized against new work. Reusing an operation key with the same validated payload returns the original result; reuse with different input returns 409. A return does not reduce cumulative issued quantity or reopen completed demand. See `PERMISSIONS.md` and `DATA-MODEL.md` for lifecycle and transaction contracts.

## Administration and account

| Method | Path | Behavior |
|---|---|---|
| GET | `/users`, `/users/:id` | Administrator only; no password hashes |
| POST | `/users` | Administrator invitation `{email,role}`; token returned once; expires in 48 hours |
| PATCH | `/users/:id` | Administrator `{name,role,active}`; protects last active admin; revokes sessions |
| GET | `/roles` | Administrator fixed role/permission matrix |
| GET | `/people` | Team managers/admins: active authorized people for team assignment |
| GET/PATCH | `/profile` | Own identity; only `{name}` is editable |
| GET | `/reference-data` | Authorized form reference values |
| POST | `/settings/reference-data` | Administrator `{kind,name}`; incident_category/resource_category/team_type |
| PATCH | `/settings/reference-data/:id` | Administrator `{active}`; retains history |
| GET | `/audit-logs`, `/audit-logs/:id` | Administrator/coordinator read-only |
| GET | `/health/live`, `/health/ready` | Minimal liveness/database readiness, no credentials |

## Errors

400: invalid input/reference; 401: no valid session; 403: denied role/origin/CSRF; 404: absent or inaccessible record; 409: workflow, uniqueness, stock or transaction conflict; 413: excessive body; 429: rate limit; 500: sanitized server error. Use the response request ID for server-log correlation. Never retry inventory mutations with a new operation key merely because a response timed out.
