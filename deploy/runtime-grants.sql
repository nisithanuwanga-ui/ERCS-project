-- Execute as migration owner in psql after setting :runtime_role to a pre-created,
-- least-privilege login role. This file does not create or print passwords.
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT ON roles,reference_data,users,incidents,resources,resource_requests,
  allocations,response_teams,team_assignments,team_members,invitations,
  audit_logs,history,inventory_movements,allocation_releases,idempotency_keys,session
  TO :"runtime_role";
GRANT INSERT,UPDATE ON reference_data,users,incidents,resources,resource_requests,
  allocations,response_teams,team_assignments,invitations,idempotency_keys,session
  TO :"runtime_role";
GRANT INSERT,DELETE ON team_members TO :"runtime_role";
GRANT DELETE ON session TO :"runtime_role";
GRANT INSERT ON audit_logs,history,inventory_movements,allocation_releases TO :"runtime_role";
