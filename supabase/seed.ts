/**
 * SafePass Seed Script
 * Run with: npm run seed
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 *
 * Default logins after seeding:
 *   claire.m / 1234  (reception)
 *   sean.o   / 5678  (host)
 *   mary.f   / 9012  (host)
 *   pat.k    / 3456  (site_admin)
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env manually (tsx doesn't load it automatically)
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env not found — rely on environment variables already set
  }
}

loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

async function seed() {
  console.log('🌱 Starting SafePass seed...\n')

  // ── CLEANUP (makes seed idempotent) ───────────────────────────────────
  console.log('Cleaning up existing data...')
  const tables = [
    'audit_trail', 'evacuation_events', 'messages', 'deny_list',
    'pre_approvals', 'induction_records', 'visit_documents',
    'visit_host_contacts', 'visits', 'visitors', 'members', 'sites',
  ]
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) { console.error(`Cleanup error (${table}):`, error.message); process.exit(1) }
  }
  console.log('  ✓ All tables cleared\n')

  // ── SITE ──────────────────────────────────────────────────────────────
  console.log('Creating site...')
  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .insert({
      name: 'Dublin Mary Street',
      site_code: 'DUB01',
      address: '47 Mary Street, Dublin 1',
      region: 'Ireland',
      hs_content_version: 1,
      hs_video_url: 'https://www.youtube.com/embed/UGJ4-sR27I0',
      hs_written_content: `## Welcome to Primark Dublin Mary Street

Please read the following health and safety information carefully before your visit.

### Fire Exits

Fire exits are located at both ends of each floor. In the event of a fire alarm, please make your way calmly to the nearest exit and assemble at the designated assembly point on Mary Street.

### First Aid

First aid kits are located at the reception desk and in the staff room on each floor. First aiders are available during all opening hours — ask at reception if you require assistance.

### Visitor Rules

- All visitors must wear their visitor badge at all times while on-site
- Visitors must be accompanied by their host at all times unless they have unescorted access
- Photography is not permitted in operational areas without prior written consent
- Please report any accidents or near-misses to reception immediately

### Emergency Procedures

If you hear the fire alarm:
1. Stop what you are doing immediately
2. Do not collect personal belongings
3. Follow the nearest fire exit signs
4. Proceed to the assembly point on Mary Street
5. Do not re-enter the building until instructed by a fire marshal`,
      notification_escalation_minutes: 10,
      pre_approval_default_days: 90,
    })
    .select()
    .single()

  if (siteErr) {
    console.error('Site insert error:', siteErr.message)
    process.exit(1)
  }
  console.log(`  ✓ Site created: ${site.name} (${site.site_code})`)

  // ── MEMBERS ───────────────────────────────────────────────────────────
  console.log('\nCreating members...')
  const userDefs = [
    { name: 'Claire Murphy', username: 'claire.m', pin: '1234', email: 'claire@primark.ie', role: 'reception' },
    { name: "Sean O'Brien",  username: 'sean.o',   pin: '1234', email: 'sean@primark.ie',   role: 'host' },
    { name: 'Mary Flanagan', username: 'mary.f',   pin: '1234', email: 'mary@primark.ie',   role: 'host' },
    { name: 'Pat Kelly',     username: 'pat.k',    pin: '1234', email: 'pat@primark.ie',    role: 'site_admin' },
  ]

  const userMap: Record<string, string> = {}
  for (const { pin, ...u } of userDefs) {
    const pin_hash = await hashPin(pin)
    const { data: user, error } = await supabase
      .from('members')
      .insert({ ...u, pin_hash, site_id: site.id })
      .select()
      .single()
    if (error) { console.error(`User ${u.username} error:`, error.message); process.exit(1) }
    userMap[u.username] = user.id
    console.log(`  ✓ ${u.name} (${u.role}) — PIN: ${u.pin}`)
  }

  // ── VISITORS ──────────────────────────────────────────────────────────
  console.log('\nCreating visitors...')
  const visitorDefs = [
    { name: 'John Smith',  email: 'john.smith@acme.com',   phone: '+353851234567', company: 'Acme Contractors', visitor_type: 'third_party',   created_by: userMap['sean.o'] },
    { name: 'Emma Watson', email: 'emma.w@primark.ie',     phone: '+353861234567', company: 'Primark',          visitor_type: 'internal_staff', created_by: userMap['sean.o'] },
    { name: 'Raj Patel',   email: 'raj@securitas.ie',      phone: '+353871234567', company: 'Securitas',        visitor_type: 'third_party',   created_by: userMap['mary.f'] },
    { name: 'Lisa Chen',   email: 'lisa.chen@fireserv.ie', phone: '+353881234567', company: 'FireServ Ltd',     visitor_type: 'third_party',   created_by: userMap['mary.f'] },
  ]

  const visitorMap: Record<string, { id: string; access_token: string }> = {}
  for (const v of visitorDefs) {
    const { data: visitor, error } = await supabase
      .from('visitors')
      .insert(v)
      .select()
      .single()
    if (error) { console.error(`Visitor ${v.email} error:`, error.message); process.exit(1) }
    visitorMap[v.email] = { id: visitor.id, access_token: visitor.access_token }
    console.log(`  ✓ ${v.name} (${v.visitor_type})`)
  }

  // ── VISITS ────────────────────────────────────────────────────────────
  console.log('\nCreating visits...')
  const now = new Date()

  const visitDefs = [
    {
      label: 'John Smith — scheduled, induction complete',
      visitor_id: visitorMap['john.smith@acme.com'].id,
      host_user_id: userMap['sean.o'],
      purpose: 'Server room maintenance',
      planned_arrival: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      planned_departure: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      status: 'scheduled',
      induction_completed: true,
      induction_completed_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      induction_version: 1,
    },
    {
      label: 'Lisa Chen — scheduled, induction NOT complete',
      visitor_id: visitorMap['lisa.chen@fireserv.ie'].id,
      host_user_id: userMap['mary.f'],
      purpose: 'Annual fire safety inspection',
      planned_arrival: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      planned_departure: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      status: 'scheduled',
    },
    {
      label: 'Emma Watson — checked in, unescorted',
      visitor_id: visitorMap['emma.w@primark.ie'].id,
      host_user_id: userMap['sean.o'],
      purpose: 'Monthly team meeting',
      planned_arrival: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      planned_departure: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      actual_arrival: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      status: 'checked_in',
      access_status: 'unescorted',
      induction_completed: true,
      induction_completed_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      induction_version: 1,
    },
    {
      label: 'Raj Patel — checked in, awaiting escort',
      visitor_id: visitorMap['raj@securitas.ie'].id,
      host_user_id: userMap['mary.f'],
      purpose: 'Security system upgrade',
      planned_arrival: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      planned_departure: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      actual_arrival: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      status: 'checked_in',
      access_status: 'awaiting_escort',
      induction_completed: true,
      induction_completed_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      induction_version: 1,
    },
  ]

  const visitMap: Record<string, string> = {}
  for (const { label, ...v } of visitDefs) {
    const { data: visit, error } = await supabase
      .from('visits')
      .insert({ ...v, site_id: site.id })
      .select()
      .single()
    if (error) { console.error(`Visit error (${label}):`, error.message); process.exit(1) }
    visitMap[label] = visit.id
    console.log(`  ✓ ${label}`)
  }

  // ── VISIT HOST CONTACTS ───────────────────────────────────────────────
  console.log('\nCreating visit host contacts...')
  const hostContactInserts = [
    { visit_id: visitMap['John Smith — scheduled, induction complete'],  user_id: userMap['sean.o'],  is_backup: false },
    { visit_id: visitMap['Lisa Chen — scheduled, induction NOT complete'], user_id: userMap['mary.f'], is_backup: false },
    { visit_id: visitMap['Emma Watson — checked in, unescorted'],         user_id: userMap['sean.o'],  is_backup: false },
    { visit_id: visitMap['Raj Patel — checked in, awaiting escort'],      user_id: userMap['mary.f'], is_backup: false },
    { visit_id: visitMap['Raj Patel — checked in, awaiting escort'],      user_id: userMap['pat.k'],  is_backup: true  },
  ]
  const { error: hcErr } = await supabase.from('visit_host_contacts').insert(hostContactInserts)
  if (hcErr) { console.error('Host contacts error:', hcErr.message); process.exit(1) }
  console.log(`  ✓ ${hostContactInserts.length} host contact records`)

  // ── INDUCTION RECORDS ─────────────────────────────────────────────────
  console.log('\nCreating induction records...')
  const inductionInserts = [
    {
      visitor_id: visitorMap['john.smith@acme.com'].id,
      site_id: site.id,
      content_version: 1,
      completed_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      visit_id: visitMap['John Smith — scheduled, induction complete'],
    },
    {
      visitor_id: visitorMap['emma.w@primark.ie'].id,
      site_id: site.id,
      content_version: 1,
      completed_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      visit_id: visitMap['Emma Watson — checked in, unescorted'],
    },
    {
      visitor_id: visitorMap['raj@securitas.ie'].id,
      site_id: site.id,
      content_version: 1,
      completed_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      visit_id: visitMap['Raj Patel — checked in, awaiting escort'],
    },
  ]
  const { error: indErr } = await supabase.from('induction_records').insert(inductionInserts)
  if (indErr) { console.error('Induction records error:', indErr.message); process.exit(1) }
  console.log(`  ✓ ${inductionInserts.length} induction records`)

  // ── PRE-APPROVAL ──────────────────────────────────────────────────────
  console.log('\nCreating pre-approval for John Smith...')
  const { error: paErr } = await supabase.from('pre_approvals').insert({
    visitor_id: visitorMap['john.smith@acme.com'].id,
    site_id: site.id,
    requested_by: userMap['sean.o'],
    approved_by: userMap['pat.k'],
    status: 'approved',
    expires_at: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (paErr) { console.error('Pre-approval error:', paErr.message); process.exit(1) }
  console.log('  ✓ John Smith pre-approved (unescorted access, 60 days)')

  // ── DENY LIST ─────────────────────────────────────────────────────────
  console.log('\nCreating deny list entry...')
  const { error: dlErr } = await supabase.from('deny_list').insert({
    visitor_name: 'Dave Problematic',
    visitor_email: 'dave@example.com',
    site_id: site.id,
    reason: 'Aggressive behaviour during previous visit on 15/01/2026',
    is_permanent: true,
    added_by: userMap['pat.k'],
  })
  if (dlErr) { console.error('Deny list error:', dlErr.message); process.exit(1) }
  console.log('  ✓ Dave Problematic added to deny list (permanent)')

  // ── MESSAGES ──────────────────────────────────────────────────────────
  console.log('\nCreating sample messages...')
  const notifications = [
    {
      recipient_type: 'user',
      recipient_user_id: userMap['mary.f'],
      visit_id: visitMap['Raj Patel — checked in, awaiting escort'],
      notification_type: 'escort_required',
      title: 'Visitor awaiting escort: Raj Patel',
      body: 'Raj Patel from Securitas has checked in for Security system upgrade. They require an escort. Please acknowledge and collect.',
      requires_acknowledgement: true,
    },
    {
      recipient_type: 'visitor',
      recipient_visitor_id: visitorMap['john.smith@acme.com'].id,
      visit_id: visitMap['John Smith — scheduled, induction complete'],
      notification_type: 'visit_scheduled',
      title: 'Visit scheduled: Primark Dublin Mary Street',
      body: 'You have a visit scheduled for server room maintenance. Please complete your H&S induction before arriving.',
      action_url: `/self-service/${visitorMap['john.smith@acme.com'].access_token}`,
    },
    {
      recipient_type: 'visitor',
      recipient_visitor_id: visitorMap['lisa.chen@fireserv.ie'].id,
      visit_id: visitMap['Lisa Chen — scheduled, induction NOT complete'],
      notification_type: 'visit_scheduled',
      title: 'Visit scheduled: Primark Dublin Mary Street',
      body: 'You have a visit scheduled for an annual fire safety inspection. Please complete your H&S induction before arriving.',
      action_url: `/self-service/${visitorMap['lisa.chen@fireserv.ie'].access_token}`,
    },
  ]
  const { error: notifErr } = await supabase.from('messages').insert(notifications)
  if (notifErr) { console.error('Messages error:', notifErr.message); process.exit(1) }
  console.log(`  ✓ ${notifications.length} messages`)

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n')
  console.log('Default logins:')
  console.log('  claire.m / 1234  (reception)')
  console.log('  sean.o   / 1234  (host)')
  console.log('  mary.f   / 1234  (host)')
  console.log('  pat.k    / 1234  (site_admin)')
  console.log('\nSelf-service test URLs:')
  for (const [email, v] of Object.entries(visitorMap)) {
    console.log(`  ${email}: /self-service/${v.access_token}`)
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
