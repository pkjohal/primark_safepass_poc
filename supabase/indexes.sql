-- SafePass MVP — Indexes
-- Run after schema.sql

CREATE INDEX idx_visits_site_status ON visits(site_id, status);
CREATE INDEX idx_visits_visitor ON visits(visitor_id);
CREATE INDEX idx_visits_site_date ON visits(site_id, planned_arrival);
CREATE INDEX idx_visitors_email ON visitors(email);
CREATE INDEX idx_visitors_token ON visitors(access_token);
CREATE INDEX idx_messages_recipient_user ON messages(recipient_user_id, is_read);
CREATE INDEX idx_messages_recipient_visitor ON messages(recipient_visitor_id, is_read);
CREATE INDEX idx_deny_list_site ON deny_list(site_id, is_active);
CREATE INDEX idx_deny_list_visitor ON deny_list(visitor_id) WHERE visitor_id IS NOT NULL;
CREATE INDEX idx_deny_list_email ON deny_list(visitor_email) WHERE visitor_email IS NOT NULL;
CREATE INDEX idx_pre_approvals_visitor_site ON pre_approvals(visitor_id, site_id, status);
CREATE INDEX idx_induction_records_visitor_site ON induction_records(visitor_id, site_id);
CREATE INDEX idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX idx_evacuation_events_site ON evacuation_events(site_id);
CREATE INDEX idx_evacuation_events_active ON evacuation_events(site_id)
  WHERE closed_at IS NULL;
