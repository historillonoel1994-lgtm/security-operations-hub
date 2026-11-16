-- =====================================================================================
-- SECURITY OPERATIONS HUB (SOH) - PERSONNEL DIRECTORY, ORG HIERARCHY & PERFORMANCE
-- Non-Destructive SQL Migration for Manual Review & Execution in Supabase SQL Editor
-- Target: Supabase (PostgreSQL 15+)
--
-- SAFETY GUARANTEES:
-- 1. Preserves ALL existing tables and records (profiles, tasks, task_updates,
--    activities, audit_logs, member_initiatives, initiative_history).
-- 2. Does NOT invent fake personnel or overwrite existing roles/approvals.
-- 3. Enforces strict Row Level Security (RLS) so Team Members cannot escalate roles,
--    change supervisors, or read private performance data of other personnel.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. EXPAND AUDIT LOGS RECORD_TYPE CONSTRAINT (NON-DESTRUCTIVE)
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
    WHEN undefined_table THEN null;
END $$;

-- -------------------------------------------------------------------------------------
-- 2. ORGANIZATIONAL UNITS TABLE (CONFIGURABLE FUNCTIONAL GROUPS)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizational_units (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_unit_id TEXT REFERENCES public.organizational_units(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed core Security Department structure (idempotent)
INSERT INTO public.organizational_units (id, code, name, description, parent_unit_id, sort_order, is_active)
VALUES
    ('unit-exec', 'EXEC', 'Executive & Department Management', 'VP & Head of Security and Corporate Security Manager oversight', NULL, 1, true),
    ('unit-rso', 'RSO', 'Regional Security Operations', 'Regional Security Supervisors, Investigators, and Security Officers across Philippine facilities', 'unit-exec', 2, true),
    ('unit-scc', 'SCC', 'Security Command Center', 'Command Center Supervisors and CCTV Operators managing central and site monitoring', 'unit-exec', 3, true),
    ('unit-rpm', 'RPM', 'Reporting & Performance Management', 'Report Management Officers overseeing incident reporting, records, follow-up, and analytics', 'unit-exec', 4, true),
    ('unit-supp', 'SUPPORT', 'Security Support Functions', 'Other authorized security support units added by the Security Manager', 'unit-exec', 5, true)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 3. CONFIGURABLE POSITIONS / DESIGNATIONS TABLE
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.positions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL UNIQUE,
    unit_id TEXT REFERENCES public.organizational_units(id) ON DELETE SET NULL,
    hierarchy_level INTEGER NOT NULL DEFAULT 4 CHECK (hierarchy_level BETWEEN 1 AND 10),
    is_supervisory BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.positions (id, title, unit_id, hierarchy_level, is_supervisory, description, is_active)
VALUES
    ('pos-vp', 'VP & Head of Security', 'unit-exec', 1, true, 'Executive security oversight across corporate operations', true),
    ('pos-mgr', 'Security Manager', 'unit-exec', 2, true, 'Department management, task delegation, approvals, and performance oversight', true),
    ('pos-rso-sup', 'Regional Security Supervisor', 'unit-rso', 3, true, 'Supervises regional security operations, inspections, and site compliance', true),
    ('pos-inv', 'Investigator', 'unit-rso', 4, false, 'Handles security investigations, follow-ups, and case documentation', true),
    ('pos-sec-off', 'Security Officer', 'unit-rso', 4, false, 'Organic field security officer executing inspections and preventive checks', true),
    ('pos-scc-sup', 'Command Center Supervisor', 'unit-scc', 3, true, 'Oversees central and site-based CCTV & monitoring operations', true),
    ('pos-cctv', 'CCTV Operator', 'unit-scc', 4, false, 'Monitors CCTV feeds, access control alerts, and SOC escalation logs', true),
    ('pos-rmo', 'Report Management Officer', 'unit-rpm', 4, false, 'Manages incident reporting, compliance records, follow-ups, and management reports', true),
    ('pos-supp', 'Security Support Specialist', 'unit-supp', 4, false, 'Authorized corporate security support personnel', true)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 4. CONFIGURABLE OPERATING REGIONS TABLE (PHILIPPINE GEOGRAPHICAL GROUPINGS)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operating_regions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    island_group TEXT NOT NULL DEFAULT 'Luzon',
    sort_order INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.operating_regions (id, code, name, island_group, sort_order, is_active)
VALUES
    ('reg-ncr', 'NCR', 'NCR - Metro Manila', 'Luzon', 1, true),
    ('reg-nlz', 'NLZ', 'North Luzon', 'Luzon', 2, true),
    ('reg-clz', 'CLZ', 'Central Luzon', 'Luzon', 3, true),
    ('reg-slz', 'SLZ', 'South Luzon', 'Luzon', 4, true),
    ('reg-bcl', 'BCL', 'Bicol', 'Luzon', 5, true),
    ('reg-vis', 'VIS', 'Visayas', 'Visayas', 6, true),
    ('reg-min', 'MIN', 'Mindanao', 'Mindanao', 7, true),
    ('reg-nat', 'NAT', 'Nationwide / Multi-Site', 'Nationwide', 8, true)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 5. PERSONNEL ASSIGNMENTS & REPORTING HIERARCHY TABLE
-- Links 1:1 to existing public.profiles (never duplicates auth/user accounts).
-- Agency-deployed guards are NOT registered here unless explicitly onboarded as SOH users.
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personnel_assignments (
    profile_user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    organizational_unit_id TEXT REFERENCES public.organizational_units(id) ON DELETE SET NULL,
    position_id TEXT REFERENCES public.positions(id) ON DELETE SET NULL,
    reports_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    region_id TEXT REFERENCES public.operating_regions(id) ON DELETE SET NULL,
    assigned_site TEXT,
    employment_category TEXT NOT NULL DEFAULT 'organic_personnel' CHECK (
        employment_category IN ('organic_personnel', 'supervisor', 'management', 'support_staff')
    ),
    operational_status TEXT NOT NULL DEFAULT 'active' CHECK (
        operational_status IN ('active', 'on_leave', 'reassigned', 'inactive')
    ),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_no_self_supervision CHECK (reports_to_user_id IS NULL OR reports_to_user_id <> profile_user_id)
);

CREATE INDEX IF NOT EXISTS idx_personnel_assignments_unit ON public.personnel_assignments(organizational_unit_id);
CREATE INDEX IF NOT EXISTS idx_personnel_assignments_pos ON public.personnel_assignments(position_id);
CREATE INDEX IF NOT EXISTS idx_personnel_assignments_sup ON public.personnel_assignments(reports_to_user_id);
CREATE INDEX IF NOT EXISTS idx_personnel_assignments_reg ON public.personnel_assignments(region_id);

-- Prevent circular reporting chains in database trigger (A -> B -> C -> A)
CREATE OR REPLACE FUNCTION public.prevent_circular_reporting()
RETURNS TRIGGER AS $$
DECLARE
    current_sup UUID;
    hops INTEGER := 0;
BEGIN
    IF NEW.reports_to_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.reports_to_user_id = NEW.profile_user_id THEN
        RAISE EXCEPTION 'Self-supervision is not permitted.';
    END IF;

    current_sup := NEW.reports_to_user_id;
    WHILE current_sup IS NOT NULL AND hops < 25 LOOP
        IF current_sup = NEW.profile_user_id THEN
            RAISE EXCEPTION 'Circular reporting hierarchy detected. A user cannot report to a subordinate.';
        END IF;

        SELECT reports_to_user_id INTO current_sup
        FROM public.personnel_assignments
        WHERE profile_user_id = current_sup;

        hops := hops + 1;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_circular_reporting ON public.personnel_assignments;
CREATE TRIGGER trg_prevent_circular_reporting
    BEFORE INSERT OR UPDATE ON public.personnel_assignments
    FOR EACH ROW EXECUTE FUNCTION public.prevent_circular_reporting();

-- -------------------------------------------------------------------------------------
-- 6. PERSONNEL REPORTING HISTORY (IMMUTABLE AUDIT TRAIL FOR REASSIGNMENTS)
-- Ensures prior regional/unit reporting is preserved when personnel transfer.
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personnel_reporting_history (
    id TEXT PRIMARY KEY DEFAULT ('prh-' || substr(md5(random()::text), 1, 8)),
    profile_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    previous_unit_id TEXT,
    new_unit_id TEXT,
    previous_position_id TEXT,
    new_position_id TEXT,
    previous_region_id TEXT,
    new_region_id TEXT,
    previous_assigned_site TEXT,
    new_assigned_site TEXT,
    previous_reports_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    new_reports_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    previous_operational_status TEXT,
    new_operational_status TEXT,
    change_reason TEXT NOT NULL CHECK (char_length(trim(change_reason)) > 2),
    changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    changed_by_name TEXT,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_prh_user_date ON public.personnel_reporting_history(profile_user_id, effective_date DESC);

-- -------------------------------------------------------------------------------------
-- 7. PERFORMANCE TARGETS TABLE (CONFIGURABLE BENCHMARKS PER UNIT/POSITION)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.performance_targets (
    id TEXT PRIMARY KEY,
    unit_id TEXT REFERENCES public.organizational_units(id) ON DELETE CASCADE,
    position_id TEXT REFERENCES public.positions(id) ON DELETE CASCADE,
    target_completion_rate NUMERIC(5,2) NOT NULL DEFAULT 90.00,
    target_on_time_rate NUMERIC(5,2) NOT NULL DEFAULT 85.00,
    monthly_initiative_goal INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.performance_targets (id, unit_id, position_id, target_completion_rate, target_on_time_rate, monthly_initiative_goal, notes)
VALUES
    ('tgt-rso', 'unit-rso', NULL, 90.00, 85.00, 1, 'Standard Regional Security Operations operational benchmark'),
    ('tgt-scc', 'unit-scc', NULL, 95.00, 90.00, 1, 'Security Command Center monitoring & audit benchmark'),
    ('tgt-rpm', 'unit-rpm', NULL, 95.00, 92.00, 1, 'Reporting & Performance Management timeliness benchmark')
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 8. SAFE SUPERVISOR LOOKUP RPC FOR TEAM MEMBERS (NO PRIVATE EMAIL/DATA EXPOSURE)
-- Allows an approved Team Member to see ONLY their own assigned supervisor's
-- display name, organizational position, unit, and operating region.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_supervisor_summary()
RETURNS TABLE (
    supervisor_id UUID,
    supervisor_name TEXT,
    position_title TEXT,
    unit_name TEXT,
    region_name TEXT
) AS $$
BEGIN
    IF NOT public.is_approved_user() THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        sup_prof.id AS supervisor_id,
        sup_prof.display_name AS supervisor_name,
        COALESCE(sup_pos.title, CASE WHEN sup_prof.role = 'manager' THEN 'Security Manager' ELSE 'Supervisor' END) AS position_title,
        COALESCE(sup_unit.name, 'Security Department') AS unit_name,
        COALESCE(sup_reg.name, sup_prof.regional_assignment) AS region_name
    FROM public.personnel_assignments pa
    JOIN public.profiles sup_prof ON sup_prof.id = pa.reports_to_user_id
    LEFT JOIN public.personnel_assignments sup_pa ON sup_pa.profile_user_id = sup_prof.id
    LEFT JOIN public.positions sup_pos ON sup_pos.id = sup_pa.position_id
    LEFT JOIN public.organizational_units sup_unit ON sup_unit.id = sup_pa.organizational_unit_id
    LEFT JOIN public.operating_regions sup_reg ON sup_reg.id = sup_pa.region_id
    WHERE pa.profile_user_id = auth.uid()
      AND sup_prof.approved = true
      AND sup_prof.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- -------------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------------------------------
ALTER TABLE public.organizational_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_reporting_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_targets ENABLE ROW LEVEL SECURITY;

-- Drop policies cleanly if re-running
DROP POLICY IF EXISTS "org_units_select" ON public.organizational_units;
DROP POLICY IF EXISTS "org_units_manager_write" ON public.organizational_units;
DROP POLICY IF EXISTS "positions_select" ON public.positions;
DROP POLICY IF EXISTS "positions_manager_write" ON public.positions;
DROP POLICY IF EXISTS "regions_select" ON public.operating_regions;
DROP POLICY IF EXISTS "regions_manager_write" ON public.operating_regions;
DROP POLICY IF EXISTS "pa_select" ON public.personnel_assignments;
DROP POLICY IF EXISTS "pa_manager_insert" ON public.personnel_assignments;
DROP POLICY IF EXISTS "pa_manager_update" ON public.personnel_assignments;
DROP POLICY IF EXISTS "pa_manager_delete" ON public.personnel_assignments;
DROP POLICY IF EXISTS "prh_select" ON public.personnel_reporting_history;
DROP POLICY IF EXISTS "prh_manager_insert" ON public.personnel_reporting_history;
DROP POLICY IF EXISTS "prh_no_update" ON public.personnel_reporting_history;
DROP POLICY IF EXISTS "prh_no_delete" ON public.personnel_reporting_history;
DROP POLICY IF EXISTS "targets_select" ON public.performance_targets;
DROP POLICY IF EXISTS "targets_manager_write" ON public.performance_targets;

-- Organizational lookup tables: Approved users can read; Only Managers can configure
CREATE POLICY "org_units_select" ON public.organizational_units
    FOR SELECT USING (public.is_approved_user());
CREATE POLICY "org_units_manager_write" ON public.organizational_units
    FOR ALL USING (public.is_manager()) WITH CHECK (public.is_manager());

CREATE POLICY "positions_select" ON public.positions
    FOR SELECT USING (public.is_approved_user());
CREATE POLICY "positions_manager_write" ON public.positions
    FOR ALL USING (public.is_manager()) WITH CHECK (public.is_manager());

CREATE POLICY "regions_select" ON public.operating_regions
    FOR SELECT USING (public.is_approved_user());
CREATE POLICY "regions_manager_write" ON public.operating_regions
    FOR ALL USING (public.is_manager()) WITH CHECK (public.is_manager());

CREATE POLICY "targets_select" ON public.performance_targets
    FOR SELECT USING (public.is_approved_user());
CREATE POLICY "targets_manager_write" ON public.performance_targets
    FOR ALL USING (public.is_manager()) WITH CHECK (public.is_manager());

-- Personnel Assignments: Members see ONLY their own assignment; Managers see & manage all
CREATE POLICY "pa_select" ON public.personnel_assignments
    FOR SELECT USING (
        public.is_approved_user()
        AND (
            public.is_manager()
            OR profile_user_id = auth.uid()
        )
    );
CREATE POLICY "pa_manager_insert" ON public.personnel_assignments
    FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "pa_manager_update" ON public.personnel_assignments
    FOR UPDATE USING (public.is_manager()) WITH CHECK (public.is_manager());
CREATE POLICY "pa_manager_delete" ON public.personnel_assignments
    FOR DELETE USING (public.is_manager());

-- Personnel Reporting History: Members see their own transfer history; Managers see all; Immutable
CREATE POLICY "prh_select" ON public.personnel_reporting_history
    FOR SELECT USING (
        public.is_approved_user()
        AND (
            public.is_manager()
            OR profile_user_id = auth.uid()
        )
    );
CREATE POLICY "prh_manager_insert" ON public.personnel_reporting_history
    FOR INSERT WITH CHECK (public.is_manager() AND changed_by = auth.uid());
CREATE POLICY "prh_no_update" ON public.personnel_reporting_history FOR UPDATE USING (false);
CREATE POLICY "prh_no_delete" ON public.personnel_reporting_history FOR DELETE USING (false);

-- -------------------------------------------------------------------------------------
-- 10. ENABLE SUPABASE REALTIME FOR LIVE DASHBOARD UPDATES (IDEMPOTENT)
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'tasks',
        'task_updates',
        'activities',
        'member_initiatives',
        'personnel_assignments',
        'profiles'
    ]
    LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
            WHEN undefined_table THEN NULL;
        END;
    END LOOP;
END $$;
