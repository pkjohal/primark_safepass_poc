export interface Site {
  id: string
  name: string
  site_code: string
  address: string | null
  region: string | null
  hs_content_version: number
  hs_video_url: string | null
  hs_written_content: string | null  // Markdown
  notification_escalation_minutes: number
  pre_approval_default_days: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  name: string
  username: string
  pin_hash: string  // bcrypt hash — never expose to client
  email: string | null
  site_id: string
  role: 'host' | 'reception' | 'site_admin'
  is_active: boolean
  created_at: string
  updated_at: string
}

// Client-safe user (without pin_hash)
export type SafeUser = Omit<User, 'pin_hash'>

export interface Visitor {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  visitor_type: 'internal_staff' | 'third_party'
  access_token: string
  created_by: string
  is_anonymised: boolean
  created_at: string
  updated_at: string
}

export interface Visit {
  id: string
  visitor_id: string
  site_id: string
  host_user_id: string
  purpose: string
  planned_arrival: string
  planned_departure: string
  actual_arrival: string | null
  actual_departure: string | null
  status: 'scheduled' | 'checked_in' | 'departed' | 'cancelled'
  access_status: 'unescorted' | 'awaiting_escort' | null
  induction_completed: boolean
  induction_completed_at: string | null
  induction_version: number | null
  documents_accepted: boolean
  documents_accepted_at: string | null
  is_walk_in: boolean
  checked_in_by: string | null
  created_at: string
  updated_at: string
}

// Computed display status (includes 'overdue')
export type VisitDisplayStatus = Visit['status'] | 'overdue'

export interface VisitHostContact {
  id: string
  visit_id: string
  user_id: string
  is_backup: boolean
  created_at: string
}

export interface VisitDocument {
  id: string
  visit_id: string
  document_name: string
  document_content: string  // Markdown
  accepted: boolean
  accepted_at: string | null
  created_at: string
}

export interface InductionRecord {
  id: string
  visitor_id: string
  site_id: string
  content_version: number
  completed_at: string
  visit_id: string | null
}

export interface PreApproval {
  id: string
  visitor_id: string
  site_id: string
  requested_by: string
  approved_by: string | null
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked'
  reason: string | null
  expires_at: string | null
  revoked_at: string | null
  revoked_by: string | null
  created_at: string
  updated_at: string
}

export interface DenyListEntry {
  id: string
  visitor_id: string | null
  visitor_name: string
  visitor_email: string | null
  site_id: string
  reason: string
  is_permanent: boolean
  expires_at: string | null
  added_by: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type NotificationType =
  | 'visit_scheduled'
  | 'visit_cancelled'
  | 'visit_amended'
  | 'checkin_host_alert'
  | 'escort_required'
  | 'escalation'
  | 'escalation_reception'
  | 'host_reminder'
  | 'pre_approval_request'
  | 'pre_approval_decision'
  | 'deny_list_alert'
  | 'evacuation_activated'
  | 'walk_in_host_confirm'

export interface Notification {
  id: string
  recipient_type: 'user' | 'visitor'
  recipient_user_id: string | null
  recipient_visitor_id: string | null
  visit_id: string | null
  notification_type: NotificationType
  title: string
  body: string
  action_url: string | null
  is_read: boolean
  requires_acknowledgement: boolean
  acknowledged_at: string | null
  escalated: boolean
  created_at: string
}

export interface EvacuationEvent {
  id: string
  site_id: string
  activated_by: string
  activated_at: string
  closed_at: string | null
  closed_by: string | null
  headcount_at_activation: number
  headcount_accounted: number
  notes: string | null
  created_at: string
}

export interface AuditLogEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  user_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

// Enriched types used in UI (with joined data)
export interface VisitWithVisitor extends Visit {
  visitor: Visitor
  host: SafeUser
}
