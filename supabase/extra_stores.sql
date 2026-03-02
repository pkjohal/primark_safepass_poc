-- =============================================================================
-- SafePass — Extra Stores Seed Data
-- Adds 5 additional Primark stores with staff, visitors, and visits.
--
-- Requirements:
--   The pgcrypto extension must be enabled (Supabase enables it by default).
--   Run this AFTER the main seed (supabase/seed.ts) so the Dublin store exists.
--
-- All staff PINs are set to: 1234
--
-- Staff logins added:
--   Belfast:    niam.o / 1234  (reception)   conor.m / 1234  (host)   aisling.b / 1234 (host)   david.q / 1234 (site_admin)
--   Manchester: jade.p / 1234  (reception)   tom.h   / 1234  (host)   sarah.n   / 1234 (host)   rob.c   / 1234 (site_admin)
--   London:     priya.s / 1234 (reception)   james.w / 1234  (host)   fatima.a  / 1234 (host)   mike.t  / 1234 (site_admin)
--   Edinburgh:  fiona.m / 1234 (reception)   calum.r / 1234  (host)   isla.f    / 1234 (host)   greg.s  / 1234 (site_admin)
--   Birmingham: amara.k / 1234 (reception)   liam.b  / 1234  (host)   sophie.e  / 1234 (host)   nina.p  / 1234 (site_admin)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  -- Site IDs
  belfast_id     UUID;
  manchester_id  UUID;
  london_id      UUID;
  edinburgh_id   UUID;
  birmingham_id  UUID;

  -- Belfast member IDs
  bel_niam       UUID;
  bel_conor      UUID;
  bel_aisling    UUID;
  bel_david      UUID;

  -- Manchester member IDs
  man_jade       UUID;
  man_tom        UUID;
  man_sarah      UUID;
  man_rob        UUID;

  -- London member IDs
  lon_priya      UUID;
  lon_james      UUID;
  lon_fatima     UUID;
  lon_mike       UUID;

  -- Edinburgh member IDs
  edi_fiona      UUID;
  edi_calum      UUID;
  edi_isla       UUID;
  edi_greg       UUID;

  -- Birmingham member IDs
  bir_amara      UUID;
  bir_liam       UUID;
  bir_sophie     UUID;
  bir_nina       UUID;

  -- Visitor IDs (shared across stores to simulate repeat visitors)
  vis_harris     UUID;
  vis_patel      UUID;
  vis_oconnor    UUID;
  vis_taylor     UUID;
  vis_johnson    UUID;

  pin_hash TEXT;
  now_ts   TIMESTAMPTZ := now();

BEGIN

  -- ──────────────────────────────────────────────────────────────────────────
  -- Pre-compute PIN hash (bcrypt cost 10, compatible with bcryptjs)
  -- ──────────────────────────────────────────────────────────────────────────
  pin_hash := crypt('1234', gen_salt('bf', 10));


  -- ══════════════════════════════════════════════════════════════════════════
  -- SITES
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO sites (name, site_code, address, region,
    hs_content_version, hs_video_url, hs_written_content,
    notification_escalation_minutes, pre_approval_default_days)
  VALUES (
    'Belfast Donegall Place', 'BEL01',
    '47 Donegall Place, Belfast BT1 5AD', 'Northern Ireland',
    1, 'https://www.youtube.com/embed/UGJ4-sR27I0',
    E'## Welcome to Primark Belfast Donegall Place\n\nPlease read the following health and safety information carefully before your visit.\n\n### Fire Exits\n\nFire exits are located at both ends of each floor. In the event of a fire alarm, please make your way calmly to the nearest exit and proceed to the assembly point on Donegall Place.\n\n### First Aid\n\nFirst aid kits are located at the reception desk and in the staff room on each floor. First aiders are on duty at all times — ask at reception if you require assistance.\n\n### Visitor Rules\n\n- All visitors must wear their visitor badge at all times\n- Visitors must be accompanied by their host unless they hold unescorted access\n- Photography is not permitted in operational areas without prior written consent\n- Report any accidents or near-misses to reception immediately\n\n### Emergency Procedures\n\n1. Stop what you are doing immediately\n2. Do not collect personal belongings\n3. Follow the nearest fire exit signs\n4. Proceed to the assembly point on Donegall Place\n5. Do not re-enter until instructed by a fire marshal',
    10, 90
  ) RETURNING id INTO belfast_id;

  INSERT INTO sites (name, site_code, address, region,
    hs_content_version, hs_video_url, hs_written_content,
    notification_escalation_minutes, pre_approval_default_days)
  VALUES (
    'Manchester Arndale', 'MAN01',
    'Manchester Arndale, Market Street, Manchester M4 3AQ', 'North West England',
    1, 'https://www.youtube.com/embed/UGJ4-sR27I0',
    E'## Welcome to Primark Manchester Arndale\n\nPlease read the following health and safety information carefully before your visit.\n\n### Fire Exits\n\nFire exits are clearly marked on every floor. In the event of an alarm, follow signage to the nearest exit and assemble at the designated point on Market Street.\n\n### First Aid\n\nFirst aid kits are located at the reception desk and all staff rooms. Trained first aiders are on site during all trading hours.\n\n### Visitor Rules\n\n- Visitor badges must be worn at all times on site\n- Remain with your host unless you have pre-approved unescorted access\n- Photography requires prior written consent from management\n- Report any incidents to reception immediately\n\n### Emergency Procedures\n\n1. Stop all activity immediately\n2. Leave personal belongings\n3. Follow fire exit signs to the nearest exit\n4. Assemble at the Market Street muster point\n5. Await clearance from a fire marshal before re-entering',
    10, 90
  ) RETURNING id INTO manchester_id;

  INSERT INTO sites (name, site_code, address, region,
    hs_content_version, hs_video_url, hs_written_content,
    notification_escalation_minutes, pre_approval_default_days)
  VALUES (
    'London Oxford Street', 'LON01',
    '499–517 Oxford Street, London W1C 1LR', 'London',
    1, 'https://www.youtube.com/embed/UGJ4-sR27I0',
    E'## Welcome to Primark London Oxford Street\n\nPlease read the following health and safety information carefully before your visit.\n\n### Fire Exits\n\nEmergency exits are on every floor. In the event of a fire alarm, evacuate immediately via the nearest exit and assemble at the Oxford Street assembly point.\n\n### First Aid\n\nFirst aid stations are on every floor and at the main reception. First aiders are on duty throughout trading hours.\n\n### Visitor Rules\n\n- Visitor lanyards must be visible at all times\n- Stay with your host unless you hold an approved unescorted access pass\n- No photography in back-of-house or operational areas\n- Report all accidents and near-misses to reception\n\n### Emergency Procedures\n\n1. Stop immediately and do not collect belongings\n2. Evacuate via the nearest fire exit\n3. Proceed to the Oxford Street assembly area\n4. Register your presence with the fire marshal\n5. Do not re-enter the building until the all-clear is given',
    10, 90
  ) RETURNING id INTO london_id;

  INSERT INTO sites (name, site_code, address, region,
    hs_content_version, hs_video_url, hs_written_content,
    notification_escalation_minutes, pre_approval_default_days)
  VALUES (
    'Edinburgh Princes Street', 'EDI01',
    '92–112 Princes Street, Edinburgh EH2 3AA', 'Scotland',
    1, 'https://www.youtube.com/embed/UGJ4-sR27I0',
    E'## Welcome to Primark Edinburgh Princes Street\n\nPlease read the following health and safety information carefully before your visit.\n\n### Fire Exits\n\nFire exits are located on every level and clearly signed throughout the store. In the event of a fire alarm, evacuate immediately and assemble at the Princes Street muster point.\n\n### First Aid\n\nFirst aid kits are at the reception desk and all staff areas. Qualified first aiders are available at all times.\n\n### Visitor Rules\n\n- Visitor ID badges must be worn visibly at all times\n- Visitors must remain with their host unless pre-approved for unescorted access\n- Photography in operational areas requires management approval\n- Report incidents to reception immediately\n\n### Emergency Procedures\n\n1. Stop all activity and leave belongings\n2. Follow fire exit signage to the nearest exit\n3. Proceed to the Princes Street assembly point\n4. Report to the fire marshal\n5. Await the all-clear before re-entering',
    10, 90
  ) RETURNING id INTO edinburgh_id;

  INSERT INTO sites (name, site_code, address, region,
    hs_content_version, hs_video_url, hs_written_content,
    notification_escalation_minutes, pre_approval_default_days)
  VALUES (
    'Birmingham High Street', 'BIR01',
    '52–54 High Street, Birmingham B4 7SL', 'West Midlands',
    1, 'https://www.youtube.com/embed/UGJ4-sR27I0',
    E'## Welcome to Primark Birmingham High Street\n\nPlease read the following health and safety information carefully before your visit.\n\n### Fire Exits\n\nFire exits are clearly marked on all floors. On hearing the fire alarm, exit immediately via the nearest marked route and proceed to the High Street assembly point.\n\n### First Aid\n\nFirst aid equipment is at reception and in all staff rest areas. First aiders are present throughout all trading hours.\n\n### Visitor Rules\n\n- Visitor badges must be worn and visible at all times\n- All visitors must be accompanied by their host unless they hold unescorted access\n- Photography in non-public areas requires prior approval\n- All incidents must be reported to reception immediately\n\n### Emergency Procedures\n\n1. Stop immediately upon hearing the alarm\n2. Do not collect any belongings\n3. Evacuate via the nearest fire exit\n4. Make your way to the High Street assembly point\n5. Check in with the fire marshal and await the all-clear',
    10, 90
  ) RETURNING id INTO birmingham_id;

  RAISE NOTICE 'Sites created: Belfast %, Manchester %, London %, Edinburgh %, Birmingham %',
    belfast_id, manchester_id, london_id, edinburgh_id, birmingham_id;


  -- ══════════════════════════════════════════════════════════════════════════
  -- BELFAST MEMBERS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Niamh O''Sullivan', 'niam.o', pin_hash, 'niamh.osullivan@primark.com', belfast_id, 'reception')
  RETURNING id INTO bel_niam;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Conor MacAllister', 'conor.m', pin_hash, 'conor.macallister@primark.com', belfast_id, 'host')
  RETURNING id INTO bel_conor;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Aisling Burke', 'aisling.b', pin_hash, 'aisling.burke@primark.com', belfast_id, 'host')
  RETURNING id INTO bel_aisling;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('David Quinn', 'david.q', pin_hash, 'david.quinn@primark.com', belfast_id, 'site_admin')
  RETURNING id INTO bel_david;

  -- ══════════════════════════════════════════════════════════════════════════
  -- MANCHESTER MEMBERS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Jade Peters', 'jade.p', pin_hash, 'jade.peters@primark.com', manchester_id, 'reception')
  RETURNING id INTO man_jade;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Tom Harrison', 'tom.h', pin_hash, 'tom.harrison@primark.com', manchester_id, 'host')
  RETURNING id INTO man_tom;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Sarah Nightingale', 'sarah.n', pin_hash, 'sarah.nightingale@primark.com', manchester_id, 'host')
  RETURNING id INTO man_sarah;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Rob Clarke', 'rob.c', pin_hash, 'rob.clarke@primark.com', manchester_id, 'site_admin')
  RETURNING id INTO man_rob;

  -- ══════════════════════════════════════════════════════════════════════════
  -- LONDON MEMBERS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Priya Sharma', 'priya.s', pin_hash, 'priya.sharma@primark.com', london_id, 'reception')
  RETURNING id INTO lon_priya;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('James Wright', 'james.w', pin_hash, 'james.wright@primark.com', london_id, 'host')
  RETURNING id INTO lon_james;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Fatima Al-Hassan', 'fatima.a', pin_hash, 'fatima.alhassan@primark.com', london_id, 'host')
  RETURNING id INTO lon_fatima;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Mike Thompson', 'mike.t', pin_hash, 'mike.thompson@primark.com', london_id, 'site_admin')
  RETURNING id INTO lon_mike;

  -- ══════════════════════════════════════════════════════════════════════════
  -- EDINBURGH MEMBERS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Fiona MacDonald', 'fiona.m', pin_hash, 'fiona.macdonald@primark.com', edinburgh_id, 'reception')
  RETURNING id INTO edi_fiona;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Calum Robertson', 'calum.r', pin_hash, 'calum.robertson@primark.com', edinburgh_id, 'host')
  RETURNING id INTO edi_calum;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Isla Fraser', 'isla.f', pin_hash, 'isla.fraser@primark.com', edinburgh_id, 'host')
  RETURNING id INTO edi_isla;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Greg Sinclair', 'greg.s', pin_hash, 'greg.sinclair@primark.com', edinburgh_id, 'site_admin')
  RETURNING id INTO edi_greg;

  -- ══════════════════════════════════════════════════════════════════════════
  -- BIRMINGHAM MEMBERS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Amara Kofi', 'amara.k', pin_hash, 'amara.kofi@primark.com', birmingham_id, 'reception')
  RETURNING id INTO bir_amara;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Liam Brennan', 'liam.b', pin_hash, 'liam.brennan@primark.com', birmingham_id, 'host')
  RETURNING id INTO bir_liam;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Sophie Evans', 'sophie.e', pin_hash, 'sophie.evans@primark.com', birmingham_id, 'host')
  RETURNING id INTO bir_sophie;

  INSERT INTO members (name, username, pin_hash, email, site_id, role)
  VALUES ('Nina Patel', 'nina.p', pin_hash, 'nina.patel@primark.com', birmingham_id, 'site_admin')
  RETURNING id INTO bir_nina;

  RAISE NOTICE 'All members created';


  -- ══════════════════════════════════════════════════════════════════════════
  -- VISITORS (shared across stores — simulates contractors who visit multiple sites)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO visitors (name, email, phone, company, visitor_type, created_by)
  VALUES ('Marcus Harris', 'marcus.harris@elitefire.co.uk', '+447700900123', 'Elite Fire Protection', 'third_party', bel_niam)
  RETURNING id INTO vis_harris;

  INSERT INTO visitors (name, email, phone, company, visitor_type, created_by)
  VALUES ('Sunita Patel', 'sunita.patel@primark.com', '+447700900456', 'Primark', 'internal_staff', man_jade)
  RETURNING id INTO vis_patel;

  INSERT INTO visitors (name, email, phone, company, visitor_type, created_by)
  VALUES ('Declan O''Connor', 'declan.oconnor@jll.com', '+447700900789', 'JLL Property Services', 'third_party', lon_priya)
  RETURNING id INTO vis_oconnor;

  INSERT INTO visitors (name, email, phone, company, visitor_type, created_by)
  VALUES ('Rebecca Taylor', 'rebecca.taylor@schindler.com', '+447700901012', 'Schindler Lifts', 'third_party', edi_fiona)
  RETURNING id INTO vis_taylor;

  INSERT INTO visitors (name, email, phone, company, visitor_type, created_by)
  VALUES ('Kwame Johnson', 'kwame.johnson@primark.com', '+447700901345', 'Primark', 'internal_staff', bir_amara)
  RETURNING id INTO vis_johnson;

  RAISE NOTICE 'Visitors created';


  -- ══════════════════════════════════════════════════════════════════════════
  -- VISITS
  -- ══════════════════════════════════════════════════════════════════════════

  -- Belfast: Marcus Harris — scheduled, fire inspection
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, status)
  VALUES (
    vis_harris, belfast_id, bel_aisling,
    'Annual fire safety inspection',
    now_ts + INTERVAL '2 hours', now_ts + INTERVAL '6 hours',
    'scheduled'
  );

  -- Belfast: Kwame Johnson — checked in, internal staff (unescorted)
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, actual_arrival,
    status, access_status, induction_completed, induction_completed_at, induction_version)
  VALUES (
    vis_johnson, belfast_id, bel_conor,
    'Regional operations review',
    now_ts - INTERVAL '1 hour', now_ts + INTERVAL '3 hours',
    now_ts - INTERVAL '45 minutes',
    'checked_in', 'unescorted', true, now_ts - INTERVAL '1 hour', 1
  );

  -- Manchester: Sunita Patel — scheduled, internal staff
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, status)
  VALUES (
    vis_patel, manchester_id, man_tom,
    'New season merchandising walkthrough',
    now_ts + INTERVAL '1 hour', now_ts + INTERVAL '4 hours',
    'scheduled'
  );

  -- Manchester: Declan O'Connor — checked in, awaiting escort
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, actual_arrival,
    status, access_status, induction_completed, induction_completed_at, induction_version)
  VALUES (
    vis_oconnor, manchester_id, man_sarah,
    'HVAC maintenance — rooftop plant room',
    now_ts - INTERVAL '20 minutes', now_ts + INTERVAL '5 hours',
    now_ts - INTERVAL '10 minutes',
    'checked_in', 'awaiting_escort', true, now_ts - INTERVAL '15 minutes', 1
  );

  -- London: Marcus Harris — scheduled
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, status)
  VALUES (
    vis_harris, london_id, lon_fatima,
    'Sprinkler system six-monthly service',
    now_ts + INTERVAL '3 hours', now_ts + INTERVAL '8 hours',
    'scheduled'
  );

  -- London: Rebecca Taylor — checked in, awaiting escort
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, actual_arrival,
    status, access_status, induction_completed, induction_completed_at, induction_version)
  VALUES (
    vis_taylor, london_id, lon_james,
    'Escalator annual inspection and servicing',
    now_ts - INTERVAL '30 minutes', now_ts + INTERVAL '6 hours',
    now_ts - INTERVAL '20 minutes',
    'checked_in', 'awaiting_escort', true, now_ts - INTERVAL '25 minutes', 1
  );

  -- Edinburgh: Sunita Patel — scheduled, internal staff
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, status)
  VALUES (
    vis_patel, edinburgh_id, edi_calum,
    'Store operations audit',
    now_ts + INTERVAL '4 hours', now_ts + INTERVAL '7 hours',
    'scheduled'
  );

  -- Edinburgh: Declan O'Connor — scheduled
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, status)
  VALUES (
    vis_oconnor, edinburgh_id, edi_isla,
    'Commercial lease review and property walk',
    now_ts + INTERVAL '2 hours', now_ts + INTERVAL '5 hours',
    'scheduled'
  );

  -- Birmingham: Kwame Johnson — checked in, unescorted internal staff
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, actual_arrival,
    status, access_status, induction_completed, induction_completed_at, induction_version)
  VALUES (
    vis_johnson, birmingham_id, bir_liam,
    'IT infrastructure upgrade — server room',
    now_ts - INTERVAL '2 hours', now_ts + INTERVAL '2 hours',
    now_ts - INTERVAL '1 hour 50 minutes',
    'checked_in', 'unescorted', true, now_ts - INTERVAL '2 hours', 1
  );

  -- Birmingham: Rebecca Taylor — scheduled
  INSERT INTO visits (visitor_id, site_id, host_user_id, purpose,
    planned_arrival, planned_departure, status)
  VALUES (
    vis_taylor, birmingham_id, bir_sophie,
    'Lift compliance inspection',
    now_ts + INTERVAL '1 hour 30 minutes', now_ts + INTERVAL '4 hours',
    'scheduled'
  );

  RAISE NOTICE 'Visits created';


  -- ══════════════════════════════════════════════════════════════════════════
  -- DENY LISTS (one per store for demo realism)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO deny_list (visitor_name, visitor_email, site_id, reason, is_permanent, added_by)
  VALUES ('Terry Blackwell', 'terry.b@example.com', belfast_id,
    'Threatening behaviour towards staff on 10/01/2026', true, bel_david);

  INSERT INTO deny_list (visitor_name, visitor_email, site_id, reason, is_permanent, expires_at, added_by)
  VALUES ('Gary Simmons', 'gsimmons@hotmail.com', manchester_id,
    'Unauthorised photography of store layout on 22/11/2025', false,
    now_ts + INTERVAL '180 days', man_rob);

  INSERT INTO deny_list (visitor_name, visitor_email, site_id, reason, is_permanent, added_by)
  VALUES ('Chris Fowler', 'cfowler@contractor.net', london_id,
    'Refused to comply with H&S induction procedures on 05/02/2026', true, lon_mike);

  INSERT INTO deny_list (visitor_name, visitor_email, site_id, reason, is_permanent, added_by)
  VALUES ('Wayne Dodd', 'wdodd@example.co.uk', edinburgh_id,
    'Gained access to restricted area without authorisation on 14/12/2025', true, edi_greg);

  INSERT INTO deny_list (visitor_name, visitor_email, site_id, reason, is_permanent, expires_at, added_by)
  VALUES ('Alan Price', 'alan.price@temp-staff.com', birmingham_id,
    'Failed background check for restricted access area on 30/01/2026', false,
    now_ts + INTERVAL '365 days', bir_nina);

  RAISE NOTICE 'Deny list entries created';

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Extra stores seed complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Staff logins (all PIN: 1234)';
  RAISE NOTICE '  Belfast:    niam.o  conor.m  aisling.b  david.q';
  RAISE NOTICE '  Manchester: jade.p  tom.h    sarah.n    rob.c';
  RAISE NOTICE '  London:     priya.s james.w  fatima.a   mike.t';
  RAISE NOTICE '  Edinburgh:  fiona.m calum.r  isla.f     greg.s';
  RAISE NOTICE '  Birmingham: amara.k liam.b   sophie.e   nina.p';
  RAISE NOTICE '=================================================';

END $$;
