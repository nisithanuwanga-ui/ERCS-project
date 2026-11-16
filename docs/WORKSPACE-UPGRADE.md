# Management workspace upgrade

The management sidebar previously sent every module through `RecordList`, with a common toolbar, date filters, and schema-driven table. The new router uses five separate workspace components in `src/features/ManagementWorkspaces.tsx`; the shared list remains for users and audit logs.

## Module behavior

- **Incidents:** command brief, priority/severity charts, incident register, severity/type/priority/status/location/team/date filters, and direct links to status and assignment actions. Detail views include the timeline, assigned teams, related requests, and allocations. New resource requests carry the incident selection forward.
- **Inventory:** stock readiness cards, category and availability charts, low-stock watch, per-resource availability bars, category/status/availability/location/threshold filters, and stock history. Quantity adjustments use a locked PostgreSQL transaction and create history, inventory movement, and audit records.
- **Requests:** lifecycle navigation, status and priority distributions, review queue, requester/incident/category/priority/status/date filters, pending-request editing, and confirmation dialogs for approval, rejection, and cancellation. Allocation forms carry the approved request forward.
- **Allocations:** deployment activity, release tracking, outstanding quantities, incident/resource/status/responsible/date filters, linked incidents and requests. The existing row-locked allocation, partial issue, idempotency, and release service remains authoritative.
- **Teams:** readiness and specialization charts, a personnel card directory, leader/type/availability/incident filters, assignments, availability changes, membership, and history. Deployed or unavailable teams cannot accept conflicting assignments.

Summary cards and charts query `GET /api/:module/summary`. Totals cover the complete authorized dataset; workspace filters apply to the record results. Summary cards link to matching filtered views. No operational demo values are used. Sorting and page-size/page controls operate on backend results.

The login keeps the existing session authentication and distinct network illustration. Typography uses responsive sizes, larger controls, focus indicators, password visibility feedback, and reduced-motion handling. Dashboard charts remain backend-derived and now offer module drill-down links.

## API additions

- `GET /api/{incidents|resources|resource-requests|allocations|teams}/summary` returns `{ data: { counts, distribution, secondary, activity } }`.
- Lists accept module-specific severity, team, availability, threshold, category, requester, resource, responsible user, and leader filters. Date ranges are validated. `status=completed` matches resolved/closed incidents and fully returned allocations; allocation `status=partially_fulfilled` follows the linked request while units remain outstanding.
- `GET /api/directory/people?q=&limit=100` returns active names and IDs for filters without exposing personnel contact information.
- `POST /api/resources/:id/adjustments` accepts `{ quantity_delta, reason }` and enforces stock and asset constraints in a transaction.
- `PATCH /api/resource-requests/:id` edits pending requests only, subject to owner/reviewer authorization and validation.
- Migration `003_workspace_indexes.sql` adds filter/history indexes; it preserves existing records and constraints.

Run the normal migration command (`npm run db:migrate`) against each deployment database before using the upgrade. Automated integration and browser tests use disposable PostgreSQL databases, leaving the development dataset unchanged.

## Verification

See the dated entry in `docs/VERIFICATION.md` for commands actually run and their results. Production hosting and Docker runtime are separate from local source verification.
