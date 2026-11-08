-- =====================================================================================
-- SECURITY OPERATIONS HUB (SOH) - DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- Target: Supabase (PostgreSQL 15+)
-- Environment: Philippine Corporate Security Management
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 0. CLEANUP (OPTIONAL / RESET)
-- -------------------------------------------------------------------------------------
-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP TABLE IF EXISTS activities CASCADE;
-- DROP TABLE IF EXISTS task_updates CASCADE;
-- DROP TABLE IF EXISTS tasks CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- -------------------------------------------------------------------------------------
-- 1. ENUMS AND DOMAINS
-- -------------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('manager', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_priority_type AS ENUM ('normal', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status_type AS ENUM ('assigned', 'in_progress', 'for_review', 'returned', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -------------------------------------------------------------------------------------
-- 2. TABLE DEFINITIONS
-- -------------------------------------------------------------------------------------

-- Table 1: profiles
-- Minimal non-sensitive metadata only (email, name, role, approval status)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role user_role_type NOT NULL DEFAULT 'member',
    approved BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    regional_assignment TEXT DEFAULT 'NCR - Metro Manila',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table 2: tasks
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT ('tsk-' || substr(md5(random()::text), 1, 8)),
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 2),
    instructions TEXT NOT NULL CHECK (char_length(trim(instructions)) > 5),
    category TEXT NOT NULL CHECK (category IN (
        'Inspection',
        'Investigation Follow-up',
        'CCTV / Access Concern',
        'Security Report',
        'Project Update',
        'Administrative Task',
        'Other'
    )),
    assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    assigned_user_name TEXT,
    assigned_user_email TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_by_name TEXT,
    region TEXT NOT NULL DEFAULT 'NCR - Metro Manila',
    due_date DATE NOT NULL,
    priority task_priority_type NOT NULL DEFAULT 'normal',
    status task_status_type NOT NULL DEFAULT 'assigned',
    remarks TEXT,
    progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

-- Table 3: task_updates
CREATE TABLE IF NOT EXISTS task_updates (
    id TEXT PRIMARY KEY DEFAULT ('upd-' || substr(md5(random()::text), 1, 8)),
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_name TEXT,
    author_role user_role_type NOT NULL DEFAULT 'member',
    progress_note TEXT NOT NULL CHECK (char_length(trim(progress_note)) > 0),
    progress_percent INTEGER CHECK (progress_percent BETWEEN 0 AND 100),
    submitted_for_review BOOLEAN NOT NULL DEFAULT false,
    manager_feedback TEXT,
    status_change task_status_type,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table 4: activities (Daily shift accomplishment logs)
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY DEFAULT ('act-' || substr(md5(random()::text), 1, 8)),
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_name TEXT,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 2),
    description TEXT NOT NULL CHECK (char_length(trim(description)) > 5),
    region TEXT,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    linked_task_title TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table 5: audit_logs (Immutable audit trail for compliance)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('aud-' || substr(md5(random()::text), 1, 8)),
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_name TEXT,
    action TEXT NOT NULL,
    record_type TEXT NOT NULL CHECK (record_type IN ('task', 'task_update', 'activity', 'profile', 'auth')),
    record_id TEXT,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------------------------------
-- 3. INDEXES FOR HIGH-PERFORMANCE REGIONAL QUERIES
-- -------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_region ON tasks(region);
CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_activities_author_date ON activities(author_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at);

-- -------------------------------------------------------------------------------------
-- 4. SECURITY FUNCTIONS (SECURITY DEFINER)
-- -------------------------------------------------------------------------------------

-- Check if current authenticated user is an active, approved manager
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN AS $$
DECLARE
    is_mgr BOOLEAN;
BEGIN
    SELECT (role = 'manager' AND approved = true AND active = true)
    INTO is_mgr
    FROM profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(is_mgr, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current authenticated user is an approved and active member or manager
CREATE OR REPLACE FUNCTION is_approved_user()
RETURNS BOOLEAN AS $$
DECLARE
    is_appr BOOLEAN;
BEGIN
    SELECT (approved = true AND active = true)
    INTO is_appr
    FROM profiles
    WHERE id = auth.uid();

    RETURN COALESCE(is_appr, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- -------------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------
-- PROFILES POLICIES
-- ---------------------------------
-- Users can read their own profile; Managers can read all profiles to assign tasks & review approvals
CREATE POLICY "profiles_select_policy"
ON profiles FOR SELECT
USING (
    auth.uid() = id
    OR is_manager()
);

-- Self-registration creates pending profile
CREATE POLICY "profiles_insert_self"
ON profiles FOR INSERT
WITH CHECK (
    auth.uid() = id
    AND role = 'member'
    AND approved = false
);

-- Only Managers can update approval status, role, or active status
CREATE POLICY "profiles_update_manager_only"
ON profiles FOR UPDATE
USING (is_manager())
WITH CHECK (is_manager());

-- ---------------------------------
-- TASKS POLICIES
-- ---------------------------------
-- Unapproved or inactive users see 0 tasks.
-- Managers see all department tasks; Members see only tasks assigned to them.
CREATE POLICY "tasks_select_policy"
ON tasks FOR SELECT
USING (
    is_approved_user()
    AND (
        is_manager()
        OR assigned_to = auth.uid()
    )
);

-- Only Managers can create tasks
CREATE POLICY "tasks_insert_manager_only"
ON tasks FOR INSERT
WITH CHECK (
    is_manager()
    AND created_by = auth.uid()
);

-- Managers have full update rights.
-- Members CANNOT arbitrarily edit instructions, deadlines, or mark tasks 'completed'.
-- Members can only update progress_percent and status to 'in_progress' or 'for_review' via task_updates.
CREATE POLICY "tasks_update_policy"
ON tasks FOR UPDATE
USING (
    is_approved_user()
    AND (
        is_manager()
        OR (assigned_to = auth.uid())
    )
)
WITH CHECK (
    is_approved_user()
    AND (
        is_manager()
        OR (
            assigned_to = auth.uid()
            -- Members cannot complete tasks or alter assignment/deadline
            AND (status IN ('in_progress', 'for_review'))
        )
    )
);

-- Only Managers can delete tasks
CREATE POLICY "tasks_delete_manager_only"
ON tasks FOR DELETE
USING (is_manager());

-- ---------------------------------
-- TASK_UPDATES POLICIES
-- ---------------------------------
-- View updates if user is manager or task is assigned to member
CREATE POLICY "task_updates_select_policy"
ON task_updates FOR SELECT
USING (
    is_approved_user()
    AND (
        is_manager()
        OR EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_updates.task_id
            AND tasks.assigned_to = auth.uid()
        )
    )
);

-- Add update: Manager can add notes/feedback; Member can post to their assigned tasks
CREATE POLICY "task_updates_insert_policy"
ON task_updates FOR INSERT
WITH CHECK (
    is_approved_user()
    AND author_id = auth.uid()
    AND (
        is_manager()
        OR EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_updates.task_id
            AND tasks.assigned_to = auth.uid()
        )
    )
);

-- Task updates are historical records and cannot be deleted or forged
CREATE POLICY "task_updates_no_delete"
ON task_updates FOR DELETE
USING (false);

-- ---------------------------------
-- ACTIVITIES POLICIES
-- ---------------------------------
-- Members see their own activities; Managers see all team activities
CREATE POLICY "activities_select_policy"
ON activities FOR SELECT
USING (
    is_approved_user()
    AND (
        is_manager()
        OR author_id = auth.uid()
    )
);

-- Approved users can log their own activities
CREATE POLICY "activities_insert_policy"
ON activities FOR INSERT
WITH CHECK (
    is_approved_user()
    AND author_id = auth.uid()
);

-- Users can edit only their own daily activities
CREATE POLICY "activities_update_policy"
ON activities FOR UPDATE
USING (
    is_approved_user()
    AND author_id = auth.uid()
)
WITH CHECK (
    is_approved_user()
    AND author_id = auth.uid()
);

-- ---------------------------------
-- AUDIT_LOGS POLICIES
-- ---------------------------------
-- Only Managers can view audit logs
CREATE POLICY "audit_logs_select_manager_only"
ON audit_logs FOR SELECT
USING (is_manager());

-- Any approved user can append audit entries
CREATE POLICY "audit_logs_insert_policy"
ON audit_logs FOR INSERT
WITH CHECK (
    is_approved_user()
    AND actor_id = auth.uid()
);

-- Audit logs cannot be modified or deleted by anyone
CREATE POLICY "audit_logs_no_update" ON audit_logs FOR UPDATE USING (false);
CREATE POLICY "audit_logs_no_delete" ON audit_logs FOR DELETE USING (false);

-- -------------------------------------------------------------------------------------
-- 6. AUTOMATIC AUTH TRIGGER FOR NEW GOOGLE SIGN-INS
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, role, approved, active)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        'member',
        false, -- PENDING MANAGER APPROVAL
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after a new user signs up in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_registration();

-- -------------------------------------------------------------------------------------
-- 7. SAFE MANUAL FIRST-MANAGER BOOTSTRAP INSTRUCTIONS
-- -------------------------------------------------------------------------------------
-- To promote the first Security Manager securely via Supabase SQL Editor:
--
-- 1. Sign in with Google on the SOH login screen once to register your account.
-- 2. Open Supabase Dashboard -> SQL Editor and run:
--
--    UPDATE public.profiles
--    SET role = 'manager', approved = true, active = true
--    WHERE email = 'your.security.manager.email@domain.com';
--
-- 3. Refresh the SOH application. You will now have full Manager privileges.
-- =====================================================================================
