# Proposed ERCS permission matrix

Status: implemented policy assumptions awaiting reconciliation with the missing proposal. `shared/domain.ts` contains the enforced grants. Roles are fixed; no arbitrary runtime permission editor until the proposal defines its allowed scope. Read-only audit access includes event details; field officer requests additionally include their own submissions. Request creators can cancel only their own pending requests; coordinator may cancel pending or under-review requests.

SA = System Administrator; EC = Emergency Coordinator; RM = Resource Manager; FO = Response Team / Field Officer; AV = Authorized Viewer. A dash means denied. `Scoped` means enforce membership/assignment/ownership in SQL and services, including nested records, counts, exports and search.

| Permission/action | SA | EC | RM | FO | AV |
|---|---|---|---|---|---|
| Own profile, password, logout | Own | Own | Own | Own | Own |
| Read operational dashboard | Yes | Yes | Yes | Scoped | Yes* |
| Read incidents / linked records | Yes | Yes | Yes | Assigned | Yes* |
| Create incident | — | Yes | — | Yes | — |
| Change incident metadata/priority/status | — | Yes | — | — | — |
| Add incident operational update | — | Yes | — | Assigned | — |
| Read inventory | Yes | Yes | Yes | Yes | Yes* |
| Create/update inventory and thresholds | — | — | Yes | — | — |
| Read requests | Yes | Yes | Yes | Own/assigned | Yes* |
| Create request for open incident | — | Yes | Yes | Assigned | — |
| Review/approve/reject request | — | Yes | — | — | — |
| Cancel pending request | — | Yes | Own | Own | — |
| Read allocations | Yes | Yes | Yes | Assigned | Yes* |
| Allocate/release resources | — | Yes | Yes | — | — |
| Read teams | Yes | Yes | Yes | Own | Yes* |
| Create/edit teams and membership | — | Yes | — | — | — |
| Assign/release team | — | Yes | — | — | — |
| Update assignment progress | — | Yes | — | Own assigned | — |
| Read shortages | Yes | Yes | Yes | Scoped | Yes* |
| Provision users / roles / activation | Yes | — | — | — | — |
| Read roles and permissions matrix | Yes | — | — | — | — |
| Read audit log | Yes | Yes | — | — | — |
| Read reference values for forms | Yes | Yes | Yes | Yes | Yes |
| Manage reference/configuration | Yes | — | — | — | — |
| Edit/delete audit or allocation history | — | — | — | — | — |

*Viewer visibility requires proposal confirmation. The initial single-organization assumption is not authorization for exposing restricted contact or security information. Restrict sensitive fields independently of record read permission.

Administrators have no implicit operational bypass. Approved requests are still required for every allocation, including administrator actions if operational permissions are later explicitly granted. The API must check permission and object scope for each request rather than trust role fields supplied by clients.

## Proposed lifecycle rules

Incidents: `reported -> active -> controlled -> resolved -> closed`, coordinator only. No exceptional backward transitions initially. Resolve/close only when there are no active team assignments, outstanding allocations, or nonterminal requests. All transitions record actor, time, prior/next state and reason. Field updates never silently change incident status.

Requests: `pending -> under_review -> approved|rejected`; `pending -> cancelled`; `under_review -> cancelled` by coordinator; `approved -> partially_fulfilled|completed` by allocation service; `partially_fulfilled -> completed` by allocation service. Approval does not modify inventory. Rejection requires a reason. No cancellation after approval/fulfillment until an explicit business rule defines how to handle outstanding allocations. Rejected/cancelled/completed states are terminal. Completed means cumulative issued quantity meets requested quantity; returns do not reopen demand.

Teams: one active incident assignment per team. Availability derives from active assignment and operational status. Assignment progress may move `assigned -> responding -> on_scene -> completed`; coordinator may cancel with reason. Team leads/members may update only their own active assignment. Enforce no conflicting assignment in the database.

Resources: operational status (`operational`, `maintenance`, `unavailable`) is separate from computed quantity availability (`available`, `exhausted`, `deployed`). No independent editable available count. No reservation state until a reservation workflow is defined. Indivisible assets have total quantity one and allocation quantity one. Inventory totals cannot fall below outstanding allocations. Do not silently delete referenced resources, categories, users or teams; deactivate/archive where supported.

All these policies are documented assumptions, not substitutes for the missing primary proposal.
