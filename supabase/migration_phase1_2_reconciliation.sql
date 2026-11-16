-- =====================================================================================
-- SECURITY OPERATIONS HUB (SOH) - PHASE 1 & PHASE 2 RECONCILIATION MIGRATION
-- Non-Destructive, Additive & Idempotent SQL Migration for Supabase SQL Editor
-- Target: Supabase (PostgreSQL 15+)
--
-- SAFETY GUARANTEES:
-- 1. Preserves ALL existing records in profiles, tasks, task_updates, activities,
--    audit_logs, member_initiatives, initiative_history, personnel_assignments, etc.
-- 2. Never uses DROP TABLE, TRUNCATE, or DELETE on user/operational data.
-- 3. Safe to run after `supabase/migration_personnel_hierarchy.sql`.
-- 4. Preserves legacy 'reg-vis' and 'reg-min' rows as inactive historical references
--    so existing foreign keys remain intact while adding required regional subdivisions.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. AUDIT LOGS CONSTRAINT GUARD (NON-DESTRUCTIVE)
-- -------------------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_record_type_check;
    ALTER TABLE IF EXISTS public.audit_logs ADD CONSTRAINT audit_logs_record_type_check
        CHECK (record_type IN (
            'task',
            'task_update',
            'activity',
            'profile',
            'auth',
            'initiative',
            'personnel',
            'organization',
            'hierarchy',
            'performance'
        ));
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- -------------------------------------------------------------------------------------
-- 2. SECURITY DEPARTMENT UNIT DESCRIPTION ALIGNMENT (NON-DESTRUCTIVE)
-- -------------------------------------------------------------------------------------
UPDATE public.organizational_units
SET description = 'VP & Head of Security and Security Manager oversight (Security Department)'
WHERE id = 'unit-exec';

-- -------------------------------------------------------------------------------------
-- 3. OPERATING REGIONS EXPANSION (REQUIRED REGIONAL SUBDIVISIONS)
-- - Renames reg-ncr to 'NCR & Rizal'
-- - Adds Visayas Region 6 (reg-vis-6) & Visayas Region 7 (reg-vis-7)
-- - Adds Mindanao Region 10 (reg-min-10) & Mindanao Region 11 (reg-min-11)
-- - Marks legacy 'reg-vis' / 'reg-min' inactive (never deleted) so existing records stay valid
-- -------------------------------------------------------------------------------------
INSERT INTO public.operating_regions (id, code, name, island_group, sort_order, is_active)
VALUES
    ('reg-ncr',    'NCR',   'NCR & Rizal',             'Luzon',      1, true),
    ('reg-nlz',    'NLZ',   'North Luzon',             'Luzon',      2, true),
    ('reg-clz',    'CLZ',   'Central Luzon',           'Luzon',      3, true),
    ('reg-slz',    'SLZ',   'South Luzon',             'Luzon',      4, true),
    ('reg-bcl',    'BCL',   'Bicol',                   'Luzon',      5, true),
    ('reg-vis-6',  'VIS6',  'Visayas Region 6',        'Visayas',    6, true),
    ('reg-vis-7',  'VIS7',  'Visayas Region 7',        'Visayas',    7, true),
    ('reg-min-10', 'MIN10', 'Mindanao Region 10',      'Mindanao',   8, true),
    ('reg-min-11', 'MIN11', 'Mindanao Region 11',      'Mindanao',   9, true),
    ('reg-nat',    'NAT',   'Nationwide / Multi-Site', 'Nationwide', 10, true)
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    island_group = EXCLUDED.island_group,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- Keep legacy aggregate rows intact for historical FKs, marked inactive so new assignments use subdivisions
UPDATE public.operating_regions
SET is_active = false, sort_order = 90
WHERE id IN ('reg-vis', 'reg-min');

-- -------------------------------------------------------------------------------------
-- 4. POSITION-SPECIFIC KPI WEIGHTS & DAILY ACTIVITY TARGETS (ADDITIVE COLUMNS)
-- -------------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.performance_targets
    ADD COLUMN IF NOT EXISTS weight_completion INTEGER NOT NULL DEFAULT 35,
    ADD COLUMN IF NOT EXISTS weight_on_time INTEGER NOT NULL DEFAULT 35,
    ADD COLUMN IF NOT EXISTS weight_activity INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS weight_initiative INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS daily_activity_target INTEGER NOT NULL DEFAULT 1;

-- Seed configurable position-specific targets (idempotent)
INSERT INTO public.performance_targets (
    id, unit_id, position_id,
    target_completion_rate, target_on_time_rate, monthly_initiative_goal,
    weight_completion, weight_on_time, weight_activity, weight_initiative,
    daily_activity_target, notes
)
VALUES
    ('tgt-rso-sup', 'unit-rso', 'pos-rso-sup', 90.00, 85.00, 1, 30, 35, 20, 15, 1, 'Regional Security Supervisor: balanced site SLA, team inspection follow-up, and field logs'),
    ('tgt-inv',     'unit-rso', 'pos-inv',     92.00, 88.00, 1, 35, 35, 15, 15, 1, 'Investigator: case follow-up closure, documentation timeliness, and preventive findings'),
    ('tgt-sec-off', 'unit-rso', 'pos-sec-off', 90.00, 85.00, 1, 30, 30, 25, 15, 1, 'Security Officer: field inspection execution, daily shift logs, and proactive checks'),
    ('tgt-scc-sup', 'unit-scc', 'pos-scc-sup', 95.00, 90.00, 1, 30, 35, 20, 15, 1, 'Command Center Supervisor: SOC escalation timeliness, audit resolution, and shift watch logs'),
    ('tgt-cctv',    'unit-scc', 'pos-cctv',    95.00, 90.00, 1, 25, 30, 35, 10, 2, 'CCTV Operator: consistent shift monitoring logs, camera/access audits, and prompt escalation'),
    ('tgt-rmo',     'unit-rpm', 'pos-rmo',     95.00, 92.00, 1, 35, 40, 15, 10, 1, 'Report Management Officer: report compliance timeliness, accuracy, and audit follow-ups')
ON CONFLICT (id) DO UPDATE SET
    unit_id = EXCLUDED.unit_id,
    position_id = EXCLUDED.position_id,
    target_completion_rate = EXCLUDED.target_completion_rate,
    target_on_time_rate = EXCLUDED.target_on_time_rate,
    monthly_initiative_goal = EXCLUDED.monthly_initiative_goal,
    weight_completion = EXCLUDED.weight_completion,
    weight_on_time = EXCLUDED.weight_on_time,
    weight_activity = EXCLUDED.weight_activity,
    weight_initiative = EXCLUDED.weight_initiative,
    daily_activity_target = EXCLUDED.daily_activity_target,
    notes = EXCLUDED.notes,
    updated_at = timezone('utc'::text, now());

-- =====================================================================================
-- VERIFICATION QUERIES (Run separately in Supabase SQL Editor after executing above)
-- =====================================================================================
-- 1. Confirm operating regions include NCR & Rizal + Visayas 6/7 + Mindanao 10/11:
--    SELECT id, code, name, island_group, sort_order, is_active FROM public.operating_regions ORDER BY sort_order;
--
-- 2. Confirm position-specific performance targets & weights exist:
--    SELECT id, position_id, target_completion_rate, target_on_time_rate, weight_completion, weight_on_time, weight_activity, weight_initiative, daily_activity_target FROM public.performance_targets ORDER BY id;
--
-- 3. Confirm existing personnel_assignments and profiles remain untouched:
--    SELECT count(*) AS total_profiles, count(*) FILTER (WHERE approved) AS approved_profiles FROM public.profiles;
--    SELECT count(*) AS assigned_profiles FROM public.personnel_assignments;
