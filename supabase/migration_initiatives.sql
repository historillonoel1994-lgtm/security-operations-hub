-- =====================================================================================
-- SECURITY OPERATIONS HUB (SOH) - MEMBER INITIATIVE & ACTIVITY RECOGNITION SYSTEM
-- Migration: Add member_initiatives and initiative_history tables with RLS
-- Target: Supabase (PostgreSQL 15+)
-- Non-destructive migration: Preserves all existing tables and data
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. UPDATE AUDIT LOGS CONSTRAINT TO ALLOW 'initiative' RECORD TYPE
-- -------------------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_record_type_check;
    ALTER TABLE IF EXISTS public.audit_logs ADD CONSTRAINT audit_logs_record_type_check 
        CHECK (record_type IN ('task', 'task_update', 'activity', 'profile', 'auth', 'initiative'));
EXCEPTION
    WHEN undefined_table THEN null;
END $$;

-- -------------------------------------------------------------------------------------
-- 2. CREATE MEMBER_INITIATIVES TABLE
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_initiatives (
    id TEXT PRIMARY KEY DEFAULT ('init-' || substr(md5(random()::text), 1, 8)),
    submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    submitted_by_name TEXT,
    submitted_by_email TEXT,
    initiative_type TEXT NOT NULL CHECK (initiative_type IN ('proposed', 'self_initiated')),
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 2),
    category TEXT NOT NULL CHECK (category IN (
        'Security Inspection',
        'Risk Identification',
        'Preventive Security Action',
        'CCTV / Door Access Concern',
        'Security Process Improvement',
        'Incident Prevention',
        'Coordination / Collaboration',
        'Workplace Safety',
        'Other'
    )),
    region TEXT NOT NULL DEFAULT 'NCR - Metro Manila',
    location TEXT,
    description TEXT NOT NULL CHECK (char_length(trim(description)) > 3),
    action_details TEXT NOT NULL CHECK (char_length(trim(action_details)) > 3),
    expected_outcome TEXT NOT NULL CHECK (char_length(trim(expected_outcome)) > 3),
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    justification TEXT NOT NULL CHECK (char_length(trim(justification)) > 2),
    supporting_document TEXT,
    remarks TEXT,
    related_task_id TEXT REFERENCES public.tasks(id) ON DELETE SET NULL,
    related_task_title TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',
        'pending_review',
        'approved_to_proceed',
        'in_progress',
        'accomplishment_submitted',
        'returned',
        'recognized',
        'rejected'
    )),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_by_name TEXT,
    reviewed_at TIMESTAMPTZ,
    recognized_at TIMESTAMPTZ,
    manager_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------------------------------
-- 3. CREATE INITIATIVE_HISTORY TABLE (Immutable Audit Trail for Status Changes)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.initiative_history (
    id TEXT PRIMARY KEY DEFAULT ('inh-' || substr(md5(random()::text), 1, 8)),
    initiative_id TEXT NOT NULL REFERENCES public.member_initiatives(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_name TEXT,
    actor_role public.user_role_type NOT NULL DEFAULT 'member',
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES
-- -------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_member_initiatives_submitted_by ON public.member_initiatives(submitted_by);
CREATE INDEX IF NOT EXISTS idx_member_initiatives_status ON public.member_initiatives(status);
CREATE INDEX IF NOT EXISTS idx_member_initiatives_region ON public.member_initiatives(region);
CREATE INDEX IF NOT EXISTS idx_member_initiatives_activity_date ON public.member_initiatives(activity_date);
CREATE INDEX IF NOT EXISTS idx_member_initiatives_recognized_at ON public.member_initiatives(recognized_at);
CREATE INDEX IF NOT EXISTS idx_initiative_history_initiative_id ON public.initiative_history(initiative_id);

-- -------------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES FOR MEMBER INITIATIVES
-- -------------------------------------------------------------------------------------
ALTER TABLE public.member_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiative_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "initiatives_select_policy" ON public.member_initiatives;
DROP POLICY IF EXISTS "initiatives_insert_policy" ON public.member_initiatives;
DROP POLICY IF EXISTS "initiatives_update_policy" ON public.member_initiatives;
DROP POLICY IF EXISTS "initiatives_delete_policy" ON public.member_initiatives;

DROP POLICY IF EXISTS "initiative_history_select_policy" ON public.initiative_history;
DROP POLICY IF EXISTS "initiative_history_insert_policy" ON public.initiative_history;
DROP POLICY IF EXISTS "initiative_history_no_update" ON public.initiative_history;
DROP POLICY IF EXISTS "initiative_history_no_delete" ON public.initiative_history;

-- SELECT POLICY:
-- Approved Managers see all department initiatives for evaluation and recognition reports.
-- Approved Members see only initiatives they submitted.
CREATE POLICY "initiatives_select_policy"
ON public.member_initiatives FOR SELECT
USING (
    public.is_approved_user()
    AND (
        public.is_manager()
        OR submitted_by = auth.uid()
    )
);

-- INSERT POLICY:
-- Approved Members can create initiatives only under their own user ID.
-- Members can only submit with status 'draft', 'pending_review', or 'accomplishment_submitted'.
-- Members cannot insert directly as 'recognized' or 'approved_to_proceed'.
CREATE POLICY "initiatives_insert_policy"
ON public.member_initiatives FOR INSERT
WITH CHECK (
    public.is_approved_user()
    AND submitted_by = auth.uid()
    AND (
        public.is_manager()
        OR status IN ('draft', 'pending_review', 'accomplishment_submitted')
    )
);

-- UPDATE POLICY:
-- Managers have full update rights (approving, returning, rejecting, recognizing, or revoking).
-- Members can only update their own records when in Draft or Returned status,
-- or when advancing from 'approved_to_proceed' to 'in_progress',
-- or from 'in_progress' to 'accomplishment_submitted'.
-- Direct database calls cannot let a member mark an initiative as 'recognized'.
CREATE POLICY "initiatives_update_policy"
ON public.member_initiatives FOR UPDATE
USING (
    public.is_approved_user()
    AND (
        public.is_manager()
        OR (
            submitted_by = auth.uid()
            AND status IN ('draft', 'returned', 'approved_to_proceed', 'in_progress')
        )
    )
)
WITH CHECK (
    public.is_approved_user()
    AND (
        public.is_manager()
        OR (
            submitted_by = auth.uid()
            -- Members CANNOT set status to recognized, approved_to_proceed, or rejected
            AND status IN ('draft', 'pending_review', 'in_progress', 'accomplishment_submitted')
        )
    )
);

-- DELETE POLICY:
-- Draft initiatives can be deleted by their author. Managers can delete if necessary.
CREATE POLICY "initiatives_delete_policy"
ON public.member_initiatives FOR DELETE
USING (
    public.is_approved_user()
    AND (
        public.is_manager()
        OR (submitted_by = auth.uid() AND status = 'draft')
    )
);

-- -------------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES FOR INITIATIVE HISTORY
-- -------------------------------------------------------------------------------------
-- View history if user is manager or owner of the initiative
CREATE POLICY "initiative_history_select_policy"
ON public.initiative_history FOR SELECT
USING (
    public.is_approved_user()
    AND (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.member_initiatives
            WHERE member_initiatives.id = initiative_history.initiative_id
            AND member_initiatives.submitted_by = auth.uid()
        )
    )
);

-- Insert history records: any approved user logging their action
CREATE POLICY "initiative_history_insert_policy"
ON public.initiative_history FOR INSERT
WITH CHECK (
    public.is_approved_user()
    AND actor_id = auth.uid()
);

-- Initiative history is immutable
CREATE POLICY "initiative_history_no_update" ON public.initiative_history FOR UPDATE USING (false);
CREATE POLICY "initiative_history_no_delete" ON public.initiative_history FOR DELETE USING (false);
