-- SafePass MVP — Database Schema
-- Run this first, then indexes.sql, then seed.ts

-- Sites
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  site_code TEXT UNIQUE NOT NULL,
  address TEXT,
  region TEXT,
  hs_content_version INTEGER DEFAULT 1,
  hs_video_url TEXT,
  hs_written_content TEXT,           -- Markdown format
  notification_escalation_minutes INTEGER DEFAULT 10,
  pre_approval_default_days INTEGER DEFAULT 90,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Members (hosts, reception, site admins)
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,             -- bcrypt hash, NEVER plain text
  email TEXT,
  site_id UUID REFERENCES sites(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'host',  -- 'host' | 'reception' | 'site_admin'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Visitors (people visiting the site)
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  visitor_type TEXT NOT NULL DEFAULT 'third_party',  -- 'internal_staff' | 'third_party'
  access_token UUID DEFAULT gen_random_uuid(),       -- for self-service link access
  created_by UUID REFERENCES members(id) NOT NULL,
  is_anonymised BOOLEAN DEFAULT false,               -- GDPR soft-delete
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Visits (a scheduled or walk-in visit)
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id) NOT NULL,
  site_id UUID REFERENCES sites(id) NOT NULL,
  host_user_id UUID REFERENCES members(id) NOT NULL,
  purpose TEXT NOT NULL,
  planned_arrival TIMESTAMPTZ NOT NULL,
  planned_departure TIMESTAMPTZ NOT NULL,
  actual_arrival TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  -- 'scheduled' | 'checked_in' | 'departed' | 'cancelled'
  -- Note: 'overdue' is computed at query time, not stored
  access_status TEXT,
  -- 'unescorted' | 'awaiting_escort' | NULL (before check-in)
  induction_completed BOOLEAN DEFAULT false,
  induction_completed_at TIMESTAMPTZ,
  induction_version INTEGER,
  documents_accepted BOOLEAN DEFAULT false,
  documents_accepted_at TIMESTAMPTZ,
  is_walk_in BOOLEAN DEFAULT false,
  checked_in_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Visit host contacts (one or more per visit)
CREATE TABLE visit_host_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES members(id) NOT NULL,
  is_backup BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Visit documents (NDA, legal docs attached to visits)
CREATE TABLE visit_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
  document_name TEXT NOT NULL,
  document_content TEXT NOT NULL,      -- Markdown format
  accepted BOOLEAN DEFAULT false,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Induction records (tracks completion per visitor per site)
CREATE TABLE induction_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) NOT NULL,
  content_version INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL
);

-- Pre-approval records (unescorted third-party access)
CREATE TABLE pre_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) NOT NULL,
  requested_by UUID REFERENCES members(id) NOT NULL,
  approved_by UUID REFERENCES members(id),
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked'
  reason TEXT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Deny list
CREATE TABLE deny_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL,
  visitor_email TEXT,
  site_id UUID REFERENCES sites(id) NOT NULL,
  reason TEXT NOT NULL,
  is_permanent BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  added_by UUID REFERENCES members(id) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages (in-app inbox, simulating email for MVP)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL,       -- 'user' | 'visitor'
  recipient_user_id UUID REFERENCES members(id) ON DELETE CASCADE,
  recipient_visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,                    -- deep link for self-service actions
  is_read BOOLEAN DEFAULT false,
  requires_acknowledgement BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  escalated BOOLEAN DEFAULT false,    -- true if this triggered an escalation
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Evacuation events
CREATE TABLE evacuation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) NOT NULL,
  activated_by UUID REFERENCES members(id) NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES members(id),
  headcount_at_activation INTEGER NOT NULL,
  headcount_accounted INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_id UUID REFERENCES members(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
