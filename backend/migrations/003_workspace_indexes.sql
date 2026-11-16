-- Indexes supporting operational filters, histories, and current assignments.
CREATE INDEX incidents_category_date ON incidents(category_id,created_at DESC);
CREATE INDEX incidents_severity_date ON incidents(severity,created_at DESC);
CREATE INDEX incidents_priority_date ON incidents(priority,created_at DESC);
CREATE INDEX resources_status_location ON resources(status,location);
CREATE INDEX requests_requester_date ON resource_requests(requester_id,created_at DESC);
CREATE INDEX requests_category_date ON resource_requests(category_id,created_at DESC);
CREATE INDEX allocations_responsible_date ON allocations(responsible_id,created_at DESC);
CREATE INDEX teams_type_lead ON response_teams(type_id,lead_id);
CREATE INDEX movements_resource_date ON inventory_movements(resource_id,created_at DESC);
CREATE INDEX releases_allocation_date ON allocation_releases(allocation_id,created_at DESC);
